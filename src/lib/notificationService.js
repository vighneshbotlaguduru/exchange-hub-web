import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

/**
 * Request notification permissions across Native Capacitor and Web platforms.
 */
export async function requestNotificationPermission() {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        await LocalNotifications.requestPermissions();
      }
    } else if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
    }
  } catch (err) {
    console.warn("Could not request notification permissions:", err);
  }
}

/**
 * Dispatch a system notification (shows in Android status bar / notification shade).
 */
export async function sendSystemNotification({ title, body, id }) {
  try {
    if (Capacitor.isNativePlatform()) {
      const notifId = id || Math.floor(Math.random() * 900000) + 100000;
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: notifId,
            schedule: { at: new Date(Date.now() + 100) },
            sound: undefined,
            actionTypeId: "",
            extra: null,
          },
        ],
      });
      return;
    }
  } catch (nativeErr) {
    console.warn("Capacitor LocalNotifications failed, falling back to Web Notification:", nativeErr);
  }

  // Fallback to Web Notification API (Desktop / Mobile Browser)
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
      });
    } catch {
      // Ignored if browser blocks background notifications
    }
  }
}

/**
 * Urgent dual-frequency emergency chime (920Hz / 1240Hz sawtooth).
 */
export function playEmergencyChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [0, 0.16, 0.32].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(idx % 2 === 0 ? 920 : 1240, now + offset);
      gain.gain.setValueAtTime(0.25, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.14);
    });
  } catch {
    // Audio playback blocked or unsupported
  }
}

/**
 * Melodic borrow request chime (pleasant double-tone sine wave: D5 / A5).
 */
export function playBorrowRequestChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [
      { freq: 587.33, start: 0, dur: 0.18 },   // D5
      { freq: 880.00, start: 0.16, dur: 0.26 }  // A5
    ].forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);
      gain.gain.setValueAtTime(0.22, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tone.start + tone.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur);
    });
  } catch {
    // Audio playback blocked or unsupported
  }
}

/**
 * Hardware vibration trigger.
 */
export function triggerVibration(pattern = [200, 100, 200]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}
