import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";

/**
 * Configure high-priority Android notification channel.
 * Required on Android 8.0+ (API 26+) for heads-up popup and sound.
 */
export async function setupNotificationChannels() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: "borrowhub_alerts",
      name: "BorrowHub Alerts & Requests",
      description: "Immediate notifications for borrow requests and urgent nearby alerts",
      importance: 5, // IMPORTANCE_HIGH (heads-up banner + sound)
      visibility: 1, // VISIBILITY_PUBLIC (shows on lockscreen)
      vibration: true,
      lights: true,
      lightColor: "#6366F1",
    });
  } catch (err) {
    console.warn("Could not create notification channel:", err);
  }
}

/**
 * Initialize Google FCM Push Notifications on Android APK.
 * Saves the unique device token to the Supabase profiles table.
 */
export async function initPushNotifications(userId, onActionCallback) {
  if (!Capacitor.isNativePlatform() || !userId) return;

  try {
    await setupNotificationChannels();

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive !== "granted") {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive === "granted") {
      await PushNotifications.register();

      // Successfully registered with Google FCM
      PushNotifications.addListener("registration", async (token) => {
        if (token?.value && supabase) {
          try {
            await supabase
              .from("profiles")
              .update({ fcm_token: token.value })
              .eq("id", userId);
          } catch (err) {
            console.warn("Could not save FCM token to Supabase:", err);
          }
        }
      });

      // Handle FCM registration error gracefully
      PushNotifications.addListener("registrationError", (err) => {
        console.warn("Google FCM registration error:", err);
      });

      // When push notification is received while app is active
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        playBorrowRequestChime();
        triggerVibration([200, 100, 200, 100, 300]);
        sendSystemNotification({
          title: notification.title || "BorrowHub Alert",
          body: notification.body || "",
          id: Math.floor(Math.random() * 900000) + 100000,
        });
      });

      // When user taps on the push notification in Android status bar
      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        if (onActionCallback && typeof onActionCallback === "function") {
          onActionCallback(action.notification?.data || action.notification);
        }
      });
    }
  } catch (err) {
    console.warn("Could not initialize PushNotifications:", err);
  }
}

/**
 * Request notification permissions across Native Capacitor and Web platforms.
 */
export async function requestNotificationPermission() {
  try {
    if (Capacitor.isNativePlatform()) {
      await setupNotificationChannels();
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
 * Dispatch an immediate system notification to Android status bar / notification drawer.
 */
export async function sendSystemNotification({ title, body, id }) {
  try {
    if (Capacitor.isNativePlatform()) {
      const notifId = id || Math.floor(Math.random() * 900000) + 100000;
      await setupNotificationChannels();
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: notifId,
            channelId: "borrowhub_alerts",
            isExactNotification: false,
          },
        ],
      });
      return;
    }
  } catch (nativeErr) {
    console.warn("Capacitor LocalNotifications failed:", nativeErr);
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
 * One-tap test function to verify sound, vibration, channel, and status bar notification.
 */
export async function testNotification() {
  playBorrowRequestChime();
  triggerVibration([200, 100, 200, 100, 300]);
  await requestNotificationPermission();
  await sendSystemNotification({
    title: "🔔 BorrowHub Notification Test",
    body: "Notifications, sound chime, and vibration are all working successfully!",
    id: 777777,
  });
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
