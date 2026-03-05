let reminderTimer: ReturnType<typeof setTimeout> | null = null;

/** Register the service worker and return the registration (or null). */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    return reg;
  } catch (e) {
    console.warn('SW registration failed:', e);
    return null;
  }
}

/** Request notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/** Returns current permission state: 'granted' | 'denied' | 'default' | 'unsupported' */
export function getNotificationPermission(): string {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Schedule a daily reminder notification at the given time (HH:MM).
 * Uses setTimeout to fire at the next occurrence, then re-schedules.
 * If the app/tab is closed the timer won't fire — this is a best-effort
 * client-side approach suitable for a PWA without a push server.
 */
export function scheduleReminder(timeStr: string): void {
  clearReminder();

  if (Notification.permission !== 'granted') return;

  const fire = () => {
    showReminderNotification();
    // Re-schedule for the next day
    reminderTimer = setTimeout(fire, 24 * 60 * 60 * 1000);
  };

  const msUntilNext = msUntilTime(timeStr);
  reminderTimer = setTimeout(fire, msUntilNext);
}

/** Cancel any pending reminder timer. */
export function clearReminder(): void {
  if (reminderTimer !== null) {
    clearTimeout(reminderTimer);
    reminderTimer = null;
  }
}

/** Show the reminder notification via the service worker (or fallback). */
async function showReminderNotification(): Promise<void> {
  const reg = await navigator.serviceWorker?.ready;
  if (reg?.active) {
    reg.active.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: 'Bible Study Reminder',
      body: "Time for today's Bible study! Open the app to continue your journey.",
      tag: 'daily-study-reminder'
    });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    // Fallback if SW not available
    new Notification('Bible Study Reminder', {
      body: "Time for today's Bible study! Open the app to continue your journey.",
      tag: 'daily-study-reminder'
    });
  }
}

/** Calculate milliseconds from now until the next occurrence of HH:MM today or tomorrow. */
function msUntilTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);

  // If the target time already passed today, schedule for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}
