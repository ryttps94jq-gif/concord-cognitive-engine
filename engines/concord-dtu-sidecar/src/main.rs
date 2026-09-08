//! concord-dtu-sidecar — read-only reader for the Concord `dtu_store` table.
//!
//! Concurrency Refactor Phase 3. `dtu.get` / `dtu.list` run on the Node event
//! loop: `dtu.list` iterates the entire in-memory DTU set and filters/sorts in
//! JS on every locker page load. This process reads `dtu_store` READ-ONLY over a
//! Unix socket and does the get / visibility-filter / sort / paginate off-thread.
//!
//! SINGLE WRITER stays Node — this opens the DB with `SQLITE_OPEN_READ_ONLY` +
//! `PRAGMA query_only`. WAL gives it consistent snapshot reads.
//!
//!   GET /v1/health
//!   GET /v1/dtu?id=...
//!   GET /v1/dtus/list?viewer=&scope=&tier=&q=&mine=&owner=&limit=&offset=
//!                    &viewerRegional=&viewerNational=
//!   GET /v1/dtus/recent?limit=&scope=&tier=&source=
//!
//! The `list` filter is a faithful port of server.js `userVisibleDTUs` +
//! `dtu.list`. It is guarded by a differential test (engines/.../proof) that
//! compares its output ID set to the live JS macro's before it is trusted live.
//!
//! Socket: $CONCORD_DTU_SIDECAR_SOCK  (default ~/concord/run/concord-dtu-sidecar.sock)
//! DB:     $CONCORD_DB_PATH || $DB_PATH || ~/concord/concord.db

use rusqlite::{Connection, OpenFlags};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use std::time::Instant;

const SYSTEM_DTU_SOURCES: &[&str] = &[
    "repair_cortex", "concord_brain_index", "system_guardian", "guardian_monitor",
    "lattice_audit", "self_repair", "system", "concord-mesh", "system.analogize",
    "auto", "autogen", "system_tick", "heartbeat", "system_repair", "concord_system",
    "background", "internal", "migration", "embedding_backfill", "consolidation", "evolution",
];
const INTERNAL_KINDS: &[&str] = &[
    "shadow", "pattern_shadow", "repair_record", "royalty_record", "session_context",
    "linguistic_map", "audit_trail", "system_metric", "repair_dtu", "client_error",
];

fn db_path() -> String {
    for k in ["CONCORD_DB_PATH", "DB_PATH"] {
        if let Ok(v) = std::env::var(k) {
            if !v.is_empty() {
                return v;
            }
        }
    }
    format!("{}/concord/concord.db", std::env::var("HOME").unwrap_or_default())
}

fn sock_path() -> PathBuf {
    if let Ok(v) = std::env::var("CONCORD_DTU_SIDECAR_SOCK") {
        if !v.is_empty() {
            return PathBuf::from(v);
        }
    }
    let run = std::env::var("CONCORD_RUN_DIR")
        .unwrap_or_else(|_| format!("{}/concord/run", std::env::var("HOME").unwrap_or_default()));
    PathBuf::from(run).join("concord-dtu-sidecar.sock")
}

fn open_ro(path: &str) -> rusqlite::Result<Connection> {
    let c = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    c.busy_timeout(std::time::Duration::from_millis(4000))?;
    c.pragma_update(None, "query_only", true)?;
    Ok(c)
}

