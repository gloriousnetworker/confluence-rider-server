import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { tripsQuerySchema, tripParamsSchema } from "./trips.schema.js";
import * as tripsService from "./trips.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";
import { AppError } from "../../middleware/error-handler.js";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { generateReceiptPdf } from "../../services/pdf.js";

export const tripsRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook("preHandler", authenticate);

  // GET /api/trips
  typedApp.get(
    "/",
    {
      schema: {
        querystring: tripsQuerySchema,
        tags: ["Trips"],
        summary: "Get trip history",
      },
    },
    async (request) => {
      const { trips, meta } = await tripsService.getTrips(request.user.sub, request.query);
      return successResponse(trips, meta);
    }
  );

  // GET /api/trips/:id/receipt
  typedApp.get(
    "/:id/receipt",
    {
      schema: {
        params: tripParamsSchema,
        tags: ["Trips"],
        summary: "Get trip receipt (JSON)",
      },
    },
    async (request) => {
      const data = await tripsService.getReceipt(request.params.id, request.user.sub);
      return successResponse(data);
    }
  );

  // GET /api/trips/:id/receipt/pdf
  typedApp.get(
    "/:id/receipt/pdf",
    {
      schema: {
        params: tripParamsSchema,
        tags: ["Trips"],
        summary: "Download trip receipt as PDF",
      },
    },
    async (request, reply) => {
      const tripId = request.params.id;
      const userId = request.user.sub;

      // Get booking
      const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, tripId)).limit(1);
      if (!booking) throw new AppError(404, "NOT_FOUND", "Trip not found");
      if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");
      if (booking.status !== "completed") throw new AppError(422, "INVALID_STATE_TRANSITION", "Receipt only for completed trips");

      // Get rider
      const [rider] = await db
        .select({ name: schema.users.name, phone: schema.users.phone })
        .from(schema.users).where(eq(schema.users.id, userId)).limit(1);

      // Get driver name
      let driverName: string | null = null;
      if (booking.driverId) {
        const [d] = await db.select({ name: schema.drivers.name }).from(schema.drivers).where(eq(schema.drivers.id, booking.driverId)).limit(1);
        driverName = d?.name || null;
      }

      const pdfBuffer = await generateReceiptPdf({
        bookingId: booking.id,
        rideType: booking.rideType,
        pickup: booking.pickup,
        destination: booking.destination,
        suggestedFare: booking.suggestedFare,
        negotiatedFare: booking.negotiatedFare,
        finalFare: booking.finalFare,
        driverName,
        riderName: rider?.name || "Rider",
        riderPhone: rider?.phone || "",
        startedAt: booking.startedAt?.toISOString() || null,
        completedAt: booking.completedAt?.toISOString() || null,
        estimatedDistanceKm: booking.estimatedDistanceKm,
      });

      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="receipt-${tripId.substring(0, 8)}.pdf"`)
        .send(pdfBuffer);
    }
  );
};
