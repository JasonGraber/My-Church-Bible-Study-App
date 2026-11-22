package com.mychurchbiblestudy.recorder;

import android.Manifest;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.util.Arrays;

@CapacitorPlugin(
    name = "SermonRecorder",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" })
    }
)
public class SermonRecorderPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphoneResult");
            return;
        }
        // The notification permission only decides whether the "Recording" notice is visible.
        // Recording works either way, so ask once and carry on whatever the answer is.
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") == PermissionState.PROMPT) {
            requestPermissionForAlias("notifications", call, "notificationsResult");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void microphoneResult(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone access is needed to record the message.", "MIC_DENIED");
            return;
        }
        start(call);
    }

    @PermissionCallback
    private void notificationsResult(PluginCall call) {
        begin(call);
    }

    private void begin(PluginCall call) {
        if (!RecorderService.STATE_IDLE.equals(RecorderService.getState())) {
            call.reject("A recording is already running.", "ALREADY_RECORDING");
            return;
        }
        try {
            RecorderService.start(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("The recording could not start.", "START_FAILED", e);
        }
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (RecorderService.pause()) call.resolve(); else call.reject("Nothing is recording.", "NOT_RECORDING");
    }

    @PluginMethod
    public void resume(PluginCall call) {
        if (RecorderService.resume()) call.resolve(); else call.reject("Nothing is paused.", "NOT_PAUSED");
    }

    @PluginMethod
    public void stop(PluginCall call) {
        long duration = RecorderService.getDurationMs();
        File file = RecorderService.stop(true);
        if (file == null) {
            call.reject("Nothing was recorded.", "EMPTY");
            return;
        }
        call.resolve(describe(file, duration));
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        RecorderService.stop(false);
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("state", RecorderService.getState());
        ret.put("durationMs", RecorderService.getDurationMs());
        ret.put("level", Math.min(1.0, RecorderService.getAmplitude() / 20000.0));
        String error = RecorderService.takeLastError();
        if (error != null) ret.put("error", error);
        call.resolve(ret);
    }

    /** Recordings left on the phone: an upload that failed, or a recording cut short by a crash. */
    @PluginMethod
    public void listSaved(PluginCall call) {
        JSArray list = new JSArray();
        File[] files = RecorderService.recordingsDir(getContext()).listFiles();
        String active = RecorderService.getFilePath();
        if (files != null) {
            Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
            for (File f : files) {
                if (f.getAbsolutePath().equals(active) || f.length() == 0) continue;
                JSObject item = describe(f, 0);
                item.put("createdAt", f.lastModified());
                list.put(item);
            }
        }
        JSObject ret = new JSObject();
        ret.put("recordings", list);
        call.resolve(ret);
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String path = call.getString("path", "");
        File dir = RecorderService.recordingsDir(getContext());
        File file = new File(Uri.parse(path).getPath() != null ? Uri.parse(path).getPath() : path);
        // Only ever delete inside our own recordings folder.
        if (file.getParentFile() != null && file.getParentFile().equals(dir)) file.delete();
        call.resolve();
    }

    private JSObject describe(File file, long durationMs) {
        JSObject ret = new JSObject();
        ret.put("path", Uri.fromFile(file).toString());
        ret.put("mimeType", "audio/aac");
        ret.put("durationMs", durationMs);
        ret.put("size", file.length());
        return ret;
    }
}
