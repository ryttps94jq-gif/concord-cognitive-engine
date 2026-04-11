/**
 * @fileoverview Security headers middleware for Concord server.
 *
 * Provides a standalone, lightweight security-headers layer that can be used
 * alongside (or instead of) Helmet.  When Helmet is available it handles most
 * of these headers already, but this module guarantees the exact policy values
 * specified by the project security requirements regardless of Helmet config.
 *
 * Headers set:
 *   Content-Security-Policy
 *   Strict-Transport-Security
 *   X-Frame-Options
 *   X-Content-Type-Options
 *   X-XSS-Protection
 *   Referrer-Policy
 *   Permissions-Policy
 */

/**
 * Express middleware that sets hardened security response headers.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export default function securityHeaders(req, res, next) {
  // ---- Content-Security-Policy ------------------------------------------------
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws:; object-src 'none'; frame-ancestors 'none'"
  );

  // ---- Strict-Transport-Security ---------------------------------------------
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  // ---- Legacy / defence-in-depth headers -------------------------------------
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // ---- Referrer-Policy -------------------------------------------------------
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // ---- Permissions-Policy ----------------------------------------------------
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  next();
}
