const inventoryKey = "borrow-hub-inventory";
const requestsKey = "borrow-hub-requests";
const messagesKey = "borrow-hub-messages";
const locationsKey = "borrow-hub-member-locations";
const emergencyRequestsKey = "borrow-hub-emergency-requests";
const emergencyRadiusKm = 5;
const emergencyWindowMs = 15 * 60 * 1000;

const seedItems = [
  { id: "camera", title: "Fujifilm X-T30 camera", category: "Photography", duration: 3, available: true, status: "approved", ownerName: "Maya Chen", ownerEmail: "maya@borrowhub.test", image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80", description: "Compact mirrorless camera with a 23mm lens. Includes a charged battery, 23mm lens and neck strap." },
  { id: "projector", title: "Mini projector", category: "Events", duration: 2, available: true, status: "approved", ownerName: "Noah Patel", ownerEmail: "noah@borrowhub.test", image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=900&q=80", description: "Movie-night-ready projector with HDMI cable, remote and a soft carry case." },
  { id: "drill", title: "Cordless drill kit", category: "Tools", duration: 5, available: true, status: "approved", ownerName: "Community workshop", ownerEmail: "workshop@borrowhub.test", image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", description: "18V drill, assorted bits and a sturdy carry case for small household jobs." },
];
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
export function getItems() { return read(inventoryKey, seedItems); }
export function saveItems(items) { localStorage.setItem(inventoryKey, JSON.stringify(items)); }
export function submitItem(item, owner) { const newItem = { ...item, id: crypto.randomUUID(), duration: Number(item.duration), ownerName: owner.name, ownerEmail: owner.email, status: "pending", available: false }; saveItems([...getItems(), newItem]); return newItem; }
export function addItem(item) { const newItem = { ...item, id: crypto.randomUUID(), duration: Number(item.duration), ownerName: "BorrowHub team", ownerEmail: "admin@borrowhub.com", status: "approved", available: true }; saveItems([...getItems(), newItem]); return newItem; }
export function updateItem(updated) { saveItems(getItems().map((item) => item.id === updated.id ? { ...updated, duration: Number(updated.duration) } : item)); }
export function approveItem(id) { updateItem({ ...getItems().find((item) => item.id === id), status: "approved", available: true }); }
export function removeItem(id) { saveItems(getItems().filter((item) => item.id !== id)); }
export function getRequests() { return read(requestsKey, []); }
export function requestBorrow(item, borrower) { const request = { id: crypto.randomUUID(), itemId: item.id, itemTitle: item.title, ownerName: item.ownerName, borrowerName: borrower.name, borrowerEmail: borrower.email, createdAt: new Date().toLocaleDateString() }; localStorage.setItem(requestsKey, JSON.stringify([...getRequests(), request])); return request; }
export function getMessages(requestId) { return read(messagesKey, []).filter((message) => message.requestId === requestId); }
export function sendMessage(requestId, sender, text) { const messages = read(messagesKey, []); localStorage.setItem(messagesKey, JSON.stringify([...messages, { id: crypto.randomUUID(), requestId, sender, text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }])); }

function distanceInKm(first, second) {
  const radians = (value) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const latitudeDifference = radians(second.latitude - first.latitude);
  const longitudeDifference = radians(second.longitude - first.longitude);
  const a = Math.sin(latitudeDifference / 2) ** 2 + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDifference / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function saveMemberLocation(user, position) {
  const locations = read(locationsKey, []).filter((location) => location.email !== user.email);
  const location = { email: user.email, name: user.name, latitude: position.coords.latitude, longitude: position.coords.longitude, updatedAt: Date.now() };
  localStorage.setItem(locationsKey, JSON.stringify([...locations, location]));
  return location;
}
export function getMemberLocation(user) { return read(locationsKey, []).find((location) => location.email === user.email) || null; }
export function getNearbyMembers(user, location) { const oneHourAgo = Date.now() - 60 * 60 * 1000; return read(locationsKey, []).filter((member) => member.email !== user.email && member.updatedAt >= oneHourAgo).map((member) => ({ ...member, distanceKm: distanceInKm(location, member) })).filter((member) => member.distanceKm <= emergencyRadiusKm); }
export function createEmergencyRequest({ itemTitle, note, user, location }) { const recipients = getNearbyMembers(user, location); const request = { id: crypto.randomUUID(), itemTitle: itemTitle.trim(), note: note.trim(), requesterName: user.name, requesterEmail: user.email, createdAt: Date.now(), expiresAt: Date.now() + emergencyWindowMs, radiusKm: emergencyRadiusKm, recipientEmails: recipients.map((member) => member.email) }; localStorage.setItem(emergencyRequestsKey, JSON.stringify([...read(emergencyRequestsKey, []), request])); return { request, recipientCount: recipients.length }; }
export function getEmergencyRequests(user) { const active = read(emergencyRequestsKey, []).filter((request) => request.expiresAt > Date.now()); localStorage.setItem(emergencyRequestsKey, JSON.stringify(active)); return active.filter((request) => request.requesterEmail === user.email || request.recipientEmails.includes(user.email)); }
export { emergencyRadiusKm };
