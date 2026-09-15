import { useEffect, useMemo, useState } from "react";
import {
  createEmergencyRequest,
  emergencyRadiusKm,
  getEmergencyRequests,
  getItems,
  getMessages,
  getMyListings,
  getMyRequest,
  getRequests,
  requestBorrow,
  saveMemberLocation,
  sendMessage,
  submitItem,
} from "../services/borrowService";
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
  const [requests, setRequests] = useState([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ---------- UI state ----------
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showPost, setShowPost] = useState(false);
  const [form, setForm] = useState(BLANK_ITEM);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // ---------- Catalog filters ----------
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // ---------- Chat ----------
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // ---------- Emergency ----------
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergency, setEmergency] = useState({ itemTitle: "", note: "" });
  const [locationEnabled, setLocationEnabled] = useState(false);

  // ============================================================
  // Data fetching
  // ============================================================

  const refresh = async () => {
    try {
      const [fetchedItems, fetchedRequests, fetchedAlerts, fetchedMine] =
        await Promise.all([
          getItems({ approvedOnly: true }),
          getRequests(),
          getEmergencyRequests(),
          getMyListings(),
        ]);
      setItems(fetchedItems);
      setRequests(fetchedRequests);
      setEmergencyAlerts(fetchedAlerts);
      setMyListings(fetchedMine);
    } catch (e) {
      setError(e.message);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chat) {
      getMessages(chat.id)
        .then(setMessages)
        .catch((e) => setError(e.message));
    }
  }, [chat]);

  // ============================================================
  // Derived state
  // ============================================================

  const availableItems = useMemo(
    () => items.filter((x) => x.available),
    [items]
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

  // ============================================================
  // Geolocation helper
  // ============================================================

  const getPosition = (onSuccess, onFail) =>
    navigator.geolocation?.getCurrentPosition(onSuccess, onFail, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 10_000,
    });

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
          const data = await createEmergencyRequest({ ...emergency, location: position });
          setLocationEnabled(true);
          setShowEmergency(false);
          setEmergency({ itemTitle: "", note: "" });
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

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="ud-root">

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="ud-header">
        <div className="ud-header-text">
          <p className="eyebrow">Your borrowing space</p>
          <h1 className="ud-title">What will you borrow?</h1>
          <p className="ud-subtitle">
            Browse available items or share something useful with the campus community.
          </p>
        </div>
        <div className="ud-header-actions">
          <button
            className={`btn btn-sm ${locationEnabled ? "btn-success" : "btn-outline-secondary"}`}
            onClick={handleEnableLocation}
          >
            {locationEnabled ? "Location on" : "Enable location"}
          </button>
          <button
            className="btn btn-sm emergency-button"
            onClick={() => setShowEmergency((v) => !v)}
          >
            {showEmergency ? "Close" : "Emergency request"}
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowPost((v) => !v)}
          >
            {showPost ? "Close form" : "+ Post an item"}
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
              Enable your location first to send and receive alerts.
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
                placeholder="e.g. USB-C charger"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="em-note">Additional details</label>
              <input
                id="em-note"
                value={emergency.note}
                onChange={(e) => setEmergency({ ...emergency, note: e.target.value })}
                placeholder="Any helpful context (optional)"
              />
            </div>
            <button className="btn emergency-button" type="submit">
              Send nearby alert
            </button>
          </form>
        </section>
      )}

      {/* ── Metric cards ─────────────────────────────────────── */}
      <div className="ud-metrics">
        <div className="metric-card">
          <span>Available now</span>
          <strong>{dataLoading ? "\u2014" : availableItems.length}</strong>
        </div>
        <div className="metric-card">
          <span>Items submitted</span>
          <strong>{dataLoading ? "\u2014" : myListings.length}</strong>
        </div>
        <div className="metric-card">
          <span>Pending approval</span>
          <strong className={pendingCount > 0 ? "pending-text" : ""}>
            {dataLoading ? "\u2014" : pendingCount || "0"}
          </strong>
        </div>
      </div>

      {/* ── Active emergency inbox ───────────────────────────── */}
      {emergencyAlerts.length > 0 && (
        <section className="ud-panel emergency-inbox fade-in">
          <h2 className="emergency-inbox-title">Active nearby alerts</h2>
          <div className="emergency-list">
            {emergencyAlerts.map((a) => (
              <div className="emergency-alert-row" key={a.id}>
                <div className="emergency-alert-info">
                  <strong>{a.itemTitle}</strong>
                  <span>
                    {a.requesterName} needs this nearby
                    {a.note ? ` — ${a.note}` : ""}
                  </span>
                </div>
                <span className="emergency-timer">
                  {Math.max(1, Math.ceil((a.expiresAt - Date.now()) / 60_000))} min left
                </span>
              </div>
            ))}
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

      {/* ── Catalog ──────────────────────────────────────────── */}
      <section className="ud-panel catalog-panel">
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
                    />
                    {item.category && (
                      <span className="borrow-card-cat">{item.category}</span>
                    )}
                  </div>
                  <div className="borrow-card-body">
                    <h3 className="borrow-card-title">{item.title}</h3>
                    <p className="borrow-card-desc">{item.description}</p>
                    <p className="borrow-card-owner">By {item.ownerName}</p>
                  </div>
                  <div className="borrow-card-footer">
                    <span className="borrow-card-duration">
                      Up to <strong>{item.duration} days</strong>
                    </span>
                    {isOwn ? (
                      <span className="borrow-card-own-badge">Your item</span>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleBorrow(item)}
                      >
                        Request &amp; chat
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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

    </div>
  );
}
