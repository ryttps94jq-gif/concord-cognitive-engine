#!/usr/bin/env node
/**
 * OpenStax Textbook Ingestion Script
 *
 * One-time (idempotent) ingestion of OpenStax open-source textbooks into the
 * Concord DTU store. Each textbook section becomes a DTU mapped to the
 * appropriate Concord lens domain.
 *
 * Usage:
 *   node scripts/ingest-openstax.js                  # full ingest
 *   node scripts/ingest-openstax.js --dry-run        # preview only
 *   node scripts/ingest-openstax.js --domain=physics # single domain
 *
 * Requires: better-sqlite3 (from server/node_modules)
 */

import { createHash } from "crypto";
import fs from "fs";
import path from "path";

// ── Logger (graceful fallback) ──────────────────────────────────────────────

let log;
try {
  const mod = await import("../server/logger.js");
  log = mod.default || mod;
} catch {
  log = {
    info: (_src, msg, meta) => console.log(`[INFO]  ${msg}`, meta || ""),
    warn: (_src, msg, meta) => console.warn(`[WARN]  ${msg}`, meta || ""),
    error: (_src, msg, meta) => console.error(`[ERROR] ${msg}`, meta || ""),
    debug: (_src, msg, meta) => {
      if (process.env.DEBUG) console.log(`[DEBUG] ${msg}`, meta || "");
    },
  };
}

// ── CLI Flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DOMAIN_FILTER = (() => {
  const flag = args.find((a) => a.startsWith("--domain="));
  return flag ? flag.split("=")[1] : null;
})();

// ── Textbook Map ────────────────────────────────────────────────────────────

const TEXTBOOK_MAP = [
  // Physics
  { slug: "college-physics-2e", title: "College Physics 2e", domain: "physics", license: "CC BY 4.0" },
  { slug: "university-physics-volume-1", title: "University Physics Volume 1", domain: "physics", license: "CC BY 4.0" },
  { slug: "university-physics-volume-2", title: "University Physics Volume 2", domain: "physics", license: "CC BY 4.0" },
  { slug: "university-physics-volume-3", title: "University Physics Volume 3", domain: "physics", license: "CC BY 4.0" },

  // Chemistry
  { slug: "chemistry-2e", title: "Chemistry 2e", domain: "chem", license: "CC BY 4.0" },
  { slug: "organic-chemistry", title: "Organic Chemistry", domain: "chem", license: "CC BY 4.0" },

  // Biology
  { slug: "biology-2e", title: "Biology 2e", domain: "bio", license: "CC BY 4.0" },
  { slug: "microbiology", title: "Microbiology", domain: "bio", license: "CC BY 4.0" },

  // Healthcare
  { slug: "anatomy-and-physiology-2e", title: "Anatomy & Physiology 2e", domain: "healthcare", license: "CC BY 4.0" },

  // Astronomy
  { slug: "astronomy-2e", title: "Astronomy 2e", domain: "astronomy", license: "CC BY 4.0" },

  // Psychology / Mental Health
  { slug: "psychology-2e", title: "Psychology 2e", domain: "mental-health", license: "CC BY 4.0" },

  // Economics / Finance
  { slug: "principles-macroeconomics-3e", title: "Principles of Economics: Macroeconomics 3e", domain: "finance", license: "CC BY 4.0" },
  { slug: "principles-microeconomics-3e", title: "Principles of Economics: Microeconomics 3e", domain: "finance", license: "CC BY 4.0" },

  // Accounting
  { slug: "principles-financial-accounting", title: "Principles of Accounting, Volume 1: Financial Accounting", domain: "accounting", license: "CC BY 4.0" },
  { slug: "principles-managerial-accounting", title: "Principles of Accounting, Volume 2: Managerial Accounting", domain: "accounting", license: "CC BY 4.0" },

  // Legal
  { slug: "business-ethics", title: "Business Ethics", domain: "legal", license: "CC BY 4.0" },
  { slug: "american-government-3e", title: "American Government 3e", domain: "legal", license: "CC BY 4.0" },

  // Marketing
  { slug: "principles-marketing", title: "Principles of Marketing", domain: "marketing", license: "CC BY 4.0" },

  // HR
  { slug: "organizational-behavior", title: "Organizational Behavior", domain: "hr", license: "CC BY 4.0" },

  // Consulting / Management
  { slug: "principles-management", title: "Principles of Management", domain: "consulting", license: "CC BY 4.0" },

  // Global / Sociology
  { slug: "introduction-sociology-3e", title: "Introduction to Sociology 3e", domain: "global", license: "CC BY 4.0" },

  // History
  { slug: "us-history", title: "U.S. History", domain: "history", license: "CC BY 4.0" },
  { slug: "world-history-volume-1", title: "World History Volume 1: to 1500", domain: "history", license: "CC BY 4.0" },
  { slug: "world-history-volume-2", title: "World History Volume 2: from 1400", domain: "history", license: "CC BY 4.0" },

  // Mathematics
  { slug: "introductory-statistics-2e", title: "Introductory Statistics 2e", domain: "mathematics", license: "CC BY 4.0" },
  { slug: "college-algebra-2e", title: "College Algebra 2e", domain: "mathematics", license: "CC BY 4.0" },
  { slug: "algebra-and-trigonometry-2e", title: "Algebra and Trigonometry 2e", domain: "mathematics", license: "CC BY 4.0" },
  { slug: "precalculus-2e", title: "Precalculus 2e", domain: "mathematics", license: "CC BY 4.0" },
  { slug: "calculus-volume-1", title: "Calculus Volume 1", domain: "mathematics", license: "CC BY-NC-SA 4.0" },
  { slug: "calculus-volume-2", title: "Calculus Volume 2", domain: "mathematics", license: "CC BY-NC-SA 4.0" },
  { slug: "calculus-volume-3", title: "Calculus Volume 3", domain: "mathematics", license: "CC BY-NC-SA 4.0" },

  // Food / Nutrition
  { slug: "nutrition", title: "Nutrition for Nurses", domain: "food", license: "CC BY 4.0" },

  // Finance / Business
  { slug: "introduction-business", title: "Introduction to Business", domain: "finance", license: "CC BY 4.0" },

  // Marketplace / Entrepreneurship
  { slug: "entrepreneurship", title: "Entrepreneurship", domain: "marketplace", license: "CC BY 4.0" },
];

