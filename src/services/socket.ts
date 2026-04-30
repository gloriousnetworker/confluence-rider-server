import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HttpServer } from "http";

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server attached to the HTTP server.
 */
export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // Join a booking room (rider or driver joins to track a specific booking)
    socket.on("join-booking", (bookingId: string) => {
      socket.join(`booking:${bookingId}`);
      console.log(`[WS] ${socket.id} joined booking:${bookingId}`);
    });

    // Leave booking room
    socket.on("leave-booking", (bookingId: string) => {
      socket.leave(`booking:${bookingId}`);
    });

    // Driver sends location updates
    socket.on("driver-location", (data: { bookingId: string; lat: number; lng: number }) => {
      // Broadcast to everyone in the booking room (rider sees driver move)
      io?.to(`booking:${data.bookingId}`).emit("driver-location-update", {
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString(),
      });
    });

    // Join user's personal room (for notifications)
    socket.on("join-user", (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`[WS] ${socket.id} joined user:${userId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  console.log("[WS] Socket.IO initialized");
  return io;
}

/**
 * Get the Socket.IO instance.
 */
export function getIO(): SocketIOServer | null {
  return io;
}

// ─── Emit helpers (called from services) ───

/**
 * Emit a booking status change to all participants in the booking room.
 */
export function emitBookingStatusChange(bookingId: string, status: string, data?: any) {
  io?.to(`booking:${bookingId}`).emit("booking-status", {
    bookingId,
    status,
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit when a driver is matched to a booking.
 */
export function emitDriverMatched(bookingId: string, driver: any) {
  io?.to(`booking:${bookingId}`).emit("driver-matched", {
    bookingId,
    driver,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit a notification to a specific user.
 */
export function emitNotification(userId: string, notification: any) {
  io?.to(`user:${userId}`).emit("notification", notification);
}

/**
 * Emit SOS alert.
 */
export function emitSosAlert(bookingId: string, alert: any) {
  io?.to(`booking:${bookingId}`).emit("sos-alert", {
    bookingId,
    ...alert,
    timestamp: new Date().toISOString(),
  });
}
