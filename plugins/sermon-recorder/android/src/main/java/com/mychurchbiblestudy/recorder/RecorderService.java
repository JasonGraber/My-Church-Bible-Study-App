package com.mychurchbiblestudy.recorder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import java.io.File;

/**
 * Keeps the microphone recording while the screen is off or the app is in the background.
 *
 * The audio is written as an AAC stream (ADTS), not an MP4. An MP4 is only playable once it
 * is closed properly; a stream is usable up to the last second even if the phone dies.
 */
public class RecorderService extends Service {

    public static final String STATE_IDLE = "idle";
    public static final String STATE_RECORDING = "recording";
    public static final String STATE_PAUSED = "paused";

    private static final String CHANNEL_ID = "sermon_recording";
    private static final int NOTIFICATION_ID = 4201;
    private static final String RECORDINGS_DIR = "recordings";

    // One recording at a time, so plain static state is enough for the plugin to read.
    private static volatile RecorderService instance;
    private static volatile String state = STATE_IDLE;
    private static volatile String filePath;
    private static volatile String lastError;
    private static volatile long accumulatedMs;
    private static volatile long segmentStartedAt;

    private MediaRecorder recorder;
    private PowerManager.WakeLock wakeLock;

    public static String getState() { return state; }
    public static String getFilePath() { return filePath; }
    public static String takeLastError() { String e = lastError; lastError = null; return e; }

    public static long getDurationMs() {
        long total = accumulatedMs;
        if (STATE_RECORDING.equals(state)) total += SystemClock.elapsedRealtime() - segmentStartedAt;
        return total;
    }

    public static int getAmplitude() {
        RecorderService s = instance;
        if (s == null || s.recorder == null || !STATE_RECORDING.equals(state)) return 0;
        try { return s.recorder.getMaxAmplitude(); } catch (RuntimeException e) { return 0; }
    }

    public static File recordingsDir(Context context) {
        File dir = new File(context.getFilesDir(), RECORDINGS_DIR);
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    public static void start(Context context) {
        lastError = null;
        Intent intent = new Intent(context, RecorderService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
        else context.startService(intent);
    }

    public static boolean pause() {
        RecorderService s = instance;
        if (s == null || !STATE_RECORDING.equals(state)) return false;
        try {
            s.recorder.pause();
            accumulatedMs += SystemClock.elapsedRealtime() - segmentStartedAt;
            state = STATE_PAUSED;
            s.updateNotification();
            return true;
        } catch (RuntimeException e) { return false; }
    }

    public static boolean resume() {
        RecorderService s = instance;
        if (s == null || !STATE_PAUSED.equals(state)) return false;
        try {
            s.recorder.resume();
            segmentStartedAt = SystemClock.elapsedRealtime();
            state = STATE_RECORDING;
            s.updateNotification();
            return true;
        } catch (RuntimeException e) { return false; }
    }

    /** Stops and returns the finished file, or null if nothing was being recorded. */
    public static File stop(boolean keepFile) {
        RecorderService s = instance;
        String path = filePath;
        if (s != null) s.finish();
        state = STATE_IDLE;
        filePath = null;
        if (path == null) return null;
        File file = new File(path);
        if (!keepFile) { file.delete(); return null; }
        return file.exists() && file.length() > 0 ? file : null;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!STATE_IDLE.equals(state)) return START_NOT_STICKY;
        instance = this;
        try {
            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0;
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification("Recording the message"), type);
            beginRecording();
        } catch (Exception e) {
            lastError = e.getMessage() != null ? e.getMessage() : "The recording could not start.";
            finish();
            state = STATE_IDLE;
        }
        return START_NOT_STICKY;
    }

    private void beginRecording() throws Exception {
        File file = new File(recordingsDir(this), "sermon-" + System.currentTimeMillis() + ".aac");
        recorder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? new MediaRecorder(this) : new MediaRecorder();
        recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
        recorder.setOutputFormat(MediaRecorder.OutputFormat.AAC_ADTS);
        recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
        recorder.setAudioChannels(1);
        recorder.setAudioSamplingRate(22050);
        recorder.setAudioEncodingBitRate(32000); // about 14 MB per hour, clear enough for speech
        recorder.setOutputFile(file.getAbsolutePath());
        recorder.setOnErrorListener((mr, what, extra) -> lastError = "The recording stopped unexpectedly.");
        recorder.prepare();
        recorder.start();

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SermonRecorder:recording");
        wakeLock.acquire(4 * 60 * 60 * 1000L);

        filePath = file.getAbsolutePath();
        accumulatedMs = 0;
        segmentStartedAt = SystemClock.elapsedRealtime();
        state = STATE_RECORDING;
    }

    private void finish() {
        if (recorder != null) {
            try { recorder.stop(); } catch (RuntimeException ignored) { /* stop() throws if nothing was captured */ }
            recorder.release();
            recorder = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
        instance = null;
    }

    @Override
    public void onDestroy() {
        // The system is taking the service down. Close the file so what was captured is kept.
        if (recorder != null) {
            try { recorder.stop(); } catch (RuntimeException ignored) { }
            recorder.release();
            recorder = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (instance == this) { instance = null; state = STATE_IDLE; }
        super.onDestroy();
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, buildNotification(STATE_PAUSED.equals(state) ? "Recording paused" : "Recording the message"));
    }

    private Notification buildNotification(String title) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Sermon recording", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shown while the app is recording a message");
            nm.createNotificationChannel(channel);
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent tap = open == null ? null
            : PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText("Tap to return to the app")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(tap)
            .build();
    }
}