// ── Utilities ───────────────────────────────────────────────────────────────

const MAX_CONTENT_LENGTH = 5000;

function makeHash(input) {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/**
 * Split content into chunks of at most MAX_CONTENT_LENGTH characters,
 * preferring to break on paragraph boundaries.
 */
function chunkContent(text, maxLen = MAX_CONTENT_LENGTH) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to break on a paragraph boundary
    let breakIdx = remaining.lastIndexOf("\n\n", maxLen);
    if (breakIdx < maxLen * 0.3) {
      // Fall back to sentence boundary
      breakIdx = remaining.lastIndexOf(". ", maxLen);
    }
    if (breakIdx < maxLen * 0.3) {
      // Fall back to hard cut
      breakIdx = maxLen;
    }

    chunks.push(remaining.slice(0, breakIdx + 1).trim());
    remaining = remaining.slice(breakIdx + 1).trim();
  }

  return chunks;
}

/**
 * Extract simple keywords from a title/content string.
 */
function extractKeywords(title, content) {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "this", "that",
    "these", "those", "it", "its", "not", "no", "nor", "so", "as", "if",
    "than", "then", "into", "about", "up", "out", "each", "which", "their",
    "there", "what", "when", "where", "how", "all", "both", "few", "more",
    "most", "other", "some", "such", "only", "own", "same", "also", "very",
  ]);

  const combined = `${title} ${(content || "").slice(0, 1000)}`;
  const words = combined
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Deduplicate, keep order, max 10
  const seen = new Set();
  const result = [];
  for (const w of words) {
    if (!seen.has(w) && result.length < 10) {
      seen.add(w);
      result.push(w);
    }
  }
  return result;
}

// ── OpenStax Fetcher ────────────────────────────────────────────────────────

/**
 * Attempt to fetch the table of contents / content from the OpenStax API.
 * Returns an array of section objects or null if network is unavailable.
 */
async function fetchBookSections(book) {
  const archiveUrl = `https://openstax.org/apps/archive/contents/${book.slug}`;
  const fallbackUrl = `https://openstax.org/books/${book.slug}/pages/1-introduction`;

  for (const url of [archiveUrl, fallbackUrl]) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("json")) {
        const data = await res.json();
        return parseArchiveJSON(data, book);
      }

      // HTML fallback — extract basic structure
      const html = await res.text();
      return parseHTMLToc(html, book);
    } catch (err) {
      log.debug("ingest-openstax", `Fetch failed for ${url}: ${err.message}`);
      continue;
    }
  }

  return null; // network blocked or book not found
}

