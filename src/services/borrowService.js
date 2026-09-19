import { requireSupabase } from "../lib/supabase";
const fail = (error) => { if (error) throw new Error(error.message || "Unable to complete that request."); };
const listingFields = "id,title,category,duration:max_duration_days,available,status,image:image_url,description,owner_id,created_at,profiles!listings_owner_id_fkey(full_name,email)";
const mapListing = (item) => ({ ...item, ownerName: item.profiles?.full_name || "Community member", ownerEmail: item.profiles?.email, profiles: undefined });

export async function getItems({ approvedOnly = false } = {}) { let q = requireSupabase().from("listings").select(listingFields).order("created_at", { ascending: false }); if (approvedOnly) q = q.eq("status", "approved"); const { data, error } = await q; fail(error); return data.map(mapListing); }
export async function submitItem(item) { const { data, error } = await requireSupabase().from("listings").insert({ title: item.title.trim(), category: item.category.trim(), max_duration_days: Number(item.duration), image_url: item.image.trim(), description: item.description.trim() }).select(listingFields).single(); fail(error); return mapListing(data); }
export async function addItem(item) { const { data, error } = await requireSupabase().from("listings").insert({ title: item.title.trim(), category: item.category.trim(), max_duration_days: Number(item.duration), image_url: item.image.trim(), description: item.description.trim(), status: "approved", available: true }).select(listingFields).single(); fail(error); return mapListing(data); }
export async function updateItem(item) { const payload = { title: item.title.trim(), category: item.category.trim(), max_duration_days: Number(item.duration), image_url: item.image.trim(), description: item.description.trim(), available: item.available }; if (item.status) payload.status = item.status; const { error } = await requireSupabase().from("listings").update(payload).eq("id", item.id); fail(error); }
export async function approveItem(id) { const { error } = await requireSupabase().from("listings").update({ status: "approved", available: true }).eq("id", id); fail(error); }
export async function rejectItem(id) { const { error } = await requireSupabase().from("listings").update({ status: "rejected", available: false }).eq("id", id); fail(error); }
export async function removeItem(id) { const { error } = await requireSupabase().from("listings").delete().eq("id", id); fail(error); }
const mapRequest = (x) => ({ id: x.id, itemId: x.listing_id, itemTitle: x.listings?.title || "Unknown item", ownerName: x.profiles?.full_name || "Community member", createdAt: x.created_at });
export async function getMyRequest(listingId) { const { data, error } = await requireSupabase().from("borrow_requests").select("id,listing_id,created_at,listings(title),profiles!borrow_requests_owner_id_fkey(full_name)").eq("listing_id", listingId).maybeSingle(); fail(error); return data ? mapRequest(data) : null; }
export async function requestBorrow(item) { const { data, error } = await requireSupabase().from("borrow_requests").insert({ listing_id: item.id, owner_id: item.owner_id }).select("id,listing_id,created_at,listings(title),profiles!borrow_requests_owner_id_fkey(full_name)").single(); if (error) { if (error.code === "23505" || (error.message || "").includes("409") || String(error.code) === "409") { const existing = await getMyRequest(item.id); if (existing) return existing; } fail(error); } return mapRequest(data); }
export async function getRequests() { const { data, error } = await requireSupabase().from("borrow_requests").select("id,listing_id,created_at,listings(title),profiles!borrow_requests_owner_id_fkey(full_name)").order("created_at", { ascending: false }); fail(error); return data.map(mapRequest); }
export async function getIncomingRequests() { const { data, error } = await requireSupabase().from("borrow_requests").select("id,listing_id,created_at,status,listings(title),borrower:profiles!borrow_requests_borrower_id_fkey(full_name)").order("created_at", { ascending: false }); fail(error); return data.map((x) => ({ id: x.id, itemId: x.listing_id, itemTitle: x.listings?.title || "Unknown item", borrowerName: x.borrower?.full_name || "Community member", status: x.status || "pending", createdAt: x.created_at })); }
export async function updateRequestStatus(requestId, status) { const { error } = await requireSupabase().from("borrow_requests").update({ status }).eq("id", requestId); fail(error); }
export async function getMessages(requestId) { const { data, error } = await requireSupabase().from("messages").select("id,body,created_at,profiles!messages_sender_id_fkey(full_name)").eq("borrow_request_id", requestId).order("created_at"); fail(error); return data.map((x) => ({ id: x.id, sender: x.profiles?.full_name || "Member", text: x.body, time: new Date(x.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })); }
export async function sendMessage(requestId, text) { const { error } = await requireSupabase().from("messages").insert({ borrow_request_id: requestId, body: text.trim() }); fail(error); }
export async function saveMemberLocation(position) {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const lat = position?.coords?.latitude;
  const lng = position?.coords?.longitude;
  if (!lat || !lng) return;
  const { error } = await sb.from("member_locations").upsert({
    user_id: user.id,
    latitude: lat,
    longitude: lng,
    updated_at: new Date().toISOString()
  });
  if (error) console.warn("Failed to save location:", error);
}
export async function getEmergencyRequests() {
  const { data, error } = await requireSupabase()
    .from("emergency_requests")
    .select("id,item_title,note,latitude,longitude,expires_at,requester_id,profiles!emergency_requests_requester_id_fkey(full_name,email)")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  fail(error);
  return data.map((x) => {
    let rawNote = x.note || "";
    let phone = "";
    let email = x.profiles?.email || (x.profiles?.full_name ? `${x.profiles.full_name}@srmist.edu.in` : "");

    const telMatch = rawNote.match(/\[TEL:([^\]]+)\]/);
    if (telMatch) {
      phone = telMatch[1].trim();
      rawNote = rawNote.replace(/\[TEL:[^\]]+\]\s*/, "");
    }
    const mailMatch = rawNote.match(/\[MAIL:([^\]]+)\]/);
    if (mailMatch) {
      email = mailMatch[1].trim();
      rawNote = rawNote.replace(/\[MAIL:[^\]]+\]\s*/, "");
    }

    return {
      id: x.id,
      requesterId: x.requester_id,
      itemTitle: x.item_title,
      note: rawNote.trim(),
      phone: phone.trim(),
      email: email.trim(),
      latitude: x.latitude,
      longitude: x.longitude,
      requesterName: x.profiles?.full_name || "Community member",
      requesterEmail: email.trim(),
      expiresAt: new Date(x.expires_at).getTime()
    };
  });
}
export async function createEmergencyRequest({ itemTitle, note, phone, email, location }) {
  const sb = requireSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Please log in first.");
  const lat = location?.coords?.latitude;
  const lng = location?.coords?.longitude;

  let combinedNote = "";
  if (phone) combinedNote += `[TEL:${phone.trim()}] `;
  if (email) combinedNote += `[MAIL:${email.trim()}] `;
  if (note) combinedNote += note.trim();
  combinedNote = combinedNote.trim().slice(0, 500);

  // 1. Try direct RPC create_emergency_request
  try {
    const { data, error } = await sb.rpc("create_emergency_request", {
      p_item_title: itemTitle.trim(),
      p_note: combinedNote,
      p_latitude: lat,
      p_longitude: lng
    });
    if (!error && data) return data;
  } catch (rpcErr) {
    console.warn("Direct RPC error, attempting table fallback:", rpcErr);
  }

  // 2. Fallback table insert
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { data: insertData, error: insertError } = await sb
    .from("emergency_requests")
    .insert({
      requester_id: user.id,
      item_title: itemTitle.trim(),
      note: combinedNote,
      latitude: lat,
      longitude: lng,
      expires_at: expiresAt
    })
    .select("id")
    .single();

  if (insertError) {
    const { data: fnData, error: fnError } = await sb.functions.invoke("create-emergency-request", {
      body: { itemTitle: itemTitle.trim(), note: combinedNote, latitude: lat, longitude: lng }
    });
    fail(fnError);
    return fnData;
  }

  return { requestId: insertData.id, recipientCount: 1 };
}
export const emergencyRadiusKm = 5;
export async function getMyListings() {
  const sb = requireSupabase();
  const { data: { user }, error: userError } = await sb.auth.getUser();
  if (userError || !user) return [];
  const { data, error } = await sb.from("listings")
    .select("id,status,title,category,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  fail(error);
  return data || [];
}
