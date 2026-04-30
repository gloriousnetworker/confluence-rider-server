import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { successResponse } from "../../utils/api-response.js";
import { uploadToCloudinary } from "../../services/upload.js";
import { AppError } from "../../middleware/error-handler.js";

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  // POST /api/upload/kyc/license — Upload driver's license photo
  app.post("/kyc/license", async (request, reply) => {
    const file = await request.file();
    if (!file) throw new AppError(400, "VALIDATION_ERROR", "No file uploaded");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new AppError(400, "VALIDATION_ERROR", "Only JPEG, PNG, and WebP images allowed");
    }

    const buffer = await file.toBuffer();
    const result = await uploadToCloudinary(buffer, "kyc/license", `license-${request.user.sub}`);

    // Update driver record
    const [driver] = await db
      .select()
      .from(schema.drivers)
      .where(eq(schema.drivers.userId, request.user.sub))
      .limit(1);

    if (driver) {
      await db
        .update(schema.drivers)
        .set({ licensePhotoUrl: result.url, updatedAt: new Date() })
        .where(eq(schema.drivers.id, driver.id));
    }

    return reply.status(201).send(successResponse({
      url: result.url,
      type: "license",
      message: "License photo uploaded successfully",
    }));
  });

  // POST /api/upload/kyc/vehicle — Upload vehicle photo
  app.post("/kyc/vehicle", async (request, reply) => {
    const file = await request.file();
    if (!file) throw new AppError(400, "VALIDATION_ERROR", "No file uploaded");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new AppError(400, "VALIDATION_ERROR", "Only JPEG, PNG, and WebP images allowed");
    }

    const buffer = await file.toBuffer();
    const result = await uploadToCloudinary(buffer, "kyc/vehicle", `vehicle-${request.user.sub}`);

    const [driver] = await db
      .select()
      .from(schema.drivers)
      .where(eq(schema.drivers.userId, request.user.sub))
      .limit(1);

    if (driver) {
      await db
        .update(schema.drivers)
        .set({ vehiclePhotoUrl: result.url, updatedAt: new Date() })
        .where(eq(schema.drivers.id, driver.id));
    }

    return reply.status(201).send(successResponse({
      url: result.url,
      type: "vehicle",
      message: "Vehicle photo uploaded successfully",
    }));
  });

  // POST /api/upload/kyc/profile — Upload profile photo
  app.post("/kyc/profile", async (request, reply) => {
    const file = await request.file();
    if (!file) throw new AppError(400, "VALIDATION_ERROR", "No file uploaded");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new AppError(400, "VALIDATION_ERROR", "Only JPEG, PNG, and WebP images allowed");
    }

    const buffer = await file.toBuffer();
    const result = await uploadToCloudinary(buffer, "kyc/profile", `profile-${request.user.sub}`);

    // Update user avatar
    await db
      .update(schema.users)
      .set({ avatarUrl: result.url, updatedAt: new Date() })
      .where(eq(schema.users.id, request.user.sub));

    // Also update driver profile photo if driver
    const [driver] = await db
      .select()
      .from(schema.drivers)
      .where(eq(schema.drivers.userId, request.user.sub))
      .limit(1);

    if (driver) {
      await db
        .update(schema.drivers)
        .set({ profilePhotoUrl: result.url, updatedAt: new Date() })
        .where(eq(schema.drivers.id, driver.id));
    }

    return reply.status(201).send(successResponse({
      url: result.url,
      type: "profile",
      message: "Profile photo uploaded successfully",
    }));
  });

  // POST /api/upload/kyc/submit — Submit KYC for review (sets status to pending)
  app.post("/kyc/submit", async (request) => {
    const [driver] = await db
      .select()
      .from(schema.drivers)
      .where(eq(schema.drivers.userId, request.user.sub))
      .limit(1);

    if (!driver) {
      throw new AppError(404, "NOT_FOUND", "Driver profile not found. Register as a driver first.");
    }

    // Check all required documents are uploaded
    const missing: string[] = [];
    if (!driver.licensePhotoUrl) missing.push("license photo");
    if (!driver.vehiclePhotoUrl) missing.push("vehicle photo");
    if (!driver.licenseNumber) missing.push("license number");
    if (!driver.plateNumber) missing.push("plate number");

    if (missing.length > 0) {
      throw new AppError(422, "INCOMPLETE_KYC", `Missing: ${missing.join(", ")}`);
    }

    await db
      .update(schema.drivers)
      .set({ verificationStatus: "pending", updatedAt: new Date() })
      .where(eq(schema.drivers.id, driver.id));

    return successResponse({
      message: "KYC submitted for review. You will be notified once approved.",
      status: "pending",
    });
  });

  // GET /api/upload/kyc/status — Check KYC status
  app.get("/kyc/status", async (request) => {
    const [driver] = await db
      .select({
        verificationStatus: schema.drivers.verificationStatus,
        licenseNumber: schema.drivers.licenseNumber,
        plateNumber: schema.drivers.plateNumber,
        vehicleModel: schema.drivers.vehicleModel,
        licensePhotoUrl: schema.drivers.licensePhotoUrl,
        vehiclePhotoUrl: schema.drivers.vehiclePhotoUrl,
        profilePhotoUrl: schema.drivers.profilePhotoUrl,
      })
      .from(schema.drivers)
      .where(eq(schema.drivers.userId, request.user.sub))
      .limit(1);

    if (!driver) {
      return successResponse({ status: "no_profile", message: "No driver profile found" });
    }

    return successResponse({
      status: driver.verificationStatus,
      documents: {
        licenseNumber: driver.licenseNumber || null,
        plateNumber: driver.plateNumber || null,
        vehicleModel: driver.vehicleModel || null,
        licensePhoto: driver.licensePhotoUrl || null,
        vehiclePhoto: driver.vehiclePhotoUrl || null,
        profilePhoto: driver.profilePhotoUrl || null,
      },
    });
  });
};
