const usersKey = "borrow-hub-users";
const pendingKey = "borrow-hub-pending-user";
const verificationCode = "246810";
const srmistEmailPattern = /^[^\s@]+@srmist\.edu\.in$/i;

function readUsers() {
  try { return JSON.parse(localStorage.getItem(usersKey)) || []; } catch { return []; }
}

export function startRegistration({ name, email }) {
  const users = readUsers();
  if (!srmistEmailPattern.test(email.trim())) {
    throw new Error("Please use your SRMIST email address ending in @srmist.edu.in.");
  }
  if (users.some((user) => user.email.toLowerCase() === email.trim().toLowerCase())) {
    throw new Error("An account already exists for this email address. Please sign in instead.");
  }
  localStorage.setItem(pendingKey, JSON.stringify({ name: name.trim(), email: email.trim() }));
}

export function completeRegistration({ email, code }) {
  const pending = JSON.parse(localStorage.getItem(pendingKey) || "null");
  if (!pending || pending.email.toLowerCase() !== email.trim().toLowerCase()) throw new Error("Please request a new verification code.");
  if (code !== verificationCode) throw new Error("That verification code is not correct.");
  const user = { id: crypto.randomUUID(), name: pending.name, email: pending.email, verified: true };
  localStorage.setItem(usersKey, JSON.stringify([...readUsers(), user]));
  localStorage.removeItem(pendingKey);
  return { ...user, role: "user" };
}

export function startLogin({ email }) {
  const user = readUsers().find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) throw new Error("We couldn't find a verified account for this email address.");
  return user;
}

export function completeLogin({ email, code }) {
  const user = readUsers().find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || code !== verificationCode) throw new Error("The email address or verification code is incorrect.");
  return { ...user, role: "user" };
}

export function loginAdmin({ email, password }) {
  if (email.trim().toLowerCase() !== "admin@borrowhub.com" || password !== "admin123") {
    throw new Error("Invalid administrator credentials.");
  }
  return { id: "admin", name: "Administrator", email: "admin@borrowhub.com", role: "admin" };
}

export { verificationCode };
