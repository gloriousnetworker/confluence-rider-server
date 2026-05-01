import { eq } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";

// Default settings
const DEFAULTS: Record<string, { value: string; description: string }> = {
  fuel_price_per_litre: { value: "1200", description: "Current fuel price per litre in Naira" },
  platform_fee_percent: { value: "10", description: "Platform fee percentage on each ride" },
  topup_fee_percent: { value: "0", description: "Platform fee percentage on wallet top-ups" },
  min_fare_keke: { value: "200", description: "Minimum fare for keke rides" },
  min_fare_cab: { value: "500", description: "Minimum fare for cab rides" },
  min_fare_bike: { value: "150", description: "Minimum fare for bike rides" },
  avg_km_per_litre: { value: "10", description: "Average km per litre for fare calculation" },
};

/**
 * Get a setting value. Returns default if not in DB.
 */
export async function getSetting(key: string): Promise<string> {
  const [row] = await db
    .select()
    .from(schema.platformSettings)
    .where(eq(schema.platformSettings.key, key))
    .limit(1);

  if (row) return row.value;
  return DEFAULTS[key]?.value || "";
}

/**
 * Get a setting as a number.
 */
export async function getSettingNumber(key: string): Promise<number> {
  const val = await getSetting(key);
  return parseFloat(val) || 0;
}

/**
 * Get all settings.
 */
export async function getAllSettings() {
  const dbSettings = await db.select().from(schema.platformSettings);

  // Merge defaults with DB values
  const result: Record<string, { value: string; description: string }> = {};
  for (const [key, def] of Object.entries(DEFAULTS)) {
    const dbRow = dbSettings.find((s) => s.key === key);
    result[key] = {
      value: dbRow?.value || def.value,
      description: def.description,
    };
  }

  return result;
}

/**
 * Update a setting.
 */
export async function updateSetting(key: string, value: string) {
  const [existing] = await db
    .select()
    .from(schema.platformSettings)
    .where(eq(schema.platformSettings.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(schema.platformSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(schema.platformSettings.key, key));
  } else {
    await db.insert(schema.platformSettings).values({
      key,
      value,
      description: DEFAULTS[key]?.description || "",
    });
  }

  return { key, value };
}

/**
 * Calculate fare based on fuel price and distance.
 * Formula: (distance_km / avg_km_per_litre) * fuel_price * markup
 */
export async function calculateFareFromFuel(distanceKm: number, rideType: string): Promise<{
  fare: number;
  fuelPrice: number;
  distanceKm: number;
  fuelUsed: number;
}> {
  const fuelPrice = await getSettingNumber("fuel_price_per_litre");
  const avgKmPerLitre = await getSettingNumber("avg_km_per_litre");
  const platformFee = await getSettingNumber("platform_fee_percent");

  const fuelUsed = distanceKm / (avgKmPerLitre || 10);
  const baseFuelCost = fuelUsed * fuelPrice;

  // Ride type multipliers (keke is cheapest, cab is most)
  const multipliers: Record<string, number> = {
    bike: 0.8,
    keke: 1.0,
    cab: 1.5,
    shared: 0.7,
    intercity: 1.3,
    campus: 0.6,
  };

  const multiplier = multipliers[rideType] || 1;
  const rawFare = baseFuelCost * multiplier;

  // Get minimum fare
  const minFareKey = `min_fare_${rideType}`;
  const minFare = await getSettingNumber(minFareKey) || 150;

  const fare = Math.max(Math.round(rawFare / 10) * 10, minFare); // round to nearest 10

  return {
    fare,
    fuelPrice,
    distanceKm,
    fuelUsed: Math.round(fuelUsed * 100) / 100,
  };
}