/**
 * Parse the OpenStax archive JSON into section objects.
 */
function parseArchiveJSON(data, book) {
  const sections = [];

  function walk(tree, chapterNum = 0, sectionNum = 0) {
    if (!tree) return;

    // The archive API nests content in a tree structure
    if (tree.title && tree.contents) {
      // This is a chapter/unit container
      const childChapter = chapterNum + 1;
      let childSection = 0;
      for (const child of tree.contents) {
        childSection++;
        walk(child, childChapter, childSection);
      }
    } else if (tree.title) {
      // Leaf section
      const content = tree.content || tree.abstract || tree.description || "";

      // Skip problem sets and end-of-chapter exercises
      const titleLower = (tree.title || "").toLowerCase();
      if (
        titleLower.includes("problems") ||
        titleLower.includes("exercises") ||
        titleLower.includes("review questions") ||
        titleLower.includes("critical thinking") ||
        titleLower.includes("test prep")
      ) {
        return;
      }

      sections.push({
        title: tree.title,
        content: typeof content === "string" ? content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "",
        chapter: chapterNum,
        section: sectionNum,
        objectives: tree.learningObjectives || tree.learning_objectives || [],
        url: tree.url || tree.canonicalUrl || "",
      });
    }

    // Walk children if it is an array
    if (Array.isArray(tree)) {
      let ch = 0;
      for (const item of tree) {
        ch++;
        walk(item, ch, 0);
      }
    }
  }

  // Handle various API response shapes
  if (data.tree) {
    walk(data.tree);
  } else if (data.content) {
    walk(data.content);
  } else if (Array.isArray(data)) {
    walk(data);
  } else {
    walk(data);
  }

  return sections.length > 0 ? sections : null;
}

/**
 * Parse basic ToC structure from HTML page.
 */
function parseHTMLToc(html, book) {
  const sections = [];
  // Extract section titles from HTML headings
  const headingRe = /<h[23][^>]*>([^<]+)<\/h[23]>/gi;
  let match;
  let chapterNum = 0;
  let sectionNum = 0;

  while ((match = headingRe.exec(html)) !== null) {
    const title = match[1].trim();
    if (!title) continue;

    // Detect chapter vs section from numbering pattern
    const numMatch = title.match(/^(\d+)\.(\d+)/);
    if (numMatch) {
      chapterNum = parseInt(numMatch[1], 10);
      sectionNum = parseInt(numMatch[2], 10);
    } else if (title.match(/^chapter\s+(\d+)/i)) {
      chapterNum = parseInt(title.match(/(\d+)/)[1], 10);
      sectionNum = 0;
      continue; // Skip chapter-level headings, get sections
    } else {
      sectionNum++;
    }

    const titleLower = title.toLowerCase();
    if (
      titleLower.includes("problems") ||
      titleLower.includes("exercises") ||
      titleLower.includes("review questions")
    ) {
      continue;
    }

    sections.push({
      title,
      content: "",
      chapter: chapterNum,
      section: sectionNum,
      objectives: [],
      url: "",
    });
  }

  return sections.length > 0 ? sections : null;
}

/**
 * Generate stub sections when network is unavailable.
 * Creates representative placeholder DTUs from known textbook structure.
 */
function generateStubSections(book) {
  // Generate a reasonable number of stub sections per book
  const stubChapters = estimateChapterCount(book.domain);
  const sections = [];

  for (let ch = 1; ch <= stubChapters; ch++) {
    for (let sec = 1; sec <= 3; sec++) {
      sections.push({
        title: `Chapter ${ch}, Section ${sec}`,
        content: `[Stub] Content for ${book.title}, Chapter ${ch}, Section ${sec}. ` +
          `This is a placeholder DTU generated during offline ingestion. ` +
          `Full content should be fetched from OpenStax when network is available. ` +
          `Visit https://openstax.org/books/${book.slug} for the complete textbook.`,
        chapter: ch,
        section: sec,
        objectives: [`Understand key concepts from ${book.title} Chapter ${ch}.${sec}`],
        url: `https://openstax.org/books/${book.slug}/pages/${ch}-${sec}`,
        isStub: true,
      });
    }
  }

  return sections;
}

