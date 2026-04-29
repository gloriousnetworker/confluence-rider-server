import { describe, it, expect } from "vitest";
import { getOffset, buildPaginationMeta, paginationSchema } from "./pagination.js";

describe("getOffset", () => {
  it("returns 0 for page 1", () => {
    expect(getOffset(1, 20)).toBe(0);
  });

  it("calculates offset for page 2", () => {
    expect(getOffset(2, 20)).toBe(20);
  });

  it("calculates offset for page 3 with limit 10", () => {
    expect(getOffset(3, 10)).toBe(20);
  });

  it("handles large page numbers", () => {
    expect(getOffset(100, 50)).toBe(4950);
  });
});

describe("buildPaginationMeta", () => {
  it("calculates total pages correctly", () => {
    const meta = buildPaginationMeta(1, 20, 100);
    expect(meta).toEqual({
      page: 1,
      limit: 20,
      total: 100,
      totalPages: 5,
    });
  });

  it("rounds up total pages", () => {
    const meta = buildPaginationMeta(1, 20, 101);
    expect(meta.totalPages).toBe(6);
  });

  it("returns 1 total page for small results", () => {
    const meta = buildPaginationMeta(1, 20, 5);
    expect(meta.totalPages).toBe(1);
  });

  it("returns 0 total pages for empty results", () => {
    const meta = buildPaginationMeta(1, 20, 0);
    expect(meta.totalPages).toBe(0);
  });
});

describe("paginationSchema", () => {
  it("applies defaults", () => {
    const result = paginationSchema.parse({});
    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it("coerces string values", () => {
    const result = paginationSchema.parse({ page: "3", limit: "50" });
    expect(result).toEqual({ page: 3, limit: 50 });
  });

  it("rejects page < 1", () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
  });

  it("rejects limit > 100", () => {
    expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
  });

  it("rejects negative limit", () => {
    expect(() => paginationSchema.parse({ limit: -1 })).toThrow();
  });
});
