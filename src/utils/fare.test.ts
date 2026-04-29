import { describe, it, expect } from "vitest";
import { calculateFare, isPeakHour } from "./fare.js";

describe("calculateFare", () => {
  it("calculates bike fare correctly", () => {
    const result = calculateFare({ rideType: "bike", distanceKm: 5 });
    // flagDown(50) + ratePerKm(30) * 5 = 200 → rounded to 200
    expect(result.suggestedFare).toBe(200);
    expect(result.lowFare).toBe(160); // 80%
    expect(result.highFare).toBe(240); // 120%
  });

  it("calculates keke fare correctly", () => {
    const result = calculateFare({ rideType: "keke", distanceKm: 8 });
    // flagDown(50) + ratePerKm(40) * 8 = 370 → rounded to 370
    expect(result.suggestedFare).toBe(370);
    expect(result.lowFare).toBe(296);
    expect(result.highFare).toBe(444);
  });

  it("calculates cab fare correctly", () => {
    const result = calculateFare({ rideType: "cab", distanceKm: 8.2 });
    // flagDown(100) + ratePerKm(60) * 8.2 = 592 → rounded to 590
    expect(result.suggestedFare).toBe(590);
    expect(result.lowFare).toBe(472);
    expect(result.highFare).toBe(708);
  });

  it("calculates shared ride fare correctly", () => {
    const result = calculateFare({ rideType: "shared", distanceKm: 10 });
    // flagDown(30) + ratePerKm(25) * 10 = 280 → rounded to 280
    expect(result.suggestedFare).toBe(280);
  });

  it("calculates intercity fare correctly", () => {
    const result = calculateFare({ rideType: "intercity", distanceKm: 80 });
    // flagDown(500) + ratePerKm(50) * 80 = 4500 → rounded to 4500
    expect(result.suggestedFare).toBe(4500);
  });

  it("calculates campus fare correctly", () => {
    const result = calculateFare({ rideType: "campus", distanceKm: 3 });
    // flagDown(30) + ratePerKm(20) * 3 = 90 → rounded to 90
    expect(result.suggestedFare).toBe(90);
  });

  it("applies peak multiplier", () => {
    const offPeak = calculateFare({ rideType: "cab", distanceKm: 10 });
    const peak = calculateFare({
      rideType: "cab",
      distanceKm: 10,
      peakMultiplier: 1.3,
    });
    expect(peak.suggestedFare).toBeGreaterThan(offPeak.suggestedFare);
  });

  it("applies demand multiplier", () => {
    const normal = calculateFare({ rideType: "keke", distanceKm: 5 });
    const highDemand = calculateFare({
      rideType: "keke",
      distanceKm: 5,
      demandMultiplier: 1.5,
    });
    expect(highDemand.suggestedFare).toBeGreaterThan(normal.suggestedFare);
  });

  it("never returns below flag-down fare", () => {
    const result = calculateFare({ rideType: "cab", distanceKm: 0 });
    expect(result.suggestedFare).toBe(100); // cab flag-down is 100
  });

  it("lowFare is 80% and highFare is 120% of suggested", () => {
    const result = calculateFare({ rideType: "cab", distanceKm: 10 });
    expect(result.lowFare).toBe(Math.round(result.suggestedFare * 0.8));
    expect(result.highFare).toBe(Math.round(result.suggestedFare * 1.2));
  });
});

describe("isPeakHour", () => {
  it("returns true for morning peak (7-9 AM)", () => {
    expect(isPeakHour(new Date("2026-04-29T07:00:00"))).toBe(true);
    expect(isPeakHour(new Date("2026-04-29T08:30:00"))).toBe(true);
  });

  it("returns true for evening peak (4-7 PM)", () => {
    expect(isPeakHour(new Date("2026-04-29T16:00:00"))).toBe(true);
    expect(isPeakHour(new Date("2026-04-29T18:30:00"))).toBe(true);
  });

  it("returns false for off-peak hours", () => {
    expect(isPeakHour(new Date("2026-04-29T10:00:00"))).toBe(false);
    expect(isPeakHour(new Date("2026-04-29T14:00:00"))).toBe(false);
    expect(isPeakHour(new Date("2026-04-29T22:00:00"))).toBe(false);
  });

  it("returns false at boundary (9 AM, 7 PM)", () => {
    expect(isPeakHour(new Date("2026-04-29T09:00:00"))).toBe(false);
    expect(isPeakHour(new Date("2026-04-29T19:00:00"))).toBe(false);
  });
});
