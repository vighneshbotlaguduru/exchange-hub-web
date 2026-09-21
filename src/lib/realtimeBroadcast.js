import { supabase } from "./supabase";

/**
 * Reliable broadcast event helper for Supabase Realtime.
 * Safely uses the existing subscribed channel or joins before sending.
 */
export async function broadcastRealtimeEvent(event, payload) {
  if (!supabase) return;
  try {
    const channels = typeof supabase.getChannels === "function" ? supabase.getChannels() : [];
    let ch = channels.find((c) => c.topic === "realtime:dashboard_realtime_feed");

    if (ch && ch.state === "joined") {
      await ch.send({
        type: "broadcast",
        event,
        payload,
      });
    } else {
      ch = ch || supabase.channel("dashboard_realtime_feed");
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          ch.send({
            type: "broadcast",
            event,
            payload,
          });
        }
      });
    }
  } catch (err) {
    console.warn("broadcastRealtimeEvent error:", err);
  }
}
