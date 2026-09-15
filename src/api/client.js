export async function request(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json", ...options.headers }, ...options });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}