function estimateChapterCount(domain) {
  const estimates = {
    physics: 12,
    chem: 10,
    bio: 12,
    healthcare: 10,
    astronomy: 8,
    "mental-health": 10,
    finance: 8,
    accounting: 8,
    legal: 8,
    marketing: 8,
    hr: 8,
    consulting: 8,
    global: 8,
    history: 10,
    mathematics: 8,
    food: 6,
    marketplace: 8,
  };
  return estimates[domain] || 8;
}

// ── DTU Builder ─────────────────────────────────────────────────────────────

/**
 * Build DTU objects from a list of section data for a given book.
 */
function buildDTUs(book, sections) {
  const now = new Date().toISOString();
  const dtus = [];

  for (const section of sections) {
    const chunks = chunkContent(section.content);

    for (let i = 0; i < chunks.length; i++) {
      const chunkSuffix = chunks.length > 1 ? ` (Part ${i + 1})` : "";
      const sectionLabel = section.title || `Chapter ${section.chapter}.${section.section}`;
      const dtuTitle = `OpenStax ${book.title}: ${sectionLabel}${chunkSuffix}`;

      const chunkId = chunks.length > 1
        ? `${book.slug}:${section.chapter}:${section.section}:${i}`
        : `${book.slug}:${section.chapter}:${section.section}`;
      const id = `openstax_${makeHash(chunkId)}`;

      const topicKeywords = extractKeywords(sectionLabel, chunks[i]);
      const sectionUrl = section.url ||
        `https://openstax.org/books/${book.slug}/pages/${section.chapter}-${section.section}`;

      const dtu = {
        id,
        title: dtuTitle,
        tier: "regular",
        scope: book.domain,
        tags: [book.domain, "openstax", "textbook", ...topicKeywords],
        source: {
          name: "OpenStax",
          url: `https://openstax.org/books/${book.slug}`,
          license: book.license,
          attribution: `\u00a9 OpenStax. Licensed under ${book.license}. Download free at openstax.org`,
          fetchedAt: now,
          via: "openstax-ingest",
        },
        core: {
          definitions: [chunks[i]],
          assertions: Array.isArray(section.objectives) ? section.objectives : [],
          evidence: [
            { type: "url", value: sectionUrl, label: "OpenStax" },
          ],
        },
        meta: {
          via: "openstax-ingest",
          editable: false,
          textbook: book.title,
          chapter: section.chapter,
          section: section.section,
          fetchedAt: now,
          ...(section.isStub ? { stub: true } : {}),
        },
        createdAt: now,
        updatedAt: now,
        epistemologicalStance: "reported",
      };

      dtus.push(dtu);
    }
  }

  return dtus;
}

// ── Database ────────────────────────────────────────────────────────────────

