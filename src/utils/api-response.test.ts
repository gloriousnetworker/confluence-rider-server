import { describe, it, expect } from "vitest";
import { successResponse, errorResponse } from "./api-response.js";

describe("successResponse", () => {
  it("wraps data in success envelope", () => {
    const result = successResponse({ name: "test" });
    expect(result).toEqual({
      success: true,
      data: { name: "test" },
    });
  });

  it("includes meta when provided", () => {
    const meta = { page: 1, limit: 20, total: 100, totalPages: 5 };
    const result = successResponse([1, 2, 3], meta);
    expect(result).toEqual({
      success: true,
      data: [1, 2, 3],
      meta,
    });
  });

  it("omits meta when not provided", () => {
    const result = successResponse("hello");
    expect(result).not.toHaveProperty("meta");
  });
});

describe("errorResponse", () => {
  it("wraps error in failure envelope", () => {
    const result = errorResponse("NOT_FOUND", "User not found");
    expect(result).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "User not found",
      },
    });
  });

  it("includes details when provided", () => {
    const details = { field: "phone", issue: "invalid format" };
    const result = errorResponse("VALIDATION_ERROR", "Invalid input", details);
    expect(result).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details,
      },
    });
  });

  it("omits details when not provided", () => {
    const result = errorResponse("INTERNAL_ERROR", "Something went wrong");
    expect(result.error).not.toHaveProperty("details");
  });
});
