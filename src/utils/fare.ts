import type { RideType } from "../types/index.js";

interface FareConfig {
  flagDown: number; // Base fare in Naira
  ratePerKm: number; // Rate per kilometer in Naira
}

const fareConfigs: Record<RideType, FareConfig> = {
  bike: { flagDown: 50, ratePerKm: 30 },
  keke: { flagDown: 50, ratePerKm: 40 },
  cab: { flagDown: 100, ratePerKm: 60 },
  shared: { flagDown: 30, ratePerKm: 25 },
  intercity: { flagDown: 500, ratePerKm: 50 },
  campus: { flagDown: 30, ratePerKm: 20 },
};

export interface FareInput {
  rideType: RideType;
  distanceKm: number;
  peakMultiplier?: number; // 1.0 = off-peak, 1.3 = peak (7-9am, 4-7pm)
  demandMultiplier?: number; // 1.0 = normal, up to 1.5 = high demand
}

export interface FareOutput {
  suggestedFare: number;
  lowFare: number;
  highFare: number;
}

/**
 * Determine if the current time is peak hours.
 * Peak: 7-9 AM, 4-7 PM
 */
export function isPeakHour(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return (hour >= 7 && hour < 9) || (hour >= 16 && hour < 19);
}

/**
 * Calculate fare based on ride type, distance, and conditions.
 */
export function calculateFare(input: FareInput): FareOutput {
  const config = fareConfigs[input.rideType];
  const peakMultiplier = input.peakMultiplier ?? 1.0;
  const demandMultiplier = input.demandMultiplier ?? 1.0;

  const rawFare =
    config.flagDown +
    config.ratePerKm * input.distanceKm * peakMultiplier * demandMultiplier;

  // Round to nearest 10
  const suggestedFare = Math.round(rawFare / 10) * 10;

  return {
    suggestedFare: Math.max(suggestedFare, config.flagDown),
    lowFare: Math.round(suggestedFare * 0.8),
    highFare: Math.round(suggestedFare * 1.2),
  };
}
