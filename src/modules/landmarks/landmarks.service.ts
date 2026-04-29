import { db } from "../../config/database.js";
import { landmarks } from "../../db/schema/index.js";
import { eq, and, ilike, or } from "drizzle-orm";

export async function getAllLandmarks(filters?: {
  area?: string;
  popular?: boolean;
}) {
  const conditions = [];

  if (filters?.area) {
    conditions.push(ilike(landmarks.area, filters.area));
  }
  if (filters?.popular !== undefined) {
    conditions.push(eq(landmarks.isPopular, filters.popular));
  }

  if (conditions.length > 0) {
    return db
      .select()
      .from(landmarks)
      .where(and(...conditions));
  }

  return db.select().from(landmarks);
}

export async function searchLandmarks(query: string) {
  const pattern = `%${query}%`;
  return db
    .select()
    .from(landmarks)
    .where(or(ilike(landmarks.name, pattern), ilike(landmarks.area, pattern)));
}