// ── DTU field access — mirrors server.js dual camelCase/snake_case reads ──────
fn s<'a>(v: &'a Value, keys: &[&str]) -> &'a str {
    for k in keys {
        if let Some(x) = v.get(*k).and_then(|x| x.as_str()) {
            return x;
        }
    }
    ""
}
fn tags_of(v: &Value) -> Vec<String> {
    v.get("tags")
        .and_then(|t| t.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default()
}
fn machine_kind(v: &Value) -> &str {
    v.get("machine").and_then(|m| m.get("kind")).and_then(|k| k.as_str()).unwrap_or("")
}
fn is_shadow(v: &Value) -> bool {
    s(v, &["tier"]).eq_ignore_ascii_case("shadow") || tags_of(v).iter().any(|t| t == "shadow")
}
fn owner_of(v: &Value) -> String {
    for k in ["author", "ownerId", "userId", "createdBy"] {
        if let Some(x) = v.get(k).and_then(|x| x.as_str()) {
            if !x.is_empty() {
                return x.to_string();
            }
        }
    }
    String::new()
}

struct ListReq {
    viewer: String,
    scope: Option<String>,
    tier: String,
    q: String,
    mine: bool,
    limit: usize,
    offset: usize,
    viewer_regional: String,
    viewer_national: String,
}

fn normalize_lc(s: &str) -> String {
    // server.js tokenish = normalizeText().toLowerCase(); normalizeText collapses
    // whitespace + strips control chars. Approximate: lowercase + collapse ws.
    s.to_lowercase().split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Faithful port of userVisibleDTUs(viewerId) — the system/privacy/federation gate.
fn user_visible(d: &Value, r: &ListReq) -> bool {
    if SYSTEM_DTU_SOURCES.contains(&s(d, &["source"])) {
        return false;
    }
    if SYSTEM_DTU_SOURCES.contains(&s(d, &["creatorType"])) {
        return false;
    }
    if s(d, &["scope"]) == "system" {
        return false;
    }
    if s(d, &["visibility"]) == "internal" {
        return false;
    }
    let privacy = s(d, &["privacy"]);
    let is_private = privacy == "private"
        || privacy == "followers-only"
        || s(d, &["scope"]) == "user"
        || s(d, &["visibility"]) == "private";
    let owner = owner_of(d);
    if is_private {
        if r.viewer.is_empty() || owner != r.viewer {
            return false;
        }
    }
    let fed_tier = {
        let t = s(d, &["federation_tier", "federationTier"]);
        if t.is_empty() { None } else { Some(t) }
    };
    if let Some(t) = fed_tier {
        if r.viewer != owner {
            match t {
                "local" => return false,
                "regional" => {
                    let dtu_reg = s(d, &["location_regional", "locationRegional"]);
                    if !dtu_reg.is_empty() {
                        if r.viewer_regional.is_empty() || r.viewer_regional != dtu_reg {
                            return false;
                        }
                    }
                }
                "national" => {
                    let dtu_nat = s(d, &["location_national", "locationNational"]);
                    if !dtu_nat.is_empty() {
                        if r.viewer_national.is_empty() || r.viewer_national != dtu_nat {
                            return false;
                        }
                    }
                }
                _ => {} // "global" — always visible
            }
        }
    }
    true
}

fn scope_level(sc: &str) -> i32 {
    match sc {
        "regional" => 1,
        "national" => 2,
        "global" => 3,
        _ => 0, // local / unknown
    }
}

/// Reconstruct a DTU Value from a dtu_store row. The `data` blob is UNRELIABLE
/// for anything but the body — sniffPayload() in dtu-store.js frequently stores
/// only `JSON.stringify(dtu.body)`, losing id/owner/visibility. So the reliable
/// top-level columns are merged OVER whatever `data` yields.
///
/// KNOWN GAP: owner_user_id / visibility / privacy / federation_tier / kind are
/// NOT columns and NOT reliably in `data`, so the visibility filter below can
/// only see them for DTUs whose `data` happens to be the full object. This is
/// why the differential proof fails and this sidecar is NOT wired live — see
/// engines/concord-dtu-sidecar/README.md for the schema migration that fixes it.
fn row_to_dtu(id: &str, title: &str, tier: &str, scope: &str, tags: &str, source: &str, created: &str, updated: &str, data: &str) -> Value {
    let mut d: Value = serde_json::from_str(data).unwrap_or_else(|_| json!({}));
    if !d.is_object() {
        d = json!({ "body": d });
    }
    let o = d.as_object_mut().unwrap();
    o.insert("id".into(), json!(id));
    if o.get("title").and_then(|v| v.as_str()).unwrap_or("").is_empty() { o.insert("title".into(), json!(title)); }
    o.insert("tier".into(), json!(tier));
    if !scope.is_empty() && o.get("scope").is_none() { o.insert("scope".into(), json!(scope)); }
    if o.get("tags").and_then(|v| v.as_array()).map(|a| a.is_empty()).unwrap_or(true) {
        if let Ok(t) = serde_json::from_str::<Value>(tags) { o.insert("tags".into(), t); }
    }
    if !source.is_empty() && o.get("source").is_none() { o.insert("source".into(), json!(source)); }
    if o.get("createdAt").is_none() { o.insert("createdAt".into(), json!(created)); }
    if o.get("updatedAt").is_none() { o.insert("updatedAt".into(), json!(updated)); }
    d
}

const ROW_COLS: &str = "id, title, tier, scope, tags, source, created_at, updated_at, data";

/// Port of the dtu.list body (after userVisibleDTUs).
fn list_dtus(conn: &Connection, r: &ListReq) -> rusqlite::Result<(Vec<Value>, usize)> {
    let mut stmt = conn.prepare(&format!("SELECT {ROW_COLS} FROM dtu_store"))?;
    let rows = stmt.query_map([], |row| {
        Ok(row_to_dtu(
            &row.get::<_, String>(0)?, &row.get::<_, String>(1).unwrap_or_default(),
            &row.get::<_, String>(2).unwrap_or_default(), &row.get::<_, String>(3).unwrap_or_default(),
            &row.get::<_, String>(4).unwrap_or_else(|_| "[]".into()), &row.get::<_, String>(5).unwrap_or_default(),
            &row.get::<_, String>(6).unwrap_or_default(), &row.get::<_, String>(7).unwrap_or_default(),
            &row.get::<_, String>(8).unwrap_or_else(|_| "{}".into()),
        ))
    })?;

    let mut items: Vec<Value> = Vec::new();
    for d in rows {
        let d = match d { Ok(v) => v, Err(_) => continue };
        if !user_visible(&d, r) {
            continue;
        }
        // dtu.list extra filters
        if is_shadow(&d) {
            continue;
        }
        if INTERNAL_KINDS.contains(&machine_kind(&d)) {
            continue;
        }
        if s(&d, &["tier"]) == "shadow" {
            continue;
        }
        items.push(d);
    }

    // scope / mine / default-view
    let uid = &r.viewer;
    if r.mine {
        items = if uid.is_empty() {
            vec![]
        } else {
            items.into_iter().filter(|d| s(d, &["ownerId"]) == *uid).collect()
        };
    } else if let Some(sf) = r.scope.as_deref() {
        if ["local", "regional", "national", "global"].contains(&sf) {
            items.retain(|d| {
                let lvl = scope_level(s(d, &["scope"]));
                match sf {
                    "global" => lvl == 3,
                    "national" => lvl >= 2,
                    "regional" => (1..=2).contains(&lvl),
                    "local" => {
                        if lvl > 0 {
                            return false;
                        }
                        let o = s(d, &["ownerId"]);
                        uid.is_empty() || o.is_empty() || o == *uid
                    }
                    _ => true,
                }
            });
            if sf != "local" {
                items.retain(|d| {
                    let o = s(d, &["ownerId"]);
                    if o.is_empty() || o == *uid {
                        return true;
                    }
                    let vis = {
                        let mv = d.get("meta").and_then(|m| m.get("visibility")).and_then(|x| x.as_str());
                        mv.unwrap_or_else(|| s(d, &["visibility"]))
                    };
                    vis == "published" || vis == "public"
                });
            }
        } else if !uid.is_empty() {
            default_view(&mut items, uid);
        }
    } else if !uid.is_empty() {
        default_view(&mut items, uid);
    }

    // sort by createdAt desc
    items.sort_by(|a, b| s(b, &["createdAt"]).cmp(s(a, &["createdAt"])));

    if r.tier != "any" {
        items.retain(|d| s(d, &["tier"]) == r.tier);
    }
    if !r.q.is_empty() {
        let q = &r.q;
        items.retain(|d| {
            normalize_lc(s(d, &["title"])).contains(q)
                || normalize_lc(&tags_of(d).join(" ")).contains(q)
                || normalize_lc(s(d, &["cretiHuman", "creti"])).contains(q)
        });
    }

    let total = items.len();
    let end = (r.offset + r.limit).min(total);
    let page = if r.offset < total { items[r.offset..end].to_vec() } else { vec![] };
    Ok((page, total))
}

fn default_view(items: &mut Vec<Value>, uid: &str) {
    items.retain(|d| {
        let o = s(d, &["ownerId"]);
        if o.is_empty() || o == uid {
            return true;
        }
        if s(d, &["scope"]) == "global" {
            return true;
        }
        let vis = {
            let mv = d.get("meta").and_then(|m| m.get("visibility")).and_then(|x| x.as_str());
            mv.unwrap_or_else(|| s(d, &["visibility"]))
        };
        vis == "published" || vis == "public"
    });
}

fn get_dtu(conn: &Connection, id: &str) -> rusqlite::Result<Option<Value>> {
    let mut stmt = conn.prepare(&format!("SELECT {ROW_COLS} FROM dtu_store WHERE id = ? LIMIT 1"))?;
    let mut rows = stmt.query([id])?;
    match rows.next()? {
        Some(row) => Ok(Some(row_to_dtu(
            &row.get::<_, String>(0)?, &row.get::<_, String>(1).unwrap_or_default(),
            &row.get::<_, String>(2).unwrap_or_default(), &row.get::<_, String>(3).unwrap_or_default(),
            &row.get::<_, String>(4).unwrap_or_else(|_| "[]".into()), &row.get::<_, String>(5).unwrap_or_default(),
            &row.get::<_, String>(6).unwrap_or_default(), &row.get::<_, String>(7).unwrap_or_default(),
            &row.get::<_, String>(8).unwrap_or_else(|_| "{}".into()),
        ))),
        None => Ok(None),
    }
}

fn recent(conn: &Connection, limit: usize, scope: Option<&str>, tier: Option<&str>, source: Option<&str>) -> rusqlite::Result<Vec<Value>> {
    let mut sql = format!("SELECT {ROW_COLS} FROM dtu_store WHERE 1=1");
    let mut params: Vec<String> = Vec::new();
    if let Some(v) = scope { sql.push_str(" AND scope = ?"); params.push(v.to_string()); }
    if let Some(v) = tier { sql.push_str(" AND tier = ?"); params.push(v.to_string()); }
    if let Some(v) = source { sql.push_str(" AND source = ?"); params.push(v.to_string()); }
    sql.push_str(" ORDER BY updated_at DESC LIMIT ?");
    params.push(limit.to_string());
    let mut stmt = conn.prepare(&sql)?;
    let pr: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p as &dyn rusqlite::ToSql).collect();
    let rows = stmt.query_map(pr.as_slice(), |row| {
        Ok(row_to_dtu(
            &row.get::<_, String>(0)?, &row.get::<_, String>(1).unwrap_or_default(),
            &row.get::<_, String>(2).unwrap_or_default(), &row.get::<_, String>(3).unwrap_or_default(),
            &row.get::<_, String>(4).unwrap_or_else(|_| "[]".into()), &row.get::<_, String>(5).unwrap_or_default(),
            &row.get::<_, String>(6).unwrap_or_default(), &row.get::<_, String>(7).unwrap_or_default(),
            &row.get::<_, String>(8).unwrap_or_else(|_| "{}".into()),
        ))
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ── minimal HTTP over UnixListener ──────────────────────────────────────────
fn parse_query(path: &str) -> (String, std::collections::HashMap<String, String>) {
    let mut map = std::collections::HashMap::new();
    let (p, qs) = match path.split_once('?') {
        Some((a, b)) => (a.to_string(), b),
        None => (path.to_string(), ""),
    };
    for kv in qs.split('&') {
        if kv.is_empty() { continue; }
        let (k, v) = kv.split_once('=').unwrap_or((kv, ""));
        map.insert(urldecode(k), urldecode(v));
    }
    (p, map)
}

fn urldecode(s: &str) -> String {
    let b = s.replace('+', " ");
    let bytes = b.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(n) = u8::from_str_radix(&b[i + 1..i + 3], 16) {
                out.push(n);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn respond(stream: &mut UnixStream, status: u16, body: &[u8]) {
    let reason = match status {
        200 => "OK", 400 => "Bad Request", 404 => "Not Found", 500 => "Internal Server Error", _ => "OK",
    };
    let hdr = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(hdr.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

fn handle(stream: &mut UnixStream, conn: &Connection, served: &AtomicU64) {
    let mut reader = BufReader::new(match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    });
    let mut request_line = String::new();
    if reader.read_line(&mut request_line).is_err() {
        return;
    }
    // drain headers
    loop {
        let mut l = String::new();
        if reader.read_line(&mut l).unwrap_or(0) == 0 || l == "\r\n" || l == "\n" {
            break;
        }
    }
    served.fetch_add(1, Ordering::Relaxed);

    let mut parts = request_line.split_whitespace();
    let _method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("/");
    let (route, qp) = parse_query(path);

    let started = Instant::now();
    let (status, val): (u16, Value) = match route.as_str() {
        "/v1/health" => {
            let n: i64 = conn.query_row("SELECT count(*) FROM dtu_store", [], |r| r.get(0)).unwrap_or(-1);
            let qo: i64 = conn.query_row("PRAGMA query_only", [], |r| r.get(0)).unwrap_or(-1);
            (200, json!({
                "ok": true, "service": "concord-dtu-sidecar", "impl": "rust",
                "dtuStoreRows": n, "queryOnly": qo, "served": served.load(Ordering::Relaxed),
                "db": db_path(),
            }))
        }
        "/v1/dtu" => match qp.get("id") {
            None => (400, json!({"ok": false, "error": "id required"})),
            Some(id) => match get_dtu(conn, id) {
                Ok(Some(d)) => {
                    if is_shadow(&d) {
                        (404, json!({"ok": false, "error": "DTU not found"}))
                    } else {
                        (200, json!({"ok": true, "dtu": d}))
                    }
                }
                Ok(None) => (404, json!({"ok": false, "error": "DTU not found"})),
                Err(e) => (500, json!({"ok": false, "error": e.to_string()})),
            },
        },
        "/v1/dtus/list" => {
            let req = ListReq {
                viewer: qp.get("viewer").cloned().unwrap_or_default(),
                scope: qp.get("scope").filter(|s| !s.is_empty()).cloned(),
                tier: qp.get("tier").cloned().unwrap_or_else(|| "any".into()),
                q: normalize_lc(qp.get("q").map(|s| s.as_str()).unwrap_or("")),
                mine: matches!(qp.get("mine").map(|s| s.as_str()), Some("true") | Some("1"))
                    || matches!(qp.get("owner").map(|s| s.as_str()), Some("me")),
                limit: qp.get("limit").and_then(|s| s.parse().ok()).unwrap_or(5000).clamp(1, 5000),
                offset: qp.get("offset").and_then(|s| s.parse().ok()).unwrap_or(0),
                viewer_regional: qp.get("viewerRegional").cloned().unwrap_or_default(),
                viewer_national: qp.get("viewerNational").cloned().unwrap_or_default(),
            };
            match list_dtus(conn, &req) {
                Ok((page, total)) => (200, json!({
                    "ok": true, "dtus": page, "total": total,
                    "limit": req.limit, "offset": req.offset,
                })),
                Err(e) => (500, json!({"ok": false, "error": e.to_string()})),
            }
        }
        "/v1/dtus/recent" => {
            let limit = qp.get("limit").and_then(|s| s.parse().ok()).unwrap_or(50usize).clamp(1, 500);
            match recent(conn, limit, qp.get("scope").map(|s| s.as_str()).filter(|s| !s.is_empty()),
                qp.get("tier").map(|s| s.as_str()).filter(|s| !s.is_empty()),
                qp.get("source").map(|s| s.as_str()).filter(|s| !s.is_empty())) {
                Ok(v) => (200, json!({"ok": true, "count": v.len(), "dtus": v})),
                Err(e) => (500, json!({"ok": false, "error": e.to_string()})),
            }
        }
        _ => (404, json!({"ok": false, "error": "not_found"})),
    };

    let mut out = val;
    if let Some(obj) = out.as_object_mut() {
        obj.insert("_ms".into(), json!(started.elapsed().as_millis() as u64));
    }
    respond(stream, status, serde_json::to_vec(&out).unwrap_or_default().as_slice());
}

fn main() {
    let path = db_path();
    // one connection per worker thread; SQLite RO connections are cheap.
    let n_workers: usize = std::env::var("CONCORD_DTU_SIDECAR_WORKERS")
        .ok().and_then(|s| s.parse().ok()).unwrap_or(4).clamp(1, 16);

    let sock = sock_path();
    let _ = std::fs::remove_file(&sock);
    if let Some(dir) = sock.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let listener = UnixListener::bind(&sock).unwrap_or_else(|e| {
        eprintln!("listen {}: {e}", sock.display());
        std::process::exit(1);
    });
    let _ = std::fs::set_permissions(&sock, std::os::unix::fs::PermissionsExt::from_mode(0o600));

    // sanity-open once up front so a bad DB path fails fast + loud
    if let Err(e) = open_ro(&path) {
        eprintln!("open db {path}: {e}");
        std::process::exit(1);
    }
    eprintln!("concord-dtu-sidecar (rust) listening on unix:{} (db={path}, {n_workers} workers, read-only)", sock.display());

    let served = Arc::new(AtomicU64::new(0));
    let listener = Arc::new(listener);

    let mut handles = Vec::new();
    for _ in 0..n_workers {
        let listener = Arc::clone(&listener);
        let served = Arc::clone(&served);
        let path = path.clone();
        handles.push(std::thread::spawn(move || {
            let conn = match open_ro(&path) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("worker open db: {e}");
                    return;
                }
            };
            loop {
                // UnixListener::accept takes &self and is safe to call from
                // multiple threads — the kernel serialises accept() on the fd.
                match listener.accept() {
                    Ok((mut s, _)) => handle(&mut s, &conn, &served),
                    Err(_) => continue,
                }
            }
        }));
    }
    for h in handles {
        let _ = h.join();
    }
}
