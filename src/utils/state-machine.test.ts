import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  isTerminalStatus,
} from "./state-machine.js";
import { AppError } from "../middleware/error-handler.js";

describe("canTransition", () => {
  // Valid forward transitions
  it("allows finding → negotiating", () => {
    expect(canTransition("finding", "negotiating")).toBe(true);
  });

  it("allows negotiating → accepted", () => {
    expect(canTransition("negotiating", "accepted")).toBe(true);
  });

  it("allows accepted → arriving", () => {
    expect(canTransition("accepted", "arriving")).toBe(true);
  });

  it("allows arriving → ontrip", () => {
    expect(canTransition("arriving", "ontrip")).toBe(true);
  });

  it("allows ontrip → completed", () => {
    expect(canTransition("ontrip", "completed")).toBe(true);
  });

  // Cancellation from any non-terminal state
  it("allows finding → cancelled", () => {
    expect(canTransition("finding", "cancelled")).toBe(true);
  });

  it("allows negotiating → cancelled", () => {
    expect(canTransition("negotiating", "cancelled")).toBe(true);
  });

  it("allows accepted → cancelled", () => {
    expect(canTransition("accepted", "cancelled")).toBe(true);
  });

  it("allows arriving → cancelled", () => {
    expect(canTransition("arriving", "cancelled")).toBe(true);
  });

  it("allows ontrip → cancelled", () => {
    expect(canTransition("ontrip", "cancelled")).toBe(true);
  });

  // Invalid transitions
  it("rejects completed → anything", () => {
    expect(canTransition("completed", "finding")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });

  it("rejects cancelled → anything", () => {
    expect(canTransition("cancelled", "finding")).toBe(false);
    expect(canTransition("cancelled", "completed")).toBe(false);
  });

  it("rejects skipping states", () => {
    expect(canTransition("finding", "accepted")).toBe(false);
    expect(canTransition("finding", "ontrip")).toBe(false);
    expect(canTransition("negotiating", "arriving")).toBe(false);
  });

  it("rejects backwards transitions", () => {
    expect(canTransition("accepted", "negotiating")).toBe(false);
    expect(canTransition("arriving", "accepted")).toBe(false);
    expect(canTransition("ontrip", "arriving")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("does not throw for valid transitions", () => {
    expect(() => assertTransition("finding", "negotiating")).not.toThrow();
    expect(() => assertTransition("ontrip", "completed")).not.toThrow();
  });

  it("throws AppError for invalid transitions", () => {
    expect(() => assertTransition("finding", "completed")).toThrow(AppError);
  });

  it("throws with INVALID_STATE_TRANSITION code", () => {
    try {
      assertTransition("completed", "finding");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("INVALID_STATE_TRANSITION");
      expect((err as AppError).statusCode).toBe(422);
    }
  });
});

describe("isTerminalStatus", () => {
  it("returns true for completed", () => {
    expect(isTerminalStatus("completed")).toBe(true);
  });

  it("returns true for cancelled", () => {
    expect(isTerminalStatus("cancelled")).toBe(true);
  });

  it("returns false for non-terminal states", () => {
    expect(isTerminalStatus("finding")).toBe(false);
    expect(isTerminalStatus("negotiating")).toBe(false);
    expect(isTerminalStatus("accepted")).toBe(false);
    expect(isTerminalStatus("arriving")).toBe(false);
    expect(isTerminalStatus("ontrip")).toBe(false);
  });
});
