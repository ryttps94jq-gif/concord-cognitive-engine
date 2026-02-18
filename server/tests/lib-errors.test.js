import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ConcordError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  DatabaseError,
} from "../lib/errors.js";

describe("ConcordError hierarchy", () => {
  it("ConcordError has correct defaults", () => {
    const err = new ConcordError("test error");
    assert.equal(err.message, "test error");
    assert.equal(err.code, "INTERNAL_ERROR");
    assert.equal(err.statusCode, 500);
    assert.equal(err.name, "ConcordError");
    assert.ok(err.timestamp);
    assert.ok(err instanceof Error);
  });

  it("ConcordError.toJSON returns safe client response", () => {
    const err = new ConcordError("bad thing", { code: "BAD", statusCode: 418, context: { x: 1 } });
    const json = err.toJSON();
    assert.equal(json.ok, false);
    assert.equal(json.error, "bad thing");
    assert.equal(json.code, "BAD");
    assert.deepEqual(json.context, { x: 1 });
    // Must not include stack
    assert.equal(json.stack, undefined);
  });

  it("ConcordError.toJSON omits empty context", () => {
    const err = new ConcordError("simple");
    const json = err.toJSON();
    assert.equal(json.context, undefined);
  });

  it("ConcordError preserves cause chain", () => {
    const cause = new Error("original");
    const err = new ConcordError("wrapped", { cause });
    assert.equal(err.cause, cause);
  });

  it("ValidationError is 400", () => {
    const err = new ValidationError("bad input", { field: "name" });
    assert.equal(err.statusCode, 400);
    assert.equal(err.code, "VALIDATION_ERROR");
    assert.equal(err.name, "ValidationError");
    assert.ok(err instanceof ConcordError);
    assert.ok(err instanceof Error);
  });

  it("AuthenticationError is 401", () => {
    const err = new AuthenticationError();
    assert.equal(err.statusCode, 401);
    assert.equal(err.code, "AUTH_REQUIRED");
    assert.equal(err.message, "Authentication required");
  });

  it("AuthorizationError is 403", () => {
    const err = new AuthorizationError();
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, "FORBIDDEN");
  });

  it("NotFoundError is 404 with resource info", () => {
    const err = new NotFoundError("DTU", "abc123");
    assert.equal(err.statusCode, 404);
    assert.equal(err.code, "NOT_FOUND");
    assert.equal(err.message, "DTU not found: abc123");
    assert.equal(err.context.resource, "DTU");
    assert.equal(err.context.id, "abc123");
  });

  it("NotFoundError works without id", () => {
    const err = new NotFoundError("Session");
    assert.equal(err.message, "Session not found");
  });

  it("ConflictError is 409", () => {
    const err = new ConflictError("version mismatch");
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, "CONFLICT");
  });

  it("RateLimitError is 429", () => {
    const err = new RateLimitError();
    assert.equal(err.statusCode, 429);
    assert.equal(err.code, "RATE_LIMITED");
  });

  it("ServiceUnavailableError is 503 with service name", () => {
    const err = new ServiceUnavailableError("Ollama");
    assert.equal(err.statusCode, 503);
    assert.equal(err.code, "SERVICE_UNAVAILABLE");
    assert.equal(err.message, "Ollama is currently unavailable");
  });

  it("DatabaseError is 500", () => {
    const err = new DatabaseError("connection lost");
    assert.equal(err.statusCode, 500);
    assert.equal(err.code, "DATABASE_ERROR");
  });

  it("all error types are instanceof ConcordError", () => {
    const errors = [
      new ValidationError("x"),
      new AuthenticationError(),
      new AuthorizationError(),
      new NotFoundError("x"),
      new ConflictError(),
      new RateLimitError(),
      new ServiceUnavailableError("x"),
      new DatabaseError("x"),
    ];
    for (const err of errors) {
      assert.ok(err instanceof ConcordError, `${err.name} should be instanceof ConcordError`);
      assert.ok(err instanceof Error, `${err.name} should be instanceof Error`);
    }
  });
});
