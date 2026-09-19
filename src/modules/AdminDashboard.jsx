import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { addItem, approveItem, getIncomingRequests, getItems, getMessages, rejectItem, removeItem, sendMessage, updateItem, updateRequestStatus } from "../services/borrowService";
import { useAuth } from "./useAuth";
import "../styles/AdminDashboard.css";

const blankItem = { title: "", category: "Tools", duration: 3, image: "", description: "" };

export default function AdminDashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blankItem);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Borrow requests & chat
  const [requests, setRequests] = useState([]);
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const refresh = async () => {
    try {
      const [fetchedItems, fetchedRequests] = await Promise.all([
        getItems(),
        getIncomingRequests(),
      ]);
      setItems(fetchedItems);
      setRequests(fetchedRequests);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    refresh();

    if (!supabase) return undefined;

    const channel = supabase
      .channel("admin_realtime_feed")
      .on("broadcast", { event: "request_status_changed" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "borrow_requests" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => refresh())
      .subscribe();

    const timer = window.setInterval(refresh, 10_000);

    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!chat) return undefined;

    const fetchChatMessages = () => {
      getMessages(chat.id)
        .then(setMessages)
        .catch((e) => setError(e.message));
    };

    fetchChatMessages();

    if (!supabase) return undefined;

    const chatChannel = supabase
      .channel(`chat_thread_${chat.id}`)
      .on("broadcast", { event: "new_message" }, () => {
        fetchChatMessages();
      })
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

    // Fast 3s interval polling while chat modal is open
    const chatTimer = window.setInterval(fetchChatMessages, 3_000);

    return () => {
      window.clearInterval(chatTimer);
      supabase.removeChannel(chatChannel);
    };
  }, [chat]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        await updateItem({ ...form, id: editing.id, available: editing.available });
        setMessage("Item updated.");
      } else {
        await addItem(form);
        setMessage("New borrowable item added.");
      }
      setForm(blankItem);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const edit = (item) => {
    setEditing(item);
    setForm({ title: item.title, category: item.category, duration: item.duration, image: item.image, description: item.description });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggle = async (item) => {
    try { await updateItem({ ...item, available: !item.available }); refresh(); } catch (e) { setError(e.message); }
  };

  const deleteItem = async (item) => {
    if (window.confirm(`Remove ${item.title} from the borrowing library?`))
      try { await removeItem(item.id); refresh(); } catch (e) { setError(e.message); }
  };

  const handleApprove = async (item) => {
    try {
      await approveItem(item.id);
      setMessage(`Approved "${item.title}" for community borrowing.`);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleReject = async (item) => {
    if (window.confirm(`Reject listing "${item.title}"?`)) {
      try {
        await rejectItem(item.id);
        setMessage(`Rejected "${item.title}".`);
        await refresh();
      } catch (e) {
        setError(e.message);
      }
    }
  };

  const openChat = (req) => {
    setChat(req);
    setDraft("");
  };

  const changeRequestStatus = async (req, status) => {
    try {
      await updateRequestStatus(req.id, status);
      await refresh();
      if (chat?.id === req.id) setChat({ ...chat, status });
      setMessage(`Request marked ${status}.`);
    } catch (e) { setError(e.message); }
  };

  const closeChat = () => {
    setChat(null);
    setMessages([]);
    setDraft("");
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

  return (
    <div>
      <p className="eyebrow">Administration</p>
      <h1 className="fw-bold">Borrowing library</h1>
      <p className="text-secondary">
        Control all borrowable products, photos, availability and maximum borrowing periods.
      </p>

      {/* ── Stat cards ───────────────────────────────────── */}
      <div className="row g-4 mt-2">
        <div className="col-md-3">
          <div className="stat-card">
            <span>Total products</span>
            <strong>{items.length}</strong>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-card">
            <span>Available to borrow</span>
            <strong>{items.filter((item) => item.available).length}</strong>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-card">
            <span>Borrow requests</span>
            <strong>{requests.length}</strong>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stat-card">
            <span>Member verification</span>
            <strong>Email code</strong>
          </div>
        </div>
      </div>

      {message && <div className="alert alert-success mt-4">{message}</div>}
      {error && <div className="alert alert-danger mt-4">{error}</div>}

      {/* ── Add / Edit item form ──────────────────────────── */}
      <section className="dashboard-panel mt-4 admin-editor">
        <div>
          <h2>{editing ? "Edit borrowing item" : "Add a borrowing item"}</h2>
          <p>Use an image URL for the product photo. The chosen duration is the maximum a member can borrow it.</p>
        </div>
        <form className="item-form" onSubmit={submit}>
          <label>Product name<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>Category<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required /></label>
          <label>Max duration (days)<input type="number" min="1" max="60" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} required /></label>
          <label>Photo URL<input type="url" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} required /></label>
          <label className="form-wide">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">{editing ? "Save changes" : "Add item"}</button>
            {editing && <button className="btn btn-outline-secondary" type="button" onClick={() => { setEditing(null); setForm(blankItem); }}>Cancel</button>}
          </div>
        </form>
      </section>

      {/* ── Borrow requests ───────────────────────────────── */}
      <section className="dashboard-panel mt-4 admin-requests-panel">
        <div className="panel-heading">
          <div>
            <h2>Borrow requests</h2>
            <p>Members who want to borrow items. Click a request to open the chat.</p>
          </div>
        </div>
        {requests.length === 0 ? (
          <p className="admin-requests-empty">No borrow requests yet.</p>
        ) : (
          <div className="admin-requests">
            {requests.map((req) => (
              <article
                className={`admin-request-row${chat?.id === req.id ? " active" : ""}`}
                key={req.id}
                onClick={() => openChat(req)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") openChat(req); }}
              >
                <div className="admin-request-info">
                  <strong>{req.itemTitle}</strong>
                  <span>
                    Requested by <em>{req.borrowerName}</em> · {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className={`admin-request-status status-${req.status}`}>
                  {req.status}
                </span>
                {req.status === "pending" && (
                  <span className="admin-request-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-sm btn-success" onClick={() => changeRequestStatus(req, "accepted")}>✓ Accept</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => changeRequestStatus(req, "declined")}>✕ Decline</button>
                  </span>
                )}
                {req.status === "accepted" && (
                  <span className="admin-request-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => changeRequestStatus(req, "returned")}>↩ Mark Returned</button>
                  </span>
                )}
                <span className="admin-request-badge">Chat →</span>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── Chat panel ────────────────────────────────────── */}
      {chat && (
        <section className="chat-panel fade-in" aria-label="Borrow request chat">
          <div className="chat-head">
            <div className="chat-head-info">
              <span className="chat-head-eyebrow">Borrow request</span>
              <h2 className="chat-head-title">{chat.itemTitle}</h2>
              <p className="chat-head-sub">
                Chat with {chat.borrowerName} to arrange pickup and return.
              </p>
            </div>
            <button
              className="btn-close"
              aria-label="Close chat"
              onClick={closeChat}
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
              placeholder={`Message ${chat.borrowerName}...`}
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

      {/* ── All products list ─────────────────────────────── */}
      <section className="dashboard-panel mt-4">
        <div className="panel-heading">
          <div>
            <h2>All borrowing products</h2>
            <p>Review submitted items, adjust availability, and edit community gear.</p>
          </div>
        </div>
        <div className="admin-items">
          {items.map((item) => (
            <article className="admin-item" key={item.id}>
              <img src={item.image} alt={item.title} />
              <div className="admin-item-info">
                <span>{item.category}</span>
                <h3>{item.title}</h3>
                <p>Maximum duration: <strong>{item.duration} days</strong> · Owner: {item.ownerName}</p>
              </div>
              <span className={`availability ${item.status === 'pending' ? 'pending-badge' : item.available ? 'available' : 'paused'}`}>
                {item.status === 'pending' ? '⏳ Pending Approval' : item.available ? '● Available' : '○ Paused'}
              </span>
              <div className="admin-actions">
                {item.status === 'pending' ? (
                  <>
                    <button className="btn btn-success btn-sm" onClick={() => handleApprove(item)}>✓ Approve</button>
                    <button className="btn btn-outline-danger btn-sm" onClick={() => handleReject(item)}>Reject</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-outline-primary btn-sm" onClick={() => edit(item)}>Edit</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => toggle(item)}>{item.available ? "Pause" : "Publish"}</button>
                    <button className="btn btn-outline-danger btn-sm" onClick={() => deleteItem(item)}>Remove</button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
