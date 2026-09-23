// Tiny fetch wrapper: same-origin only, JSON in/out, surfaces {errors} from the API.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.errors?.[0]?.message || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

export const fmtTime = (ms) => new Date(ms).toLocaleString();