async function openDatabaseAsync() {
  const dataDir = process.env.DATA_DIR || "./data";
  const dbPath = path.join(dataDir, "concord.db");

  let targetPath = dbPath;
  if (!fs.existsSync(dbPath)) {
    const altPath = path.join("server", "data", "concord.db");
    if (fs.existsSync(altPath)) {
      targetPath = altPath;
    } else {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  try {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const Database = require("better-sqlite3");
    const db = new Database(targetPath);
    db.pragma("journal_mode = WAL");
    return db;
  } catch (e) {
    log.error("ingest-openstax", `Cannot open database at ${targetPath}: ${e.message}`);
    return null;
  }
}

function ensureDtuTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dtu_store (
      id TEXT PRIMARY KEY,
      title TEXT,
      tier TEXT DEFAULT 'regular',
      scope TEXT DEFAULT 'global',
      tags TEXT DEFAULT '[]',
      source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dtu_tier ON dtu_store(tier);
    CREATE INDEX IF NOT EXISTS idx_dtu_scope ON dtu_store(scope);
    CREATE INDEX IF NOT EXISTS idx_dtu_source ON dtu_store(source);
    CREATE INDEX IF NOT EXISTS idx_dtu_updated ON dtu_store(updated_at DESC);
  `);
}

function persistDTU(db, insertStmt, existsStmt, dtu) {
  // Idempotent: skip if already exists
  const existing = existsStmt.get(dtu.id);
  if (existing) return false;

  insertStmt.run(
    dtu.id,
    dtu.title || "",
    dtu.tier || "regular",
    dtu.scope || "global",
    JSON.stringify(dtu.tags || []),
    dtu.source?.name || "OpenStax",
    dtu.createdAt,
    dtu.updatedAt,
    JSON.stringify(dtu)
  );
  return true;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  OPENSTAX TEXTBOOK INGESTION SCRIPT      ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log(`  Mode:      ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`  Domain:    ${DOMAIN_FILTER || "ALL"}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log("");

  // Filter textbooks by domain if specified
  const books = DOMAIN_FILTER
    ? TEXTBOOK_MAP.filter((b) => b.domain === DOMAIN_FILTER)
    : TEXTBOOK_MAP;

  if (books.length === 0) {
    console.error(`No textbooks found for domain: ${DOMAIN_FILTER}`);
    console.error(`Available domains: ${[...new Set(TEXTBOOK_MAP.map((b) => b.domain))].join(", ")}`);
    process.exit(1);
  }

  console.log(`  Textbooks: ${books.length}`);
  console.log("");

  // Open database (unless dry run)
  let db = null;
  let insertStmt = null;
  let existsStmt = null;

  if (!DRY_RUN) {
    db = await openDatabaseAsync();
    if (db) {
      ensureDtuTable(db);
      insertStmt = db.prepare(`
        INSERT OR IGNORE INTO dtu_store (id, title, tier, scope, tags, source, created_at, updated_at, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      existsStmt = db.prepare("SELECT 1 FROM dtu_store WHERE id = ?");
      console.log("  Database:  Connected");
    } else {
      console.warn("  Database:  NOT AVAILABLE (DTUs will not be persisted)");
    }
  }

  console.log("");
  console.log("─── INGESTION ─────────────────────────────");
  console.log("");

  const summary = {
    total: 0,
    created: 0,
    skipped: 0,
    errors: 0,
    stubbed: 0,
    fetched: 0,
    byDomain: {},
  };

  for (const book of books) {
    const domainCount = summary.byDomain[book.domain] || 0;
    process.stdout.write(`  [${book.domain.padEnd(12)}] ${book.title}... `);

    try {
      // Try fetching real content, fall back to stubs
      let sections = await fetchBookSections(book);
      let source = "fetched";

      if (!sections || sections.length === 0) {
        sections = generateStubSections(book);
        source = "stubbed";
        summary.stubbed++;
      } else {
        summary.fetched++;
      }

      const dtus = buildDTUs(book, sections);
      let bookCreated = 0;
      let bookSkipped = 0;

      for (const dtu of dtus) {
        summary.total++;

        if (DRY_RUN) {
          bookCreated++;
          summary.created++;
          continue;
        }

        if (db) {
          try {
            const inserted = persistDTU(db, insertStmt, existsStmt, dtu);
            if (inserted) {
              bookCreated++;
              summary.created++;
            } else {
              bookSkipped++;
              summary.skipped++;
            }
          } catch (e) {
            summary.errors++;
            log.error("ingest-openstax", `Failed to persist DTU ${dtu.id}: ${e.message}`);
          }
        } else {
          bookCreated++;
          summary.created++;
        }
      }

      summary.byDomain[book.domain] = domainCount + bookCreated;
      console.log(`${source} | ${dtus.length} sections | ${bookCreated} created, ${bookSkipped} skipped`);
    } catch (err) {
      summary.errors++;
      console.log(`ERROR: ${err.message}`);
      log.error("ingest-openstax", `Failed to process ${book.slug}`, { error: err.message });
    }
  }

  // Close database
  if (db) {
    try {
      db.close();
    } catch {
      // ignore
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log("");
  console.log("─── SUMMARY ───────────────────────────────");
  console.log("");
  console.log(`  Total DTUs processed: ${summary.total}`);
  console.log(`  Created:              ${summary.created}`);
  console.log(`  Skipped (existing):   ${summary.skipped}`);
  console.log(`  Errors:               ${summary.errors}`);
  console.log(`  Books fetched:        ${summary.fetched}`);
  console.log(`  Books stubbed:        ${summary.stubbed}`);
  console.log("");
  console.log("  By domain:");
  for (const [domain, count] of Object.entries(summary.byDomain).sort()) {
    console.log(`    ${domain.padEnd(14)} ${count}`);
  }
  console.log("");

  if (DRY_RUN) {
    console.log("  ** DRY RUN — no data was written **");
    console.log("");
  }

  if (summary.errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
