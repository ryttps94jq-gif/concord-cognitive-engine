async function safeJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } 
  catch { return { ok:false, error:text || "Non-JSON response", status: res.status }; }
}

export async function apiGet(path) {
  const res = await fetch(path, { method: "GET" });
  return safeJson(res);
}

export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  return safeJson(res);
}

export async function apiPatch(path, body) {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  return safeJson(res);
}