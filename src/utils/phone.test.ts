import { describe, it, expect } from "vitest";
import { normalizePhone, isValidPhone } from "./phone.js";

describe("normalizePhone", () => {
  it("returns +234 format as-is", () => {
    expect(normalizePhone("+2348012345678")).toBe("+2348012345678");
  });

  it("adds + to 234 prefix", () => {
    expect(normalizePhone("2348012345678")).toBe("+2348012345678");
  });

  it("converts 0-prefix local format", () => {
    expect(normalizePhone("08012345678")).toBe("+2348012345678");
  });

  it("converts bare 10-digit number", () => {
    expect(normalizePhone("8012345678")).toBe("+2348012345678");
  });

  it("strips whitespace and dashes", () => {
    expect(normalizePhone("+234 801 234 5678")).toBe("+2348012345678");
    expect(normalizePhone("0801-234-5678")).toBe("+2348012345678");
  });

  it("strips parentheses", () => {
    expect(normalizePhone("(0)8012345678")).toBe("+2348012345678");
  });

  it("returns invalid input as-is after cleaning", () => {
    expect(normalizePhone("123")).toBe("123");
    expect(normalizePhone("abcdefghij")).toBe("abcdefghij");
  });
});

describe("isValidPhone", () => {
  it("accepts valid +234 format", () => {
    expect(isValidPhone("+2348012345678")).toBe(true);
    expect(isValidPhone("+2349098765432")).toBe(true);
    expect(isValidPhone("+2347034567890")).toBe(true);
  });

  it("rejects numbers without +234 prefix", () => {
    expect(isValidPhone("08012345678")).toBe(false);
    expect(isValidPhone("2348012345678")).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(isValidPhone("+234801234567")).toBe(false); // too short
    expect(isValidPhone("+23480123456789")).toBe(false); // too long
  });

  it("rejects non-numeric characters", () => {
    expect(isValidPhone("+234801ABCDEFG")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidPhone("")).toBe(false);
  });
});
