import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './platform';
import { UserSettings } from '../types';

const DAILY_ID = 1001;
const SUNDAY_ID_BASE = 2000; // one per service time
const DAILY_TITLE = 'Bible Study Reminder';
const DAILY_BODY = "Time for today's Bible study. Open the app to pick up where you left off.";

let webTimer: ReturnType<typeof setTimeout> | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (isNative || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('./sw.js');
  } catch (e) {
    console.warn('SW registration failed:', e);
    return null;
  }
}

/** Asks for permission to show notifications. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isNative) {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  }
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/** 'granted' | 'denied' | 'default' | 'unsupported' */
export async function getNotificationPermission(): Promise<string> {
  if (isNative) {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** "9:00 AM", "11:15am" or "18:30" to hours and minutes. Null if it cannot be read. */
export function parseClockTime(value: string): { hour: number; minute: number } | null {
  const m = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap])?\.?m?\.?$/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] || 0);
  const half = m[3]?.toLowerCase();
  if (half === 'p' && hour < 12) hour += 12;
  if (half === 'a' && hour === 12) hour = 0;
  return hour > 23 || minute > 59 ? null : { hour, minute };
}

/**
 * Sets the phone's reminders to match the settings: one every day at the chosen time, and one
 * on Sunday ten minutes before each service. On the phone these fire with the app closed.
 */
export async function syncReminders(settings: UserSettings, signedIn: boolean): Promise<void> {
  if (!isNative) {
    clearWebReminder();
    if (signedIn && settings.notificationsEnabled) scheduleWebReminder(settings.notificationTime);
    return;
  }
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!signedIn || (await LocalNotifications.checkPermissions()).display !== 'granted') return;

    const notifications = [];
    const daily = settings.notificationsEnabled ? parseClockTime(settings.notificationTime) : null;
    if (daily) {
      notifications.push({ id: DAILY_ID, title: DAILY_TITLE, body: DAILY_BODY, schedule: { on: daily, allowWhileIdle: true } });
    }
    if (settings.sundayReminderEnabled) {
      (settings.serviceTimes || []).slice(0, 4).forEach((time, i) => {
        const t = parseClockTime(time);
        if (!t) return;
        const at = new Date(2000, 0, 2, t.hour, t.minute - 10); // any Sunday; only the clock time is used
        notifications.push({
          id: SUNDAY_ID_BASE + i,
          title: 'Service starts soon',
          body: `Open the app to record today's message${settings.churchName ? ` at ${settings.churchName}` : ''}.`,
          schedule: { on: { weekday: 1, hour: at.getHours(), minute: at.getMinutes() }, allowWhileIdle: true },
        });
      });
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch (e) {
    console.warn('Could not schedule reminders:', e);
  }
}

// ---- Website fallback: only fires while the page is open --------------------
function scheduleWebReminder(timeStr: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const t = parseClockTime(timeStr);
  if (!t) return;
  const fire = () => {
    showWebNotification();
    webTimer = setTimeout(fire, 24 * 60 * 60 * 1000);
  };
  const target = new Date();
  target.setHours(t.hour, t.minute, 0, 0);
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
  webTimer = setTimeout(fire, target.getTime() - Date.now());
}

function clearWebReminder(): void {
  if (webTimer !== null) clearTimeout(webTimer);
  webTimer = null;
}

async function showWebNotification(): Promise<void> {
  const reg = await navigator.serviceWorker?.ready;
  if (reg?.active) {
    reg.active.postMessage({ type: 'SHOW_NOTIFICATION', title: DAILY_TITLE, body: DAILY_BODY, tag: 'daily-study-reminder' });
  } else if (Notification.permission === 'granted') {
    new Notification(DAILY_TITLE, { body: DAILY_BODY, tag: 'daily-study-reminder' });
  }
}
