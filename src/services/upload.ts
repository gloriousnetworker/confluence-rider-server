import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";

// Configure Cloudinary
if (env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  console.log("[Cloudinary] Configured");
}

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Upload a file buffer to Cloudinary.
 * @param buffer - File data as Buffer
 * @param folder - Cloudinary folder (e.g. "kyc/license", "kyc/vehicle")
 * @param fileName - Optional file name
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  fileName?: string
): Promise<UploadResult> {
  if (!env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary is not configured");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `confluence-ride/${folder}`,
        public_id: fileName,
        resource_type: "auto",
        transformation: [
          { width: 1200, height: 1200, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) {
          console.error("[Cloudinary] Upload error:", error);
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete a file from Cloudinary.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!env.CLOUDINARY_CLOUD_NAME) return;
  await cloudinary.uploader.destroy(publicId);
}
