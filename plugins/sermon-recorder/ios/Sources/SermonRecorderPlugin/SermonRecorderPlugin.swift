import Foundation
import AVFoundation
import Capacitor

/// Records a sermon to an AAC file and keeps going with the screen locked.
/// The app's Info.plist needs NSMicrophoneUsageDescription and the "audio" background mode.
@objc(SermonRecorderPlugin)
public class SermonRecorderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SermonRecorderPlugin"
    public let jsName = "SermonRecorder"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listSaved", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]

    private var recorder: AVAudioRecorder?
    private var state = "idle"
    private var lastError: String?
    private var interruptionObserver: NSObjectProtocol?

    private var recordingsDir: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("recordings", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    @objc func start(_ call: CAPPluginCall) {
        guard state == "idle" else {
            call.reject("A recording is already running.", "ALREADY_RECORDING")
            return
        }
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            DispatchQueue.main.async {
                guard granted else {
                    call.reject("Microphone access is needed to record the message.", "MIC_DENIED")
                    return
                }
                self.begin(call)
            }
        }
    }

    private func begin(_ call: CAPPluginCall) {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
            try session.setActive(true)

            let url = recordingsDir.appendingPathComponent("sermon-\(Int(Date().timeIntervalSince1970 * 1000)).m4a")
            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 22050,
                AVNumberOfChannelsKey: 1,
                AVEncoderBitRateKey: 32000,
                AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue
            ]
            let rec = try AVAudioRecorder(url: url, settings: settings)
            rec.isMeteringEnabled = true
            guard rec.record() else {
                call.reject("The recording could not start.", "START_FAILED")
                return
            }
            recorder = rec
            state = "recording"
            lastError = nil
            observeInterruptions()
            call.resolve()
        } catch {
            call.reject("The recording could not start.", "START_FAILED", error)
        }
    }

    /// A phone call or Siri pauses the microphone. Pick the recording back up when it ends.
    private func observeInterruptions() {
        if let existing = interruptionObserver { NotificationCenter.default.removeObserver(existing) }
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] note in
            guard let self = self,
                  let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            if type == .began, self.state == "recording" {
                self.recorder?.pause()
                self.state = "paused"
            } else if type == .ended, self.state == "paused" {
                try? AVAudioSession.sharedInstance().setActive(true)
                if self.recorder?.record() == true { self.state = "recording" }
            }
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        guard state == "recording", let rec = recorder else {
            call.reject("Nothing is recording.", "NOT_RECORDING")
            return
        }
        rec.pause()
        state = "paused"
        call.resolve()
    }

    @objc func resume(_ call: CAPPluginCall) {
        guard state == "paused", let rec = recorder, rec.record() else {
            call.reject("Nothing is paused.", "NOT_PAUSED")
            return
        }
        state = "recording"
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        guard let rec = recorder else {
            call.reject("Nothing was recorded.", "EMPTY")
            return
        }
        let duration = rec.currentTime
        let url = rec.url
        finish()
        let size = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
        guard size > 0 else {
            call.reject("Nothing was recorded.", "EMPTY")
            return
        }
        call.resolve([
            "path": url.absoluteString,
            "mimeType": "audio/mp4",
            "durationMs": Int(duration * 1000),
            "size": size
        ])
    }

    @objc func cancel(_ call: CAPPluginCall) {
        let url = recorder?.url
        finish()
        if let url = url { try? FileManager.default.removeItem(at: url) }
        call.resolve()
    }

    private func finish() {
        recorder?.stop()
        recorder = nil
        state = "idle"
        if let existing = interruptionObserver { NotificationCenter.default.removeObserver(existing) }
        interruptionObserver = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        var level = 0.0
        if state == "recording", let rec = recorder {
            rec.updateMeters()
            // averagePower is in decibels, from -160 (silence) to 0 (full scale).
            level = max(0.0, min(1.0, (Double(rec.averagePower(forChannel: 0)) + 50.0) / 50.0))
        }
        var ret: [String: Any] = [
            "state": state,
            "durationMs": Int((recorder?.currentTime ?? 0) * 1000),
            "level": level
        ]
        if let error = lastError {
            ret["error"] = error
            lastError = nil
        }
        call.resolve(ret)
    }

    @objc func listSaved(_ call: CAPPluginCall) {
        let active = recorder?.url.path
        let keys: [URLResourceKey] = [.contentModificationDateKey, .fileSizeKey]
        let files = (try? FileManager.default.contentsOfDirectory(at: recordingsDir, includingPropertiesForKeys: keys)) ?? []
        var list: [[String: Any]] = []
        for url in files where url.path != active {
            let values = try? url.resourceValues(forKeys: Set(keys))
            let size = values?.fileSize ?? 0
            if size == 0 { continue }
            list.append([
                "path": url.absoluteString,
                "mimeType": "audio/mp4",
                "durationMs": 0,
                "size": size,
                "createdAt": Int((values?.contentModificationDate ?? Date()).timeIntervalSince1970 * 1000)
            ])
        }
        list.sort { ($0["createdAt"] as? Int ?? 0) > ($1["createdAt"] as? Int ?? 0) }
        call.resolve(["recordings": list])
    }

    @objc func remove(_ call: CAPPluginCall) {
        // Only ever delete inside our own recordings folder.
        if let path = call.getString("path"), let url = URL(string: path),
           url.deletingLastPathComponent().standardizedFileURL == recordingsDir.standardizedFileURL {
            try? FileManager.default.removeItem(at: url)
        }
        call.resolve()
    }
}
