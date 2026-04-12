/**
 * Browser Automation Routes — Playwright-Powered Endpoints
 *
 * Provides REST API for browser automation tasks:
 *   POST /api/browser/fetch       — Fetch JS-rendered page, return DTU-ready content
 *   POST /api/browser/screenshot  — Screenshot a URL, return PNG image
 *   POST /api/browser/extract     — Extract data using CSS selectors
 *   POST /api/browser/form        — Fill and submit a form
 *   POST /api/browser/scroll      — Infinite-scroll capture
 *   POST /api/browser/scrape-feed — Scheduled rendered scraping for feeds
 *   GET  /api/browser/status      — Engine health status
 *
 * All mutating endpoints require authentication.
 * All results include source URL provenance for DTU creation.
 */

import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { browserEngine } from "../lib/browser-engine.js";
import { validateSafeFetchUrl } from "../lib/ssrf-guard.js";
import logger from "../logger.js";

/**
 * Create browser automation routes.
 *
 * @param {object} deps
 * @param {Function} [deps.requireAuth] - Auth middleware factory
 * @returns {import('express').Router}
 */
export default function createBrowserRoutes({ requireAuth } = {}) {
  const router = Router();

  // Auth middleware — tolerate missing requireAuth for backward compat
  const auth =
    typeof requireAuth === "function"
      ? requireAuth()
      : (_req, _res, next) => next();

  // ── Validation helpers ────────────────────────────────────────────────

  // SECURITY: browser automation was previously only validating URL FORMAT,
  // letting an authenticated caller point playwright at any internal
  // service — localhost, cloud metadata (169.254.169.254), private
  // RFC1918, etc. We now run the shared SSRF guard that normalizes and
  // rejects private ranges, CGNAT, IPv6 v4-mapped, and decimal-encoded IPs.
  async function requireUrl(req, res) {
    const url = req.body?.url;
    if (!url || typeof url !== "string") {
      res.status(400).json({ ok: false, error: "url (string) is required" });
      return null;
    }
    const check = await validateSafeFetchUrl(url);
    if (!check.ok) {
      res.status(400).json({ ok: false, error: check.error });
      return null;
    }
    return check.url; // canonicalized
  }

  // ── GET /api/browser/status — Engine health ───────────────────────────

  router.get("/status", (req, res) => {
    res.json({
      ok: true,
      active: browserEngine.isActive(),
      engine: "playwright-chromium",
      version: "1.0.0",
    });
  });

  // ── POST /api/browser/fetch — Fetch rendered page ─────────────────────

  router.post(
    "/fetch",
    auth,
    asyncHandler(async (req, res) => {
      const url = await requireUrl(req, res);
      if (!url) return;

      const { waitFor, timeout } = req.body;
      logger.info?.("[browser-routes] fetch", { url });

      const result = await browserEngine.fetchRenderedPage(url, {
        waitFor,
        timeout: timeout ? Number(timeout) : undefined,
      });

      if (!result.ok) {
        return res.status(502).json(result);
      }

      // Return DTU-ready content
      res.json({
        ok: true,
        title: result.title,
        text: result.text,
        html: result.html,
        url: result.url,
        provenance: result.provenance,
        // DTU-ready shape for ingest pipeline
        dtuReady: {
          title: result.title,
          content: result.text,
          sourceUrl: url,
          meta: {
            via: "browser-engine",
            rendered: true,
            fetchedAt: result.provenance.fetchedAt,
            sourceUrl: url,
          },
        },
      });
    })
  );

  // ── POST /api/browser/screenshot — Capture page as PNG ────────────────

  router.post(
    "/screenshot",
    auth,
    asyncHandler(async (req, res) => {
      const url = await requireUrl(req, res);
      if (!url) return;

      const { fullPage, waitFor, timeout, viewport } = req.body;
      logger.info?.("[browser-routes] screenshot", { url, fullPage });

      const result = await browserEngine.screenshot(url, {
        fullPage: fullPage === true,
        waitFor,
        timeout: timeout ? Number(timeout) : undefined,
        viewport: viewport || undefined,
      });

      if (!result.ok) {
        return res.status(502).json({
          ok: false,
          error: result.error,
          provenance: result.provenance,
        });
      }

      // If client wants JSON (base64), check Accept header
      if (req.headers.accept?.includes("application/json")) {
        return res.json({
          ok: true,
          image: result.buffer.toString("base64"),
          mimeType: result.mimeType,
          provenance: result.provenance,
        });
      }

      // Default: return raw PNG
      res.set("Content-Type", result.mimeType);
      res.set(
        "Content-Disposition",
        `inline; filename="screenshot-${Date.now()}.png"`
      );
      res.set(
        "X-Provenance-Url",
        url
      );
      res.set(
        "X-Provenance-FetchedAt",
        result.provenance.fetchedAt
      );
      res.send(result.buffer);
    })
  );

  // ── POST /api/browser/extract — Extract data with selectors ───────────

  router.post(
    "/extract",
    auth,
    asyncHandler(async (req, res) => {
      const url = await requireUrl(req, res);
      if (!url) return;

      const { selectors, waitFor, timeout } = req.body;

      if (!selectors || typeof selectors !== "object" || Array.isArray(selectors)) {
        return res.status(400).json({
          ok: false,
          error: "selectors must be an object mapping names to CSS selectors",
        });
      }

      logger.info?.("[browser-routes] extract", {
        url,
        selectorCount: Object.keys(selectors).length,
      });

      const result = await browserEngine.extractData(url, selectors, {
        waitFor,
        timeout: timeout ? Number(timeout) : undefined,
      });

      if (!result.ok) {
        return res.status(502).json(result);
      }

      res.json(result);
    })
  );

  // ── POST /api/browser/form — Fill and submit a form ────────────────────

  router.post(
    "/form",
    auth,
    asyncHandler(async (req, res) => {
      const url = await requireUrl(req, res);
      if (!url) return;

      const { fields, submitSelector, timeout } = req.body;

      if (!Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({
          ok: false,
          error: "fields must be a non-empty array of {selector, value, type?}",
        });
      }

      logger.info?.("[browser-routes] form", {
        url,
        fieldCount: fields.length,
      });

      const result = await browserEngine.fillForm(url, fields, {
        submitSelector,
        timeout: timeout ? Number(timeout) : undefined,
      });

      if (!result.ok) {
        return res.status(502).json(result);
      }

      res.json(result);
    })
  );

  // ── POST /api/browser/scroll — Infinite scroll capture ─────────────────

  router.post(
    "/scroll",
    auth,
    asyncHandler(async (req, res) => {
      const url = await requireUrl(req, res);
      if (!url) return;

      const { maxScrolls, scrollPauseMs, itemSelector, timeout } = req.body;
      logger.info?.("[browser-routes] scroll", { url, maxScrolls, itemSelector });

      const result = await browserEngine.scrollAndCapture(url, {
        maxScrolls: maxScrolls ? Number(maxScrolls) : undefined,
        scrollPauseMs: scrollPauseMs ? Number(scrollPauseMs) : undefined,
        itemSelector,
        timeout: timeout ? Number(timeout) : undefined,
      });

      if (!result.ok) {
        return res.status(502).json(result);
      }

      res.json(result);
    })
  );

  // ── POST /api/browser/scrape-feed — Rendered scraping for feeds ────────

  router.post(
    "/scrape-feed",
    auth,
    asyncHandler(async (req, res) => {
      const url = await requireUrl(req, res);
      if (!url) return;

      const {
        feedId,
        selectors,
        itemSelector,
        waitFor,
        timeout,
        scroll,
      } = req.body;

      logger.info?.("[browser-routes] scrape-feed", { url, feedId });

      // Step 1: Fetch the rendered page
      const pageResult = await browserEngine.fetchRenderedPage(url, {
        waitFor,
        timeout: timeout ? Number(timeout) : undefined,
      });

      if (!pageResult.ok) {
        return res.status(502).json({
          ok: false,
          error: pageResult.error,
          provenance: pageResult.provenance,
        });
      }

      // Step 2: If selectors provided, extract structured data
      let extractedData = null;
      if (selectors && typeof selectors === "object") {
        const extractResult = await browserEngine.extractData(url, selectors, {
          waitFor,
          timeout: timeout ? Number(timeout) : undefined,
        });
        if (extractResult.ok) {
          extractedData = extractResult.data;
        }
      }

      // Step 3: If scroll requested, do infinite scroll capture
      let scrollData = null;
      if (scroll) {
        const scrollResult = await browserEngine.scrollAndCapture(url, {
          maxScrolls: scroll.maxScrolls,
          scrollPauseMs: scroll.scrollPauseMs,
          itemSelector: itemSelector || scroll.itemSelector,
          timeout: timeout ? Number(timeout) : undefined,
        });
        if (scrollResult.ok) {
          scrollData = {
            items: scrollResult.items,
            scrolls: scrollResult.scrolls,
            totalHeight: scrollResult.totalHeight,
          };
        }
      }

      res.json({
        ok: true,
        feedId: feedId || null,
        title: pageResult.title,
        text: pageResult.text,
        extractedData,
        scrollData,
        provenance: pageResult.provenance,
        // DTU-ready items from extracted/scrolled content
        dtuItems: buildDTUItems({
          feedId,
          url,
          title: pageResult.title,
          text: pageResult.text,
          extractedData,
          scrollData,
          provenance: pageResult.provenance,
        }),
      });
    })
  );

  return router;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build DTU-ready items from scrape-feed results.
 * Normalizes extracted data and scroll items into a consistent shape.
 */
function buildDTUItems({ feedId, url, title, text, extractedData, scrollData, provenance }) {
  const items = [];
  const now = new Date().toISOString();
  const baseMeta = {
    via: "browser-engine",
    rendered: true,
    feedId: feedId || null,
    sourceUrl: url,
    fetchedAt: provenance.fetchedAt,
  };

  // Main page content as a single DTU item
  if (text) {
    items.push({
      title: title || url,
      content: text.slice(0, 50_000),
      sourceUrl: url,
      publishedAt: now,
      meta: baseMeta,
    });
  }

  // Extracted data items — if there are "headlines" or "titles" selectors,
  // each extracted element becomes its own item
  if (extractedData) {
    for (const [name, elements] of Object.entries(extractedData)) {
      for (const el of elements) {
        if (el.text && el.text.length > 5) {
          items.push({
            title: el.text.slice(0, 200),
            content: el.text,
            sourceUrl: el.href || url,
            publishedAt: now,
            meta: { ...baseMeta, extractedBy: name },
          });
        }
      }
    }
  }

  // Scroll items
  if (scrollData?.items) {
    for (const itemText of scrollData.items) {
      if (itemText && itemText.length > 10) {
        items.push({
          title: itemText.slice(0, 200),
          content: itemText,
          sourceUrl: url,
          publishedAt: now,
          meta: { ...baseMeta, source: "infinite-scroll" },
        });
      }
    }
  }

  return items;
}
