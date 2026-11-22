import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

export interface Recording { path: string; mimeType: string; durationMs: number; size: number; createdAt?: number }
export interface RecorderStatus { state: 'idle' | 'recording' | 'paused'; durationMs: number; level: number; error?: string }

interface SermonRecorderPlugin {
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<Recording>;
  cancel(): Promise<void>;
  getStatus(): Promise<RecorderStatus>;
  listSaved(): Promise<{ recordings: Recording[] }>;
  remove(options: { path: string }): Promise<void>;
}

/**
 * Browser version, used on the website. It keeps recording only while the tab stays open,
 * which is the reason the phone apps have a native recorder.
 */
class WebRecorder implements SermonRecorderPlugin {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private elapsed = 0;
  private segmentStart = 0;
  private blobs = new Map<string, Blob>();

  async start() {
    if (this.recorder) throw new Error('A recording is already running.');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('This browser cannot record audio. Upload a recording instead.');
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new Error('Microphone access is needed to record the message.');
    }
    const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    this.recorder = new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: 32000 });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.recorder.start(5000);
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.audioContext.createMediaStreamSource(this.stream).connect(this.analyser);
    this.elapsed = 0;
    this.segmentStart = Date.now();
  }

  async pause() {
    if (this.recorder?.state !== 'recording') throw new Error('Nothing is recording.');
    this.recorder.pause();
    this.elapsed += Date.now() - this.segmentStart;
  }

  async resume() {
    if (this.recorder?.state !== 'paused') throw new Error('Nothing is paused.');
    this.recorder.resume();
    this.segmentStart = Date.now();
  }

  private duration() {
    return this.elapsed + (this.recorder?.state === 'recording' ? Date.now() - this.segmentStart : 0);
  }

  private release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close().catch(() => undefined);
    this.recorder = null; this.stream = null; this.analyser = null; this.audioContext = null;
  }

  async stop(): Promise<Recording> {
    const recorder = this.recorder;
    if (!recorder) throw new Error('Nothing was recorded.');
    const durationMs = this.duration();
    await new Promise<void>((resolve) => { recorder.onstop = () => resolve(); recorder.stop(); });
    const mimeType = (recorder.mimeType || 'audio/webm').split(';')[0];
    const blob = new Blob(this.chunks, { type: mimeType });
    this.release();
    if (!blob.size) throw new Error('Nothing was recorded.');
    const path = URL.createObjectURL(blob);
    this.blobs.set(path, blob);
    return { path, mimeType, durationMs, size: blob.size };
  }

  async cancel() {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.release();
  }

  async getStatus(): Promise<RecorderStatus> {
    let level = 0;
    if (this.analyser && this.recorder?.state === 'recording') {
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteTimeDomainData(data);
      level = Math.min(1, Math.max(...Array.from(data).map((v) => Math.abs(v - 128))) / 90);
    }
    const state = this.recorder?.state === 'recording' ? 'recording' : this.recorder?.state === 'paused' ? 'paused' : 'idle';
    return { state, durationMs: this.duration(), level };
  }

  async listSaved() { return { recordings: [] }; }

  async remove({ path }: { path: string }) {
    this.blobs.delete(path);
    URL.revokeObjectURL(path);
  }

  blobFor(path: string) { return this.blobs.get(path); }
}

const webRecorder = new WebRecorder();
export const SermonRecorder = registerPlugin<SermonRecorderPlugin>('SermonRecorder', { web: webRecorder });

/** Reads a finished recording into memory so it can be uploaded. */
export async function readRecording(recording: Recording): Promise<Blob> {
  if (!isNative) {
    const blob = webRecorder.blobFor(recording.path);
    if (!blob) throw new Error('That recording is no longer available.');
    return blob;
  }
  const response = await fetch(Capacitor.convertFileSrc(recording.path));
  if (!response.ok) throw new Error('The recording could not be read from the phone.');
  const blob = await response.blob();
  return new Blob([blob], { type: recording.mimeType });
}

export const formatDuration = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return `${h ? `${h}:` : ''}${h ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`;
};
