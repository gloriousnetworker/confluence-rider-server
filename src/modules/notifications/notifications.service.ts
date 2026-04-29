import { eq, and, count, desc } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";
import { getOffset, buildPaginationMeta } from "../../utils/pagination.js";

export async function getNotifications(
  userId: string,
  filters: { type?: string; unread?: boolean; page: number; limit: number }
) {
  const conditions: any[] = [eq(schema.notifications.userId, userId)];

  if (filters.type) {
    conditions.push(eq(schema.notifications.type, filters.type as any));
  }
  if (filters.unread !== undefined) {
    conditions.push(eq(schema.notifications.isRead, !filters.unread));
  }

  const [totalResult] = await db
    .select({ total: count() })
    .from(schema.notifications)
    .where(and(...conditions));

  const total = totalResult?.total ?? 0;
  const offset = getOffset(filters.page, filters.limit);

  const notifs = await db
    .select()
    .from(schema.notifications)
    .where(and(...conditions))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(filters.limit)
    .offset(offset);

  return {
    notifications: notifs,
    meta: buildPaginationMeta(filters.page, filters.limit, total),
  };
}

export async function markAsRead(notificationId: string, userId: string) {
  const [notif] = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.id, notificationId))
    .limit(1);

  if (!notif) throw new AppError(404, "NOT_FOUND", "Notification not found");
  if (notif.userId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");

  const [updated] = await db
    .update(schema.notifications)
    .set({ isRead: true })
    .where(eq(schema.notifications.id, notificationId))
    .returning();

  return updated;
}

export async function getUnreadCount(userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(schema.notifications)
    .where(
      and(eq(schema.notifications.userId, userId), eq(schema.notifications.isRead, false))
    );

  return { count: result?.count ?? 0 };
}
