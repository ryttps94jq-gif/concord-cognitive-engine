// concord-dtu-sidecar — read-only SQLite follower for the DTU substrate.
//
// Concurrency Refactor Phase 3. The Node monolith does every DTU/economy read
// with synchronous better-sqlite3 on the event loop. This process opens
// concord.db READ-ONLY (query_only pragma, ro mode) and answers get-by-id /
// recent / FTS-search over a Unix socket, so those reads stop blocking the loop.
//
// SINGLE WRITER stays Node. This sidecar NEVER writes. WAL mode lets it read a
// consistent snapshot while Node writes.
//
//	GET /v1/health
//	GET /v1/dtu?id=...
//	GET /v1/dtus/recent?limit=50&owner=...&visibility=...
//	GET /v1/dtus/search?q=...&limit=50
//
// Socket: $CONCORD_DTU_SIDECAR_SOCK
//
//	(default /Users/dutch/concord/run/concord-dtu-sidecar.sock)
//
// DB:     $CONCORD_DB_PATH || $DB_PATH || /Users/dutch/concord/concord.db
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	_ "modernc.org/sqlite"
)

var (
	db        *sql.DB
	startedAt = time.Now()
	served    int64
)

func dbPath() string {
	for _, k := range []string{"CONCORD_DB_PATH", "DB_PATH"} {
		if v := os.Getenv(k); v != "" {
			return v
		}
	}
	return "/Users/dutch/concord/concord.db"
}

func sockPath() string {
	if v := os.Getenv("CONCORD_DTU_SIDECAR_SOCK"); v != "" {
		return v
	}
	run := os.Getenv("CONCORD_RUN_DIR")
	if run == "" {
		run = filepath.Join(os.Getenv("HOME"), "concord", "run")
	}
	return filepath.Join(run, "concord-dtu-sidecar.sock")
}

func openDB() (*sql.DB, error) {
	// ro + immutable-free so we still see WAL commits; query_only hard-blocks writes.
	dsn := "file:" + dbPath() + "?mode=ro&_pragma=query_only(1)&_pragma=busy_timeout(4000)&_txlock=deferred"
	d, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	d.SetMaxOpenConns(8)
	d.SetMaxIdleConns(4)
	d.SetConnMaxLifetime(0)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := d.PingContext(ctx); err != nil {
		return nil, err
	}
	return d, nil
}

// dtuColumns — the subset the locker/mint UI actually needs. Mirrors migration
// schema for `dtus`. Kept explicit (never SELECT *) so a schema add doesn't
// change the response shape silently.
const dtuCols = `id, owner_user_id, title, body_json, tags_json, visibility, tier,
	created_at, updated_at, federation_tier, creti_score, price, lens_id, size_kb, version`

type dtuRow struct {
	ID             string   `json:"id"`
	OwnerUserID    *string  `json:"ownerUserId"`
	Title          string   `json:"title"`
	Body           any      `json:"body"`
	Tags           any      `json:"tags"`
	Visibility     string   `json:"visibility"`
	Tier           string   `json:"tier"`
	CreatedAt      string   `json:"createdAt"`
	UpdatedAt      string   `json:"updatedAt"`
	FederationTier *string  `json:"federationTier"`
	CretiScore     *int64   `json:"cretiScore"`
	Price          *float64 `json:"price"`
	LensID         *string  `json:"lensId"`
	SizeKb         *float64 `json:"sizeKb"`
	Version        *int64   `json:"version"`
}

func scanDTU(rows *sql.Rows) (dtuRow, error) {
	var d dtuRow
	var body, tags string
	err := rows.Scan(&d.ID, &d.OwnerUserID, &d.Title, &body, &tags, &d.Visibility, &d.Tier,
		&d.CreatedAt, &d.UpdatedAt, &d.FederationTier, &d.CretiScore, &d.Price, &d.LensID,
		&d.SizeKb, &d.Version)
	if err != nil {
		return d, err
	}
	d.Body = json.RawMessage(orJSON(body, "{}"))
	d.Tags = json.RawMessage(orJSON(tags, "[]"))
	return d, nil
}

func orJSON(s, fallback string) string {
	s = strings.TrimSpace(s)
	if s == "" || !json.Valid([]byte(s)) {
		return fallback
	}
	return s
}

