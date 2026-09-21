import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { supabase } from "../lib/supabase";
import {
  createEmergencyRequest,
  emergencyRadiusKm,
  getEmergencyRequests,
  getItems,
  getMessages,
  getMyListings,
  getMyRequest,
  getMyIncomingRequests,
  getMyOutgoingRequests,
  requestBorrow,
  saveMemberLocation,
  sendMessage,
  submitItem,
  updateRequestStatus,
} from "../services/borrowService";
import {
  playEmergencyChime,
  playBorrowRequestChime,
  sendSystemNotification,
  requestNotificationPermission,
  triggerVibration,
} from "../lib/notificationService";
import { useAuth } from "./useAuth";
import "../styles/UserDashboard.css";

const BLANK_ITEM = { title: "", category: "", duration: 3, image: "", description: "" };
const PRESET_CATEGORIES = [
  "Tools", "Electronics", "Photography", "Events",
  "Books", "Sports", "Kitchen", "Other",
];

export default function UserDashboard() {
  const { user } = useAuth();

  // ---------- Data state ----------
  const [items, setItems] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ---------- UI state ----------
  const [activeTab, setActiveTab] = useState("catalog"); // "catalog" | "incoming" | "outgoing" | "myListings"
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showPost, setShowPost] = useState(false);
  const [form, setForm] = useState(BLANK_ITEM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);

  // ---------- Catalog filters ----------
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // ---------- Chat ----------
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // ---------- Emergency & Notifications ----------
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergency, setEmergency] = useState({ itemTitle: "", phone: "", email: "", note: "" });
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [declinedAlerts, setDeclinedAlerts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("borrowhub_declined_alerts") || "[]");
    } catch {
      return [];
    }
  });
  const [helpingAlert, setHelpingAlert] = useState(null);
  const [activeEmergencyToast, setActiveEmergencyToast] = useState(null);
  const [activeBorrowToast, setActiveBorrowToast] = useState(null);

  useEffect(() => {
    if (user?.email && !emergency.email) {
      setEmergency((prev) => ({ ...prev, email: user.email }));
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Emergency Alert Trigger (Urgent Nearby Need)
  const triggerAlertNotification = (alertData) => {
    if (!alertData) return;
    const title = alertData.itemTitle || alertData.item_title;
    const requesterId = alertData.requesterId || alertData.requester_id;
    if (requesterId && user?.id && requesterId === user.id) return;

    playEmergencyChime();
    triggerVibration([250, 100, 250, 100, 400]);

    const toastAlert = {
      id: alertData.id,
      itemTitle: title,
      note: alertData.note,
      phone: alertData.phone,
      email: alertData.email,
      requesterName: alertData.requesterName || "Nearby Student",
      requesterEmail: alertData.requesterEmail || alertData.email,
    };

    setActiveEmergencyToast(toastAlert);
    setNotice(`🚨 URGENT NEARBY ALERT: Someone urgently needs "${title}"!`);

    sendSystemNotification({
      title: "🚨 BorrowHub Emergency Alert",
      body: `Nearby student needs: "${title}"${alertData.note ? ` (${alertData.note})` : ""}`,
      id: 999,
    });
  };

  // Borrow Request Alert Trigger (Sent to the Item Owner)
  const triggerBorrowRequestAlert = (reqData) => {
    if (!reqData) return;
    if (reqData.borrowerId && user?.id && reqData.borrowerId === user.id) return;

    playBorrowRequestChime();
    triggerVibration([200, 100, 200, 100, 300]);

    const toastData = {
      id: reqData.requestId || reqData.id,
      itemTitle: reqData.itemTitle || "Your Item",
      borrowerName: reqData.borrowerName || "A community member",
      borrowerEmail: reqData.borrowerEmail || "",
    };

    setActiveBorrowToast(toastData);
    setNotice(`📦 NEW BORROW REQUEST: ${toastData.borrowerName} requested to borrow "${toastData.itemTitle}"!`);

    sendSystemNotification({
      title: "📦 BorrowHub: New Borrow Request!",
      body: `${toastData.borrowerName} requested to borrow "${toastData.itemTitle}". Open app to chat & approve.`,
      id: Math.floor(Math.random() * 900000) + 100000,
    });
  };

  // ============================================================
  // Data fetching
  // ============================================================

  const refresh = async () => {
    try {
      const [fetchedItems, fetchedAlerts, fetchedMine, fetchedIncoming, fetchedOutgoing] =
        await Promise.all([
          getItems({ approvedOnly: true }),
          getEmergencyRequests(),
          getMyListings(),
          getMyIncomingRequests(),
          getMyOutgoingRequests(),
        ]);
      setItems(fetchedItems);
      setEmergencyAlerts(fetchedAlerts);
      setMyListings(fetchedMine);
      setIncomingRequests(fetchedIncoming);
      setOutgoingRequests(fetchedOutgoing);
    } catch (e) {
      setError(e.message);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    requestNotificationPermission();

    if (!supabase) return undefined;

    // Realtime channel for instant emergency alerts, request updates, and catalog changes
    const channel = supabase
      .channel("dashboard_realtime_feed")
      .on(
        "broadcast",
        { event: "emergency_alert" },
        (payload) => {
          if (payload.payload) {
            triggerAlertNotification(payload.payload);
          }
          refresh();
        }
      )
      .on(
        "broadcast",
        { event: "new_borrow_request" },
        (payload) => {
          const req = payload.payload;
          if (req && user?.id && req.ownerId === user.id) {
            triggerBorrowRequestAlert(req);
          }
          refresh();
        }
      )
      .on(
        "broadcast",
        { event: "request_status_changed" },
        (payload) => {
          const change = payload.payload;
          if (change && user?.id && (change.borrowerId === user.id || change.ownerId === user.id)) {
            setNotice(`Borrow request for "${change.status}" updated.`);
          }
          refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emergency_requests" },
        (payload) => {
          if (payload.new) {
            triggerAlertNotification(payload.new);
          }
          refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "borrow_requests" },
        (payload) => {
          if (payload.new && user?.id && payload.new.owner_id === user.id) {
            const itm = items.find((x) => x.id === payload.new.listing_id);
            triggerBorrowRequestAlert({
              requestId: payload.new.id,
              itemTitle: itm?.title || "Your Item",
              borrowerName: "A community member",
            });
          }
          refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "borrow_requests" },
        () => {
          refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings" },
        () => {
          refresh();
        }
      )
      .subscribe();

    const timer = window.setInterval(refresh, 10_000);

    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!chat) return undefined;

    const fetchChatMessages = () => {
      getMessages(chat.id)
        .then(setMessages)
        .catch((e) => setError(e.message));
    };

    fetchChatMessages();

    if (!supabase) return undefined;

    // Realtime chat subscription for instant incoming messages
    const chatChannel = supabase
      .channel(`chat_thread_${chat.id}`)
      .on(
        "broadcast",
        { event: "new_message" },
        () => {
          fetchChatMessages();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `borrow_request_id=eq.${chat.id}`,
        },
        () => {
          fetchChatMessages();
        }
      )
      .subscribe();

    // Fast 3s interval polling while chat is open as a failsafe
    const chatTimer = window.setInterval(fetchChatMessages, 3_000);

    return () => {
      window.clearInterval(chatTimer);
      supabase.removeChannel(chatChannel);
    };
  }, [chat]);

  // ============================================================
  // Derived state
  // ============================================================

  const availableItems = useMemo(
    () => items.filter((x) => x.available),
    [items]
  );

  const visibleAlerts = useMemo(
    () => emergencyAlerts.filter((a) => !declinedAlerts.includes(a.id)),
    [emergencyAlerts, declinedAlerts]
  );

  // Dynamic category list built from actual catalog data
  const categories = useMemo(() => {
    const cats = [
      ...new Set(availableItems.map((x) => x.category).filter(Boolean)),
    ].sort();
    return ["All", ...cats];
  }, [availableItems]);

  // Filtered + searched catalog
  const filteredItems = useMemo(() => {
    let result = availableItems;
    if (activeCategory !== "All") {
      result = result.filter((x) => x.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (x) =>
          x.title?.toLowerCase().includes(q) ||
          x.description?.toLowerCase().includes(q) ||
          x.category?.toLowerCase().includes(q) ||
          x.ownerName?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [availableItems, activeCategory, search]);

  const pendingCount = useMemo(
    () => myListings.filter((x) => x.status === "pending").length,
    [myListings]
  );

  const pendingIncomingCount = useMemo(
    () => incomingRequests.filter((x) => x.status === "pending").length,
    [incomingRequests]
  );

  // ============================================================
  // Geolocation helper
  // ============================================================

  const getPosition = async (onSuccess, onFail) => {
    try {
      // First try native Capacitor Geolocation
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted") {
        const requested = await Geolocation.requestPermissions();
        if (requested.location !== "granted") {
          if (onFail) onFail(new Error("Location permission denied."));
          return;
        }
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      });
      onSuccess(pos);
    } catch {
      // Fallback to browser geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(onSuccess, onFail, {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 10_000,
        });
      } else {
        if (onFail) onFail(new Error("Geolocation is not supported on this device."));
      }
    }
  };

  // ============================================================
  // Event handlers
  // ============================================================

  const handleEnableLocation = () => {
    if (!navigator.geolocation) {
      return setError("Location services are not supported by your browser.");
    }
    getPosition(
      async (position) => {
        try {
          await saveMemberLocation(position);
          setLocationEnabled(true);
          setNotice("Location enabled. You will now receive nearby emergency alerts.");
        } catch (e) {
          setError(e.message);
        }
      },
      () => setError("Location permission was denied. Please allow location access and try again.")
    );
  };

  const handleEmergencySend = (e) => {
    e.preventDefault();
    if (!navigator.geolocation) {
      return setError("Location services are not supported by your browser.");
    }
    getPosition(
      async (position) => {
        try {
          const itemTitle = emergency.itemTitle.trim();
          const phone = (emergency.phone || "").trim();
          const email = (emergency.email || "").trim();
          const note = (emergency.note || "").trim();

          const data = await createEmergencyRequest({ itemTitle, note, phone, email, location: position });
          
          // Broadcast to all active users on the realtime channel for immediate alert
          if (supabase) {
            try {
              supabase.channel("dashboard_realtime_feed").send({
                type: "broadcast",
                event: "emergency_alert",
                payload: {
                  id: data.requestId,
                  itemTitle,
                  note,
                  phone,
                  email,
                  requesterId: user?.id,
                  requesterName: user?.name,
                },
              });
            } catch {
              // Channel broadcast fallback
            }
          }

          setLocationEnabled(true);
          setShowEmergency(false);
          setEmergency({ itemTitle: "", phone: "", email: user?.email || "", note: "" });
          await refresh();
          setNotice(
            `Emergency alert sent to ${data.recipientCount} nearby member${data.recipientCount !== 1 ? "s" : ""}.`
          );
        } catch (x) {
          setError(x.message);
        }
      },
      () => setError("Location permission was denied. Please allow location access and try again.")
    );
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setError("");
    try {
      await submitItem(form);
      setForm(BLANK_ITEM);
      setShowPost(false);
      await refresh();
      setNotice("Item submitted! An admin will review it before it appears in the catalog.");
    } catch (x) {
      setError(x.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleBorrow = async (item) => {
    if (item.owner_id === user?.id) {
      return setError("You cannot borrow your own item.");
    }
    setError("");
    try {
      let req = await getMyRequest(item.id);
      if (!req) req = await requestBorrow(item);
      await refresh();
      setChat(req);
      setNotice("Borrow request sent! Chat with the owner to arrange pickup.");
    } catch (x) {
      setError(x.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!draft.trim() || !chat) return;
    setSendingMsg(true);
    try {
      await sendMessage(chat.id, draft.trim());
      setDraft("");
      setMessages(await getMessages(chat.id));
    } catch (x) {
      setError(x.message);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleCloseChat = () => {
    setChat(null);
    setMessages([]);
    setDraft("");
  };

  const handleDeclineAlert = (alertId) => {
    const updated = [...declinedAlerts, alertId];
    setDeclinedAlerts(updated);
    try {
      localStorage.setItem("borrowhub_declined_alerts", JSON.stringify(updated));
    } catch {}
    setNotice("Alert declined and removed from your nearby list.");
  };

  const handleAcceptAlert = (alertItem) => {
    setHelpingAlert(alertItem);

    const isMobileOrApp = Capacitor.isNativePlatform() || /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    const cleanPhone = (alertItem.phone || "").replace(/[^\d+]/g, "");
    const targetEmail = alertItem.email || alertItem.requesterEmail || (alertItem.requesterName?.includes("@") ? alertItem.requesterName : `${alertItem.requesterName || "student"}@srmist.edu.in`);

    if (isMobileOrApp && cleanPhone) {
      // In APK or mobile phone -> immediately redirect to native phone dialer
      window.location.href = `tel:${cleanPhone}`;
    } else if (!isMobileOrApp && targetEmail) {
      // On laptop / desktop -> immediately redirect to mail client
      const subject = encodeURIComponent(`BorrowHub Emergency: I can lend you "${alertItem.itemTitle}"`);
      const body = encodeURIComponent(`Hi ${alertItem.requesterName},\n\nI saw your nearby emergency request for "${alertItem.itemTitle}" on BorrowHub and I can help!\n\nWhere on campus can we meet to hand it over?\n\nBest,\n${user?.name || "Fellow SRMIST Student"}`);
      window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`;
    }
  };

  const handleCloseHelping = () => {
    setHelpingAlert(null);
  };

  // Owner action handlers for item borrow requests
  const handleApproveBorrow = async (requestId) => {
    setActionInProgress(requestId);
    setError("");
    try {
      await updateRequestStatus(requestId, "accepted");
      await refresh();
      setNotice("Borrow request approved! The borrower has been notified.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeclineBorrow = async (requestId) => {
    setActionInProgress(requestId);
    setError("");
    try {
      await updateRequestStatus(requestId, "rejected");
      await refresh();
      setNotice("Borrow request declined.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleMarkReturned = async (requestId) => {
    setActionInProgress(requestId);
    setError("");
    try {
      await updateRequestStatus(requestId, "returned");
      await refresh();
      setNotice("Item marked as returned! It is now available again in the campus catalog.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleOpenChatForRequest = (req) => {
    const isOwner = req.owner_id === user?.id || req.itemOwnerId === user?.id;
    setChat({
      id: req.id,
      itemTitle: req.itemTitle || req.listing?.title || "Borrow Item",
      ownerName: isOwner ? (req.borrowerName || req.borrower?.name || "Requester") : (req.ownerName || req.listing?.owner?.name || "Owner"),
    });
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="ud-root">

      {/* ── Realtime Emergency Alert Toast / Pop-up (Instant APK Alert) ─── */}
      {activeEmergencyToast && (
        <div style={{
          position: "fixed",
          top: "1rem",
          left: "1rem",
          right: "1rem",
          maxWidth: "520px",
          margin: "0 auto",
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          color: "#ffffff",
          padding: "1.1rem 1.25rem",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 0 2px #ef4444",
          zIndex: 100000,
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
          animation: "modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.4rem" }}>🚨</span>
              <strong style={{ color: "#f87171", fontSize: "0.95rem", letterSpacing: "0.02em" }}>
                URGENT CAMPUS ALERT
              </strong>
            </div>
            <button
              onClick={() => setActiveEmergencyToast(null)}
              style={{
                background: "transparent",
                border: 0,
                color: "#94a3b8",
                fontSize: "1.2rem",
                cursor: "pointer",
                padding: "0 0.3rem",
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#f1f5f9", lineHeight: 1.45 }}>
            <strong>{activeEmergencyToast.requesterName}</strong> urgently needs <strong>"{activeEmergencyToast.itemTitle}"</strong>!
            {activeEmergencyToast.note && (
              <span style={{ display: "block", color: "#cbd5e1", fontSize: "0.82rem", marginTop: "0.25rem", fontStyle: "italic" }}>
                "{activeEmergencyToast.note}"
              </span>
            )}
          </p>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
            <button
              onClick={() => {
                handleAcceptAlert(activeEmergencyToast);
                setActiveEmergencyToast(null);
              }}
              style={{
                background: "#059669",
                color: "#ffffff",
                border: 0,
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "0.88rem",
                cursor: "pointer",
                flex: 1,
                boxShadow: "0 4px 12px rgba(5, 150, 105, 0.4)",
              }}
            >
              📞 Accept & Connect (Call / Email)
            </button>
            <button
              onClick={() => setActiveEmergencyToast(null)}
              style={{
                background: "#334155",
                color: "#cbd5e1",
                border: 0,
                padding: "0.6rem 0.85rem",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Realtime Borrow Request Notification Toast (Owner Alert) ─── */}
      {activeBorrowToast && (
        <div style={{
          position: "fixed",
          top: activeEmergencyToast ? "9.5rem" : "1rem",
          left: "1rem",
          right: "1rem",
          maxWidth: "520px",
          margin: "0 auto",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
          color: "#ffffff",
          padding: "1.1rem 1.25rem",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 0 2px #6366f1",
          zIndex: 100000,
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
          animation: "modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.4rem" }}>📦</span>
              <strong style={{ color: "#a5b4fc", fontSize: "0.95rem", letterSpacing: "0.02em" }}>
                NEW BORROW REQUEST FOR YOUR ITEM!
              </strong>
            </div>
            <button
              onClick={() => setActiveBorrowToast(null)}
              style={{
                background: "transparent",
                border: 0,
                color: "#94a3b8",
                fontSize: "1.2rem",
                cursor: "pointer",
                padding: "0 0.3rem",
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#f1f5f9", lineHeight: 1.45 }}>
            <strong>{activeBorrowToast.borrowerName}</strong> requested to borrow <strong>"{activeBorrowToast.itemTitle}"</strong>.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
            <button
              onClick={() => {
                setActiveTab("incoming");
                setActiveBorrowToast(null);
              }}
              style={{
                background: "#4f46e5",
                color: "#ffffff",
                border: 0,
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "0.88rem",
                cursor: "pointer",
                flex: 1,
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
              }}
            >
              View &amp; Manage Request
            </button>
            <button
              onClick={() => setActiveBorrowToast(null)}
              style={{
                background: "#334155",
                color: "#cbd5e1",
                border: 0,
                padding: "0.6rem 0.85rem",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile & Desktop Modern App Hero ─────────────────── */}
      <div className="ud-hero-banner">
        <div className="ud-hero-top">
          <span className="ud-badge-pill">
            <span className="ud-badge-dot"></span>
            SRMIST Peer-to-Peer Hub
          </span>
          <button
            type="button"
            className={`ud-hero-btn-gps ${locationEnabled ? "gps-on" : ""}`}
            onClick={handleEnableLocation}
            title={locationEnabled ? "Campus GPS location active" : "Enable GPS for nearby emergency alerts"}
          >
            {locationEnabled ? "📍 GPS Active" : "📍 Enable Location"}
          </button>
        </div>

        <div className="ud-hero-text">
          <h1 className="ud-hero-title">
            Hey, {user?.name ? user.name.split(" ")[0] : "Student"} 👋
          </h1>
          <p className="ud-hero-subtitle">
            Borrow gadgets, tools &amp; lab gear from classmates, or share with campus.
          </p>
        </div>

        <div className="ud-hero-actions">
          <button
            type="button"
            className={`ud-hero-btn ud-hero-btn-post ${showPost ? "active" : ""}`}
            onClick={() => setShowPost((v) => !v)}
          >
            {showPost ? "✕ Close Form" : "＋ Post an Item"}
          </button>
          <button
            type="button"
            className={`ud-hero-btn ud-hero-btn-sos ${showEmergency ? "active" : ""}`}
            onClick={() => setShowEmergency((v) => !v)}
          >
            {showEmergency ? "✕ Close SOS" : "🚨 Emergency SOS"}
          </button>
        </div>
      </div>

      {/* ── Global notices ───────────────────────────────────── */}
      {error && (
        <div className="alert alert-danger ud-notice" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert alert-success ud-notice fade-in" role="status">
          {notice}
        </div>
      )}

      {/* ── Emergency request panel ──────────────────────────── */}
      {showEmergency && (
        <section className="ud-panel emergency-panel fade-in">
          <div className="emergency-panel-info">
            <p className="eyebrow">15-minute community alert</p>
            <h2>Need something urgently?</h2>
            <p>
              We will alert location-enabled members within {emergencyRadiusKm} km.
              Provide your phone and email so responders can immediately call (on APK) or email (on Laptop).
            </p>
          </div>
          <form className="emergency-form" onSubmit={handleEmergencySend}>
            <div className="form-field">
              <label htmlFor="em-item">
                Item needed <span className="req-star">*</span>
              </label>
              <input
                id="em-item"
                value={emergency.itemTitle}
                onChange={(e) => setEmergency({ ...emergency, itemTitle: e.target.value })}
                placeholder="e.g. Scientific Calculator, USB-C Charger, Lab Coat"
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.85rem" }}>
              <div className="form-field">
                <label htmlFor="em-phone">
                  Mobile number <span className="req-star">*</span>
                  <span style={{ fontSize: "0.72rem", color: "#059669", fontWeight: "600" }}>(Direct call on APK/phone)</span>
                </label>
                <input
                  id="em-phone"
                  type="tel"
                  value={emergency.phone}
                  onChange={(e) => setEmergency({ ...emergency, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="em-email">
                  Contact email <span className="req-star">*</span>
                  <span style={{ fontSize: "0.72rem", color: "#2563eb", fontWeight: "600" }}>(Direct mail on laptop)</span>
                </label>
                <input
                  id="em-email"
                  type="email"
                  value={emergency.email}
                  onChange={(e) => setEmergency({ ...emergency, email: e.target.value })}
                  placeholder="e.g. yourname@srmist.edu.in"
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="em-note">Campus location & details</label>
              <input
                id="em-note"
                value={emergency.note}
                onChange={(e) => setEmergency({ ...emergency, note: e.target.value })}
                placeholder="e.g. Tech Park 4th floor, Room 402, exam in 20 mins"
              />
            </div>

            <button className="btn emergency-button" type="submit">
              🚨 Broadcast emergency alert
            </button>
          </form>
        </section>
      )}

      {/* ── Metric cards ─────────────────────────────────────── */}
      <div className="ud-metrics">
        <div
          className={`metric-card ${activeTab === "catalog" ? "metric-highlight" : ""}`}
          onClick={() => setActiveTab("catalog")}
          style={{ cursor: "pointer" }}
        >
          <span>Catalog Available</span>
          <strong>{dataLoading ? "\u2014" : availableItems.length}</strong>
        </div>
        <div
          className={`metric-card ${pendingIncomingCount > 0 ? "metric-highlight" : ""}`}
          onClick={() => setActiveTab("incoming")}
          style={{ cursor: "pointer" }}
        >
          <span>Requests for My Items</span>
          <strong className={pendingIncomingCount > 0 ? "pending-text" : ""}>
            {dataLoading ? "\u2014" : pendingIncomingCount > 0 ? `${pendingIncomingCount} Action Needed` : incomingRequests.length}
          </strong>
        </div>
        <div
          className={`metric-card ${activeTab === "outgoing" ? "metric-highlight" : ""}`}
          onClick={() => setActiveTab("outgoing")}
          style={{ cursor: "pointer" }}
        >
          <span>My Borrowed / Requests</span>
          <strong>{dataLoading ? "\u2014" : outgoingRequests.length}</strong>
        </div>
        <div
          className={`metric-card ${activeTab === "myListings" ? "metric-highlight" : ""}`}
          onClick={() => setActiveTab("myListings")}
          style={{ cursor: "pointer" }}
        >
          <span>My Posted Items</span>
          <strong className={pendingCount > 0 ? "pending-text" : ""}>
            {dataLoading ? "\u2014" : myListings.length}
          </strong>
        </div>
      </div>

      {/* ── Dashboard Navigation Tabs ────────────────────────── */}
      <div className="ud-tabs-nav" role="tablist">
        <button
          type="button"
          className={`ud-tab-btn ${activeTab === "catalog" ? "active" : ""}`}
          onClick={() => setActiveTab("catalog")}
        >
          🔍 Browse Catalog ({availableItems.length})
        </button>
        <button
          type="button"
          className={`ud-tab-btn ${activeTab === "incoming" ? "active" : ""}`}
          onClick={() => setActiveTab("incoming")}
        >
          📥 Requests for My Items
          {pendingIncomingCount > 0 && (
            <span className="ud-tab-badge-urgent">{pendingIncomingCount} new</span>
          )}
        </button>
        <button
          type="button"
          className={`ud-tab-btn ${activeTab === "outgoing" ? "active" : ""}`}
          onClick={() => setActiveTab("outgoing")}
        >
          📤 My Borrowed Items ({outgoingRequests.length})
        </button>
        <button
          type="button"
          className={`ud-tab-btn ${activeTab === "myListings" ? "active" : ""}`}
          onClick={() => setActiveTab("myListings")}
        >
          🏷️ My Posted Items ({myListings.length})
        </button>
      </div>

      {/* ── Active emergency inbox ───────────────────────────── */}
      {visibleAlerts.length > 0 && (
        <section className="ud-panel emergency-inbox fade-in">
          <div className="emergency-inbox-header">
            <h2 className="emergency-inbox-title">🚨 Active nearby alerts</h2>
            <span className="emergency-count-badge">{visibleAlerts.length} active</span>
          </div>
          <div className="emergency-list">
            {visibleAlerts.map((a) => {
              const isMine = a.requesterId && user?.id && a.requesterId === user.id;
              return (
                <div className="emergency-alert-row" key={a.id}>
                  <div className="emergency-alert-info">
                    <div className="emergency-alert-title-row">
                      <strong>{a.itemTitle}</strong>
                      {isMine ? (
                        <span className="alert-badge-mine">Your request</span>
                      ) : (
                        <span className="alert-badge-nearby">Nearby request</span>
                      )}
                    </div>
                    <span>
                      {isMine ? "You requested this nearby" : `${a.requesterName} needs this nearby`}
                      {a.note ? ` — "${a.note}"` : ""}
                    </span>
                    {(a.phone || a.email) && (
                      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                        {a.phone && (
                          <span style={{ fontSize: "0.74rem", background: "#ecfdf5", color: "#065f46", padding: "0.15rem 0.45rem", borderRadius: "4px", fontWeight: "600" }}>
                            📞 {a.phone}
                          </span>
                        )}
                        {a.email && (
                          <span style={{ fontSize: "0.74rem", background: "#eff6ff", color: "#1e40af", padding: "0.15rem 0.45rem", borderRadius: "4px", fontWeight: "600" }}>
                            ✉️ {a.email}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="emergency-alert-right">
                    <span className="emergency-timer">
                      ⏱ {Math.max(1, Math.ceil((a.expiresAt - Date.now()) / 60_000))} min left
                    </span>
                    <div className="emergency-actions">
                      {!isMine ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-success"
                            onClick={() => handleAcceptAlert(a)}
                          >
                            Accept & Connect
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleDeclineAlert(a.id)}
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleDeclineAlert(a.id)}
                          title="Dismiss from list"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Post an item form ────────────────────────────────── */}
      {showPost && (
        <section className="ud-panel post-panel fade-in">
          <div className="post-panel-header">
            <h2>Post an item for borrowing</h2>
            <p>
              Fill in the details below. Your item will be reviewed by an admin
              before appearing in the catalog.
            </p>
          </div>
          <form className="post-form" onSubmit={handlePostSubmit} noValidate>
            <div className="post-form-grid">

              {/* Product name */}
              <div className="form-field">
                <label htmlFor="pf-title">
                  Product name <span className="req-star">*</span>
                </label>
                <input
                  id="pf-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Fujifilm X-T30 camera"
                  required
                  disabled={formSubmitting}
                />
              </div>

              {/* Category */}
              <div className="form-field">
                <label htmlFor="pf-category">
                  Category <span className="req-star">*</span>
                </label>
                <select
                  id="pf-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  required
                  disabled={formSubmitting}
                >
                  <option value="" disabled>Select a category...</option>
                  {PRESET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Max duration */}
              <div className="form-field">
                <label htmlFor="pf-duration">
                  Max borrow duration <span className="req-star">*</span>
                  <span className="field-hint">(days, 1–60)</span>
                </label>
                <input
                  id="pf-duration"
                  type="number"
                  min="1"
                  max="60"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  required
                  disabled={formSubmitting}
                />
              </div>

              {/* Photo URL */}
              <div className="form-field">
                <label htmlFor="pf-image">
                  Photo URL <span className="req-star">*</span>
                  <span className="field-hint">(must start with https://)</span>
                </label>
                <input
                  id="pf-image"
                  type="url"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="https://example.com/photo.jpg"
                  required
                  disabled={formSubmitting}
                />
              </div>

              {/* Description */}
              <div className="form-field form-field--full">
                <label htmlFor="pf-description">
                  Description <span className="req-star">*</span>
                </label>
                <textarea
                  id="pf-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the item: what is included, condition, how to use it..."
                  rows={4}
                  required
                  disabled={formSubmitting}
                />
              </div>
            </div>

            {/* Image preview */}
            {form.image && (
              <div className="post-preview">
                <img
                  src={form.image}
                  alt="Preview"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </div>
            )}

            <div className="post-form-actions">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={formSubmitting}
              >
                {formSubmitting ? "Submitting..." : "Submit for approval"}
              </button>
              <button
                className="btn btn-outline-secondary"
                type="button"
                disabled={formSubmitting}
                onClick={() => { setForm(BLANK_ITEM); setShowPost(false); }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Catalog Panel ──────────────────────────────────── */}
      {activeTab === "catalog" && (
        <section className="ud-panel catalog-panel fade-in">
          <div className="catalog-header">
            <div>
              <h2>Borrowing catalog</h2>
              <p className="catalog-subtitle">
                Browse approved items available from the campus community.
              </p>
            </div>
          </div>

          {/* Search + category filters */}
          <div className="catalog-controls">
            <div className="catalog-search-wrap">
              <span className="search-icon" aria-hidden="true">&#128269;</span>
              <input
                className="catalog-search-input"
                type="search"
                placeholder="Search items, descriptions, categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search catalog"
              />
              {search && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  &#10005;
                </button>
              )}
            </div>
            {categories.length > 1 && (
              <div className="category-filters" role="group" aria-label="Filter by category">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-pill ${activeCategory === cat ? "cat-pill--active" : ""}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Result summary */}
          {!dataLoading && availableItems.length > 0 && (
            <p className="catalog-count">
              {filteredItems.length === availableItems.length
                ? `${availableItems.length} item${availableItems.length !== 1 ? "s" : ""} available`
                : `${filteredItems.length} of ${availableItems.length} items`}
            </p>
          )}

          {/* Loading state */}
          {dataLoading && (
            <div className="catalog-state">
              <div className="catalog-spinner" />
              <p>Loading catalog...</p>
            </div>
          )}

          {/* Empty state */}
          {!dataLoading && filteredItems.length === 0 && (
            <div className="catalog-state">
              <span className="catalog-empty-icon" aria-hidden="true">&#128230;</span>
              <p className="catalog-empty-title">
                {search || activeCategory !== "All"
                  ? "No items match your filters."
                  : "No items available right now."}
              </p>
              <p className="catalog-empty-sub">
                {search || activeCategory !== "All"
                  ? "Try a different search term or category."
                  : "Check back soon or post your own item above."}
              </p>
              {(search || activeCategory !== "All") && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  style={{ marginTop: "0.75rem" }}
                  onClick={() => { setSearch(""); setActiveCategory("All"); }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Item grid */}
          {!dataLoading && filteredItems.length > 0 && (
            <div className="borrow-grid">
              {filteredItems.map((item) => {
                const isOwn = item.owner_id === user?.id;
                return (
                  <article className="borrow-card card-lift" key={item.id}>
                    <div className="borrow-card-img-wrap">
                      <img
                        className="borrow-card-img"
                        src={item.image}
                        alt={item.title}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                      {item.category && (
                        <span className="borrow-card-cat">{item.category}</span>
                      )}
                      <span className="borrow-card-avail-badge">
                        ● Available
                      </span>
                    </div>
                    <div className="borrow-card-body">
                      <h3 className="borrow-card-title">{item.title}</h3>
                      <p className="borrow-card-desc">{item.description}</p>
                      <div className="borrow-card-owner-meta">
                        <span className="owner-avatar-icon">👤</span>
                        <span className="owner-name-text">{item.ownerName}</span>
                      </div>
                    </div>
                    <div className="borrow-card-footer">
                      <span className="borrow-card-duration">
                        ⏱️ Up to <strong>{item.duration}d</strong>
                      </span>
                      {isOwn ? (
                        <span className="borrow-card-own-badge">Your item</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm borrow-btn"
                          onClick={() => handleBorrow(item)}
                        >
                          Request &amp; Chat →
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Requests for My Items Panel ───────────────────────── */}
      {activeTab === "incoming" && (
        <section className="ud-panel requests-panel fade-in">
          <div className="catalog-header">
            <div>
              <h2>📥 Requests for My Items</h2>
              <p className="catalog-subtitle">
                Review and approve borrow requests from campus peers, chat directly to coordinate pickup, and mark items returned when they are handed back.
              </p>
            </div>
          </div>

          {incomingRequests.length === 0 ? (
            <div className="catalog-state">
              <span className="catalog-empty-icon" aria-hidden="true">📭</span>
              <p className="catalog-empty-title">No borrow requests yet</p>
              <p className="catalog-empty-sub">
                When fellow students request to borrow any of your posted items, their requests will appear here for you to chat, approve, and manage returns.
              </p>
            </div>
          ) : (
            <div className="requests-cards-list">
              {incomingRequests.map((req) => {
                const isPending = req.status === "pending";
                const isAccepted = req.status === "accepted";
                const isReturned = req.status === "returned";
                const isRejected = req.status === "rejected";
                const isProcessing = actionInProgress === req.id;

                return (
                  <article className="borrow-request-card" key={req.id}>
                    {req.listing?.image && (
                      <img
                        className="req-card-img"
                        src={req.listing.image}
                        alt={req.itemTitle || "Item"}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                    <div className="req-card-content">
                      <div className="req-card-header">
                        <h3 className="req-card-title">{req.itemTitle || req.listing?.title || "Requested Item"}</h3>
                        <span className={`status-pill status-${req.status}`}>
                          {isPending && "⏳ Pending Your Approval"}
                          {isAccepted && "🤝 On Loan (Approved)"}
                          {isReturned && "✅ Returned & Available"}
                          {isRejected && "❌ Declined"}
                        </span>
                      </div>

                      <p className="req-card-borrower">
                        Requested by <strong>{req.borrowerName}</strong> ({req.borrowerEmail})
                        {req.createdAt && (
                          <span style={{ display: "block", fontSize: "0.78rem", color: "#64748b", marginTop: "0.15rem" }}>
                            Requested on {new Date(req.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </p>

                      {isAccepted && (
                        <p className="req-card-hint-loaned">
                          📦 <strong>Item on loan:</strong> Coordinate return with {req.borrowerName}. Once you have your item back, click <strong>"Mark as Returned"</strong> below to make it available again in the catalog.
                        </p>
                      )}

                      {isReturned && (
                        <p className="req-card-hint-accepted">
                          ✓ <strong>Completed:</strong> This item was marked as returned and is now available in the community catalog.
                        </p>
                      )}

                      <div className="req-card-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleOpenChatForRequest(req)}
                          title="Chat with requester"
                        >
                          💬 Chat with Borrower
                        </button>

                        {isPending && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              disabled={isProcessing}
                              onClick={() => handleApproveBorrow(req.id)}
                            >
                              {isProcessing ? "Updating..." : "✅ Approve Request"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              style={{ color: "#dc2626", borderColor: "#fca5a5" }}
                              disabled={isProcessing}
                              onClick={() => handleDeclineBorrow(req.id)}
                            >
                              {isProcessing ? "Updating..." : "✕ Decline"}
                            </button>
                          </>
                        )}

                        {isAccepted && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={isProcessing}
                            onClick={() => handleMarkReturned(req.id)}
                          >
                            {isProcessing ? "Updating..." : "🔄 Mark as Returned"}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── My Borrowed Items & Requests Panel ────────────────── */}
      {activeTab === "outgoing" && (
        <section className="ud-panel requests-panel fade-in">
          <div className="catalog-header">
            <div>
              <h2>📤 My Borrowed Items &amp; Requests</h2>
              <p className="catalog-subtitle">
                Items you have requested to borrow from other campus students.
              </p>
            </div>
          </div>

          {outgoingRequests.length === 0 ? (
            <div className="catalog-state">
              <span className="catalog-empty-icon" aria-hidden="true">🎒</span>
              <p className="catalog-empty-title">No borrow requests made yet</p>
              <p className="catalog-empty-sub">
                Explore the catalog and request items you need for classes, projects, or hobbies.
              </p>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ marginTop: "0.75rem" }}
                onClick={() => setActiveTab("catalog")}
              >
                Browse Catalog
              </button>
            </div>
          ) : (
            <div className="requests-cards-list">
              {outgoingRequests.map((req) => {
                const isPending = req.status === "pending";
                const isAccepted = req.status === "accepted";
                const isReturned = req.status === "returned";
                const isRejected = req.status === "rejected";

                return (
                  <article className="borrow-request-card" key={req.id}>
                    {req.listing?.image && (
                      <img
                        className="req-card-img"
                        src={req.listing.image}
                        alt={req.itemTitle || "Item"}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                    <div className="req-card-content">
                      <div className="req-card-header">
                        <h3 className="req-card-title">{req.itemTitle || req.listing?.title || "Item"}</h3>
                        <span className={`status-pill status-${req.status}`}>
                          {isPending && "⏳ Awaiting Owner Approval"}
                          {isAccepted && "🎉 Approved! Ready for Pickup"}
                          {isReturned && "✅ Returned"}
                          {isRejected && "❌ Declined"}
                        </span>
                      </div>

                      <p className="req-card-borrower">
                        Owner: <strong>{req.ownerName}</strong> ({req.ownerEmail})
                      </p>

                      {isPending && (
                        <p className="req-card-hint-loaned">
                          ⏳ Waiting for {req.ownerName} to approve your request. Chat with them to arrange pickup!
                        </p>
                      )}

                      {isAccepted && (
                        <p className="req-card-hint-accepted">
                          🎉 {req.ownerName} approved your request! Coordinate pickup and remember to return on time.
                        </p>
                      )}

                      <div className="req-card-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenChatForRequest(req)}
                        >
                          💬 Chat with Owner
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── My Posted Items Panel ─────────────────────────────── */}
      {activeTab === "myListings" && (
        <section className="ud-panel listings-panel fade-in">
          <div className="catalog-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2>🏷️ My Posted Items</h2>
              <p className="catalog-subtitle">
                Manage the items you've shared with the campus community.
              </p>
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowPost(true)}
            >
              + Post New Item
            </button>
          </div>

          {myListings.length === 0 ? (
            <div className="catalog-state">
              <span className="catalog-empty-icon" aria-hidden="true">📦</span>
              <p className="catalog-empty-title">You haven't posted any items yet</p>
              <p className="catalog-empty-sub">
                Help fellow students by sharing gadgets, textbooks, lab equipment, or tools.
              </p>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ marginTop: "0.75rem" }}
                onClick={() => setShowPost(true)}
              >
                + Post Your First Item
              </button>
            </div>
          ) : (
            <div className="borrow-grid">
              {myListings.map((item) => (
                <article className="borrow-card" key={item.id}>
                  <div className="borrow-card-img-wrap">
                    <img className="borrow-card-img" src={item.image} alt={item.title} />
                    {item.category && <span className="borrow-card-cat">{item.category}</span>}
                  </div>
                  <div className="borrow-card-body">
                    <h3 className="borrow-card-title">{item.title}</h3>
                    <p className="borrow-card-desc">{item.description}</p>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                      <span className={`status-pill status-${item.status === "approved" ? "accepted" : "pending"}`}>
                        {item.status === "approved" ? "✓ Admin Approved" : "⏳ Pending Review"}
                      </span>
                      <span className={`status-pill status-${item.available ? "returned" : "declined"}`}>
                        {item.available ? "🟢 Available" : "🟠 Currently Borrowed"}
                      </span>
                    </div>
                  </div>
                  <div className="borrow-card-footer">
                    <span className="borrow-card-duration">Max <strong>{item.duration} days</strong></span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Chat panel ───────────────────────────────────────── */}
      {chat && (
        <section className="chat-panel fade-in" aria-label="Borrow request chat">
          <div className="chat-head">
            <div className="chat-head-info">
              <span className="chat-head-eyebrow">Borrow request</span>
              <h2 className="chat-head-title">{chat.itemTitle}</h2>
              <p className="chat-head-sub">
                Chat with {chat.ownerName} to arrange pickup and return.
              </p>
            </div>
            <button
              className="btn-close"
              aria-label="Close chat"
              onClick={handleCloseChat}
            />
          </div>

          <div className="chat-messages-area">
            {messages.length === 0 ? (
              <p className="chat-empty-msg">
                No messages yet. Say hi to get started!
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.sender === user?.name;
                return (
                  <div
                    key={m.id}
                    className={`chat-bubble ${mine ? "chat-bubble--mine" : "chat-bubble--theirs"}`}
                  >
                    <div className="chat-bubble-meta">
                      <span className="chat-bubble-sender">{m.sender}</span>
                      <time className="chat-bubble-time">{m.time}</time>
                    </div>
                    <p className="chat-bubble-body">{m.text}</p>
                  </div>
                );
              })
            )}
          </div>

          <form className="chat-compose" onSubmit={handleSendMessage}>
            <input
              className="chat-compose-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${chat.ownerName}...`}
              disabled={sendingMsg}
              aria-label="Message input"
            />
            <button
              className="btn btn-primary chat-compose-btn"
              type="submit"
              disabled={sendingMsg || !draft.trim()}
            >
              {sendingMsg ? "..." : "Send"}
            </button>
          </form>
        </section>
      )}

      {/* ── Help with emergency request modal ────────────────── */}
      {helpingAlert && (
        <div className="emergency-modal-backdrop" onClick={handleCloseHelping}>
          <div className="emergency-modal" onClick={(e) => e.stopPropagation()}>
            <div className="emergency-modal-header">
              <span className="eyebrow">Emergency community assistance</span>
              <h3>Lend "{helpingAlert.itemTitle}"</h3>
            </div>
            <div className="emergency-modal-body">
              <p>
                <strong>{helpingAlert.requesterName}</strong> urgently needs this nearby on campus.
              </p>
              {helpingAlert.note && (
                <div className="emergency-note-box">
                  <span className="note-label">Campus Location & Note:</span>
                  <p>"{helpingAlert.note}"</p>
                </div>
              )}
              <div className="emergency-contact-box">
                <p className="contact-label">Contact {helpingAlert.requesterName} directly:</p>
                <div className="contact-actions" style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                  {helpingAlert.phone && (
                    <a
                      href={`tel:${helpingAlert.phone.replace(/[^\d+]/g, "")}`}
                      className="btn btn-success w-100"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.55rem",
                        fontWeight: "700",
                        padding: "0.75rem 1rem",
                        textDecoration: "none",
                        background: "#059669",
                        color: "#ffffff",
                        borderRadius: "8px",
                      }}
                    >
                      <span style={{ fontSize: "1.1rem" }}>📞</span>
                      <span>Call {helpingAlert.phone} (Phone Dialer)</span>
                    </a>
                  )}
                  <a
                    href={`mailto:${helpingAlert.email || helpingAlert.requesterEmail || (helpingAlert.requesterName.includes('@') ? helpingAlert.requesterName : `${helpingAlert.requesterName}@srmist.edu.in`)}?subject=${encodeURIComponent(`BorrowHub: I have ${helpingAlert.itemTitle} for you!`)}&body=${encodeURIComponent(`Hi ${helpingAlert.requesterName},\n\nI saw your nearby emergency alert for "${helpingAlert.itemTitle}" on BorrowHub and I can lend it to you!\n\nWhere on campus can we meet to hand it over?\n\nBest,\n${user?.name || "Fellow SRMIST Student"}`)}`}
                    className="btn btn-primary w-100"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.55rem",
                      fontWeight: "700",
                      padding: "0.75rem 1rem",
                      textDecoration: "none",
                      background: "#2563eb",
                      color: "#ffffff",
                      borderRadius: "8px",
                    }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>✉️</span>
                    <span>Email {helpingAlert.email || helpingAlert.requesterEmail || `${helpingAlert.requesterName}@srmist.edu.in`}</span>
                  </a>
                </div>
              </div>
            </div>
            <div className="emergency-modal-footer">
              <button
                type="button"
                className="btn btn-success"
                onClick={() => {
                  handleDeclineAlert(helpingAlert.id);
                  handleCloseHelping();
                  setNotice(`Thank you for helping ${helpingAlert.requesterName}!`);
                }}
              >
                ✓ I've Contacted Them
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={handleCloseHelping}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
