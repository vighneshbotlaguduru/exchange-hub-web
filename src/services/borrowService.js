import { requireSupabase } from "../lib/supabase";
const fail = (error) => { if (error) throw new Error(error.message || "Unable to complete that request."); };
const listingFields = "id,title,category,duration:max_duration_days,available,status,image:image_url,description,owner_id,created_at,profiles!listings_owner_id_fkey(full_name,email)";
const mapListing = (item) => ({ ...item, ownerName: item.profiles?.full_name || "Community member", ownerEmail: item.profiles?.email, profiles: undefined });

export async function getItems({ approvedOnly = false } = {}) { let q = requireSupabase().from("listings").select(listingFields).order("created_at", { ascending: false }); if (approvedOnly) q = q.eq("status", "approved"); const { data, error } = await q; fail(error); return data.map(mapListing); }
export async function submitItem(item) { const { data, error } = await requireSupabase().from("listings").insert({ title: item.title.trim(), category: item.category.trim(), max_duration_days: Number(item.duration), image_url: item.image.trim(), description: item.description.trim() }).select(listingFields).single(); fail(error); return mapListing(data); }
export async function addItem(item) { const { data, error } = await requireSupabase().from("listings").insert({ title: item.title.trim(), category: item.category.trim(), max_duration_days: Number(item.duration), image_url: item.image.trim(), description: item.description.trim(), status: "approved", available: true }).select(listingFields).single(); fail(error); return mapListing(data); }
export async function updateItem(item) { const { error } = await requireSupabase().from("listings").update({ title: item.title.trim(), category: item.category.trim(), max_duration_days: Number(item.duration), image_url: item.image.trim(), description: item.description.trim(), available: item.available }).eq("id", item.id); fail(error); }
export async function removeItem(id) { const { error } = await requireSupabase().from("listings").delete().eq("id", id); fail(error); }
const mapRequest = (x) => ({ id: x.id, itemId: x.listing_id, itemTitle: x.listings?.title || "Unknown item", ownerName: x.profiles?.full_name || "Community member", createdAt: x.created_at });
export async function getMyRequest(listingId) { const { data, error } = await requireSupabase().from("borrow_requests").select("id,listing_id,created_at,listings(title),profiles!borrow_requests_owner_id_fkey(full_name)").eq("listing_id", listingId).maybeSingle(); fail(error); return data ? mapRequest(data) : null; }
export async function requestBorrow(item) { const { data, error } = await requireSupabase().from("borrow_requests").insert({ listing_id: item.id, owner_id: item.owner_id }).select("id,listing_id,created_at,listings(title),profiles!borrow_requests_owner_id_fkey(full_name)").single(); if (error) { if (error.code === "23505" || (error.message || "").includes("409") || String(error.code) === "409") { const existing = await getMyRequest(item.id); if (existing) return existing; } fail(error); } return mapRequest(data); }
export async function getRequests() { const { data, error } = await requireSupabase().from("borrow_requests").select("id,listing_id,created_at,listings(title),profiles!borrow_requests_owner_id_fkey(full_name)").order("created_at", { ascending: false }); fail(error); return data.map(mapRequest); }
export async function getIncomingRequests() { const { data, error } = await requireSupabase().from("borrow_requests").select("id,listing_id,created_at,status,listings(title),borrower:profiles!borrow_requests_borrower_id_fkey(full_name)").order("created_at", { ascending: false }); fail(error); return data.map((x) => ({ id: x.id, itemId: x.listing_id, itemTitle: x.listings?.title || "Unknown item", borrowerName: x.borrower?.full_name || "Community member", status: x.status || "pending", createdAt: x.created_at })); }
export async function updateRequestStatus(requestId, status) { const { error } = await requireSupabase().from("borrow_requests").update({ status }).eq("id", requestId); fail(error); }
export async function getMessages(requestId) { const { data, error } = await requireSupabase().from("messages").select("id,body,created_at,profiles!messages_sender_id_fkey(full_name)").eq("borrow_request_id", requestId).order("created_at"); fail(error); return data.map((x) => ({ id: x.id, sender: x.profiles?.full_name || "Member", text: x.body, time: new Date(x.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })); }
export async function sendMessage(requestId, text) { const { error } = await requireSupabase().from("messages").insert({ borrow_request_id: requestId, body: text.trim() }); fail(error); }
export async function saveMemberLocation(position) { const { error } = await requireSupabase().from("member_locations").upsert({ user_id: (await requireSupabase().auth.getUser()).data.user.id, latitude: position.coords.latitude, longitude: position.coords.longitude, updated_at: new Date().toISOString() }); fail(error); }
export async function getEmergencyRequests() { const { data, error } = await requireSupabase().from("emergency_requests").select("id,item_title,note,expires_at,requester_id,profiles!emergency_requests_requester_id_fkey(full_name,email)").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }); fail(error); return data.map((x) => ({ id: x.id, requesterId: x.requester_id, itemTitle: x.item_title, note: x.note, requesterName: x.profiles?.full_name || "Community member", requesterEmail: x.profiles?.email || (x.profiles?.full_name ? `${x.profiles.full_name}@srmist.edu.in` : ""), expiresAt: new Date(x.expires_at).getTime() })); }
export async function createEmergencyRequest({ itemTitle, note, location }) { const { data, error } = await requireSupabase().functions.invoke("create-emergency-request", { body: { itemTitle: itemTitle.trim(), note: note.trim(), latitude: location.coords.latitude, longitude: location.coords.longitude } }); fail(error); return data; }
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
