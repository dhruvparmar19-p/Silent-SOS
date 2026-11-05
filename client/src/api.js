const BASE = import.meta.env.VITE_API_URL || '/api';
export const getToken = () => localStorage.getItem('sos_token');
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() && { Authorization: 'Bearer ' + getToken() }) },
    body: body && JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
