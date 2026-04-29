import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createBookingSchema,
  bookingParamsSchema,
  calculateFareSchema,
  acceptDriverSchema,
  updateStatusSchema,
  rateBookingSchema,
  cancelBookingSchema,
} from "./bookings.schema.js";
import * as bookingsService from "./bookings.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";

export const bookingsRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook("preHandler", authenticate);

  // POST /api/bookings
  typedApp.post(
    "/",
    {
      schema: {
        body: createBookingSchema,
        tags: ["Bookings"],
        summary: "Create a new booking",
      },
    },
    async (request, reply) => {
      const data = await bookingsService.createBooking(request.user.sub, request.body);
      return reply.status(201).send(successResponse(data));
    }
  );

  // GET /api/bookings/:id
  typedApp.get(
    "/:id",
    {
      schema: {
        params: bookingParamsSchema,
        tags: ["Bookings"],
        summary: "Get booking details",
      },
    },
    async (request) => {
      const data = await bookingsService.getBooking(request.params.id, request.user.sub);
      return successResponse(data);
    }
  );

  // POST /api/bookings/:id/calculate-fare
  typedApp.post(
    "/:id/calculate-fare",
    {
      schema: {
        params: bookingParamsSchema,
        body: calculateFareSchema,
        tags: ["Bookings"],
        summary: "Set negotiated fare (status → negotiating)",
      },
    },
    async (request) => {
      const data = await bookingsService.setNegotiatedFare(
        request.params.id,
        request.user.sub,
        request.body.negotiatedFare
      );
      return successResponse(data);
    }
  );

  // GET /api/bookings/:id/available-drivers
  typedApp.get(
    "/:id/available-drivers",
    {
      schema: {
        params: bookingParamsSchema,
        tags: ["Bookings"],
        summary: "Get available drivers with counter-offers",
      },
    },
    async (request) => {
      const data = await bookingsService.getAvailableDrivers(request.params.id, request.user.sub);
      return successResponse(data);
    }
  );

  // POST /api/bookings/:id/accept-driver
  typedApp.post(
    "/:id/accept-driver",
    {
      schema: {
        params: bookingParamsSchema,
        body: acceptDriverSchema,
        tags: ["Bookings"],
        summary: "Accept a driver and agreed fare (status → accepted)",
      },
    },
    async (request) => {
      const data = await bookingsService.acceptDriver(
        request.params.id,
        request.user.sub,
        request.body
      );
      return successResponse(data);
    }
  );

  // PATCH /api/bookings/:id/status
  typedApp.patch(
    "/:id/status",
    {
      schema: {
        params: bookingParamsSchema,
        body: updateStatusSchema,
        tags: ["Bookings"],
        summary: "Advance booking status (arriving, ontrip)",
      },
    },
    async (request) => {
      const data = await bookingsService.updateStatus(
        request.params.id,
        request.user.sub,
        request.body.status
      );
      return successResponse(data);
    }
  );

  // POST /api/bookings/:id/complete
  typedApp.post(
    "/:id/complete",
    {
      schema: {
        params: bookingParamsSchema,
        tags: ["Bookings"],
        summary: "Complete trip (deducts wallet, updates driver stats)",
      },
    },
    async (request) => {
      const data = await bookingsService.completeBooking(request.params.id, request.user.sub);
      return successResponse(data);
    }
  );

  // POST /api/bookings/:id/cancel
  typedApp.post(
    "/:id/cancel",
    {
      schema: {
        params: bookingParamsSchema,
        body: cancelBookingSchema,
        tags: ["Bookings"],
        summary: "Cancel booking",
      },
    },
    async (request) => {
      const data = await bookingsService.cancelBooking(
        request.params.id,
        request.user.sub,
        request.body.reason
      );
      return successResponse(data);
    }
  );

  // POST /api/bookings/:id/rate
  typedApp.post(
    "/:id/rate",
    {
      schema: {
        params: bookingParamsSchema,
        body: rateBookingSchema,
        tags: ["Bookings"],
        summary: "Rate completed booking (1-5 stars)",
      },
    },
    async (request) => {
      const data = await bookingsService.rateBooking(
        request.params.id,
        request.user.sub,
        request.body
      );
      return successResponse(data);
    }
  );

  // POST /api/bookings/:id/sos
  typedApp.post(
    "/:id/sos",
    {
      schema: {
        params: bookingParamsSchema,
        tags: ["Bookings"],
        summary: "Activate SOS emergency alert",
      },
    },
    async (request) => {
      const data = await bookingsService.activateSos(request.params.id, request.user.sub);
      return successResponse(data);
    }
  );

  // POST /api/bookings/:id/share
  typedApp.post(
    "/:id/share",
    {
      schema: {
        params: bookingParamsSchema,
        tags: ["Bookings"],
        summary: "Get shareable trip info",
      },
    },
    async (request) => {
      const data = await bookingsService.shareBooking(request.params.id, request.user.sub);
      return successResponse(data);
    }
  );
};
