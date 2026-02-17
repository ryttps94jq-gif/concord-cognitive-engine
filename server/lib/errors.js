/**
 * Concord Cognitive Engine — Custom Error Hierarchy
 *
 * Provides structured, typed errors with error codes, HTTP status mapping,
 * and context preservation through the call stack.
 */

/**
 * Base error for all Concord-specific errors.
 * Preserves error context and provides consistent serialization.
 */
export class ConcordError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {object} [options]
   * @param {string} [options.code] - Machine-readable error code (e.g. "DTU_NOT_FOUND")
   * @param {number} [options.statusCode] - HTTP status code (default: 500)
   * @param {object} [options.context] - Additional context for debugging
   * @param {Error}  [options.cause] - Original error that caused this one
   */
  constructor(message, { code = "INTERNAL_ERROR", statusCode = 500, context = {}, cause } = {}) {
    super(message, { cause });
    this.name = "ConcordError";
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  /** Serialize for API responses (safe for clients — no stack trace). */
  toJSON() {
    return {
      ok: false,
      error: this.message,
      code: this.code,
      ...(Object.keys(this.context).length > 0 ? { context: this.context } : {}),
    };
  }
}

/** 400 — client sent invalid input. */
export class ValidationError extends ConcordError {
  constructor(message, context = {}) {
    super(message, { code: "VALIDATION_ERROR", statusCode: 400, context });
    this.name = "ValidationError";
  }
}

/** 401 — authentication required or failed. */
export class AuthenticationError extends ConcordError {
  constructor(message = "Authentication required", context = {}) {
    super(message, { code: "AUTH_REQUIRED", statusCode: 401, context });
    this.name = "AuthenticationError";
  }
}

/** 403 — authenticated but not authorized for this action. */
export class AuthorizationError extends ConcordError {
  constructor(message = "Insufficient permissions", context = {}) {
    super(message, { code: "FORBIDDEN", statusCode: 403, context });
    this.name = "AuthorizationError";
  }
}

/** 404 — requested resource doesn't exist. */
export class NotFoundError extends ConcordError {
  constructor(resource = "Resource", id, context = {}) {
    super(`${resource} not found${id ? `: ${id}` : ""}`, {
      code: "NOT_FOUND",
      statusCode: 404,
      context: { resource, id, ...context },
    });
    this.name = "NotFoundError";
  }
}

/** 409 — write conflict (optimistic concurrency). */
export class ConflictError extends ConcordError {
  constructor(message = "Resource conflict", context = {}) {
    super(message, { code: "CONFLICT", statusCode: 409, context });
    this.name = "ConflictError";
  }
}

/** 429 — rate limit exceeded. */
export class RateLimitError extends ConcordError {
  constructor(message = "Rate limit exceeded", context = {}) {
    super(message, { code: "RATE_LIMITED", statusCode: 429, context });
    this.name = "RateLimitError";
  }
}

/** 503 — downstream service (LLM, DB, etc.) unavailable. */
export class ServiceUnavailableError extends ConcordError {
  constructor(service = "service", context = {}) {
    super(`${service} is currently unavailable`, {
      code: "SERVICE_UNAVAILABLE",
      statusCode: 503,
      context: { service, ...context },
    });
    this.name = "ServiceUnavailableError";
  }
}

/** 500 — database operation failed. */
export class DatabaseError extends ConcordError {
  constructor(message, context = {}) {
    super(message, { code: "DATABASE_ERROR", statusCode: 500, context });
    this.name = "DatabaseError";
  }
}