func main() {
	var err error
	db, err = openDB()
	if err != nil {
		log.Fatalf("open db %s: %v", dbPath(), err)
	}
	defer db.Close()

	sock := sockPath()
	_ = os.Remove(sock)
	if err := os.MkdirAll(filepath.Dir(sock), 0o755); err != nil {
		log.Fatalf("mkdir run dir: %v", err)
	}
	ln, err := net.Listen("unix", sock)
	if err != nil {
		log.Fatalf("listen %s: %v", sock, err)
	}
	_ = os.Chmod(sock, 0o600)

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/health", handleHealth)
	mux.HandleFunc("/v1/dtu", handleGetDTU)
	mux.HandleFunc("/v1/dtus/recent", handleRecent)
	mux.HandleFunc("/v1/dtus/search", handleSearch)

	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("concord-dtu-sidecar listening on unix:%s (db=%s, read-only)", sock, dbPath())
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serve: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	_ = os.Remove(sock)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	served++
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	var n int64
	var writable string
	_ = db.QueryRow(`SELECT count(*) FROM dtus`).Scan(&n)
	_ = db.QueryRow(`PRAGMA query_only`).Scan(&writable)
	writeJSON(w, 200, map[string]any{
		"ok": true, "service": "concord-dtu-sidecar",
		"uptimeSec": int(time.Since(startedAt).Seconds()),
		"served":    served, "dtuRows": n, "queryOnly": writable, "db": dbPath(),
	})
}

func handleGetDTU(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "id required"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, `SELECT `+dtuCols+` FROM dtus WHERE id = ? LIMIT 1`, id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	defer rows.Close()
	if !rows.Next() {
		writeJSON(w, 404, map[string]any{"ok": false, "error": "not_found", "id": id})
		return
	}
	d, err := scanDTU(rows)
	if err != nil {
		writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "dtu": d})
}

func clampLimit(s string, def, max int) int {
	n, err := strconv.Atoi(s)
	if err != nil || n <= 0 {
		return def
	}
	if n > max {
		return max
	}
	return n
}

func handleRecent(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := clampLimit(q.Get("limit"), 50, 500)
	where := []string{"1=1"}
	args := []any{}
	if o := q.Get("owner"); o != "" {
		where = append(where, "owner_user_id = ?")
		args = append(args, o)
	}
	if v := q.Get("visibility"); v != "" {
		where = append(where, "visibility = ?")
		args = append(args, v)
	}
	if t := q.Get("tier"); t != "" {
		where = append(where, "tier = ?")
		args = append(args, t)
	}
	args = append(args, limit)
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	sqlStr := `SELECT ` + dtuCols + ` FROM dtus WHERE ` + strings.Join(where, " AND ") +
		` ORDER BY created_at DESC LIMIT ?`
	rows, err := db.QueryContext(ctx, sqlStr, args...)
	if err != nil {
		writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	defer rows.Close()
	out := []dtuRow{}
	for rows.Next() {
		d, err := scanDTU(rows)
		if err != nil {
			writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		out = append(out, d)
	}
	writeJSON(w, 200, map[string]any{"ok": true, "count": len(out), "dtus": out})
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	term := strings.TrimSpace(q.Get("q"))
	if term == "" {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "q required"})
		return
	}
	limit := clampLimit(q.Get("limit"), 50, 200)
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	// FTS5 external-content table dtus_fts (content='dtus', content_rowid='rowid')
	rows, err := db.QueryContext(ctx, `
		SELECT `+prefixed(dtuCols, "d.")+`
		FROM dtus_fts f JOIN dtus d ON d.rowid = f.rowid
		WHERE dtus_fts MATCH ?
		ORDER BY rank
		LIMIT ?`, ftsSanitize(term), limit)
	if err != nil {
		writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error(), "hint": "fts5 query"})
		return
	}
	defer rows.Close()
	out := []dtuRow{}
	for rows.Next() {
		d, err := scanDTU(rows)
		if err != nil {
			writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		out = append(out, d)
	}
	writeJSON(w, 200, map[string]any{"ok": true, "count": len(out), "dtus": out})
}

func prefixed(cols, p string) string {
	parts := strings.Split(cols, ",")
	for i := range parts {
		parts[i] = p + strings.TrimSpace(parts[i])
	}
	return strings.Join(parts, ", ")
}

// ftsSanitize wraps each bare token as a quoted FTS string so user input can't
// inject FTS operators / unbalanced quotes. Prefix-match on the last token.
func ftsSanitize(s string) string {
	fields := strings.Fields(s)
	q := make([]string, 0, len(fields))
	for _, f := range fields {
		f = strings.ReplaceAll(f, `"`, "")
		if f == "" {
			continue
		}
		q = append(q, `"`+f+`"`)
	}
	if len(q) == 0 {
		return `""`
	}
	return strings.Join(q, " ")
}
