import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";
import bcrypt from "bcrypt";

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = postgres(url);
  const db = drizzle(sql, { schema });

  console.log("Seeding database...\n");

  // 1. Seed landmarks
  const landmarkData = [
    { name: "GTBank Roundabout", area: "Lokoja", isPopular: true },
    { name: "Nataco Junction", area: "Lokoja", isPopular: true },
    { name: "Ganaja Junction", area: "Lokoja", isPopular: true },
    { name: "Lokongoma", area: "Lokoja", isPopular: true },
    { name: "Felele", area: "Lokoja", isPopular: true },
    { name: "Crusher Junction", area: "Okene", isPopular: true },
    { name: "Kogi State University", area: "Anyigba", isPopular: true },
    { name: "Federal Polytechnic Idah", area: "Idah", isPopular: true },
    { name: "Kabba Main Market", area: "Kabba", isPopular: false },
    { name: "Okene Central Mosque", area: "Okene", isPopular: false },
    { name: "Confluence Beach", area: "Lokoja", isPopular: false },
    { name: "Mount Patti", area: "Lokoja", isPopular: false },
  ];

  await db.insert(schema.landmarks).values(landmarkData).onConflictDoNothing();
  console.log(`  ✓ Seeded ${landmarkData.length} landmarks`);

  // 2. Seed test rider
  const passwordHash = await bcrypt.hash("Password123", 10);
  const [testRider] = await db
    .insert(schema.users)
    .values({
      name: "Adamu Usman",
      phone: "+2348012345678",
      email: "adamu@example.com",
      passwordHash,
      role: "rider",
      memberStatus: "gold",
      isPhoneVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  if (testRider) {
    console.log(`  ✓ Seeded test rider: ${testRider.name} (${testRider.phone})`);

    // Create wallet for test rider
    await db
      .insert(schema.wallets)
      .values({ userId: testRider.id, balance: 8450 })
      .onConflictDoNothing();
    console.log("  ✓ Seeded rider wallet with ₦8,450 balance");
  }

  // 3. Seed test admin
  const adminHash = await bcrypt.hash("Admin123456", 10);
  const [testAdmin] = await db
    .insert(schema.users)
    .values({
      name: "Admin User",
      phone: "+2348000000001",
      email: "admin@confluenceride.ng",
      passwordHash: adminHash,
      role: "admin",
      isPhoneVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  if (testAdmin) {
    console.log(`  ✓ Seeded test admin: ${testAdmin.name} (${testAdmin.phone})`);
    await db
      .insert(schema.wallets)
      .values({ userId: testAdmin.id, balance: 0 })
      .onConflictDoNothing();
  }

  // 4. Seed drivers (with user accounts)
  const driverUsers = [
    {
      name: "Musa Ibrahim",
      phone: "+2348012345600",
      zone: "Lokoja Central",
      vehicleType: "keke" as const,
      rating: "4.8",
      totalTrips: 342,
      licenseNumber: "KG-DRV-001",
      vehicleModel: "Bajaj RE",
      vehicleColor: "Yellow",
      plateNumber: "KG-123-ABC",
    },
    {
      name: "Fatima Abdullahi",
      phone: "+2348098765400",
      zone: "Ganaja",
      vehicleType: "car" as const,
      rating: "4.9",
      totalTrips: 521,
      licenseNumber: "KG-DRV-002",
      vehicleModel: "Toyota Corolla",
      vehicleColor: "White",
      plateNumber: "KG-456-DEF",
    },
    {
      name: "Ojo Emmanuel",
      phone: "+2348034567800",
      zone: "Felele",
      vehicleType: "bike" as const,
      rating: "4.7",
      totalTrips: 289,
      licenseNumber: "KG-DRV-003",
      vehicleModel: "Honda ACE",
      vehicleColor: "Black",
      plateNumber: "KG-789-GHI",
    },
  ];

  for (const driverData of driverUsers) {
    const driverPasswordHash = await bcrypt.hash("Driver123", 10);

    const [driverUser] = await db
      .insert(schema.users)
      .values({
        name: driverData.name,
        phone: driverData.phone,
        passwordHash: driverPasswordHash,
        role: "driver",
        isPhoneVerified: true,
      })
      .onConflictDoNothing()
      .returning();

    if (driverUser) {
      await db
        .insert(schema.wallets)
        .values({ userId: driverUser.id, balance: 0 })
        .onConflictDoNothing();

      const [driver] = await db
        .insert(schema.drivers)
        .values({
          userId: driverUser.id,
          name: driverData.name,
          phone: driverData.phone,
          rating: driverData.rating,
          totalTrips: driverData.totalTrips,
          zone: driverData.zone,
          vehicleType: driverData.vehicleType,
          licenseNumber: driverData.licenseNumber,
          vehicleModel: driverData.vehicleModel,
          vehicleColor: driverData.vehicleColor,
          plateNumber: driverData.plateNumber,
          verificationStatus: "approved",
          isVerified: true,
          isOnline: true,
        })
        .onConflictDoNothing()
        .returning();

      if (driver) {
        // Create vehicle record
        await db
          .insert(schema.vehicles)
          .values({
            driverId: driver.id,
            type: driverData.vehicleType,
            model: driverData.vehicleModel,
            color: driverData.vehicleColor,
            plateNumber: driverData.plateNumber,
          })
          .onConflictDoNothing();
      }

      console.log(`  ✓ Seeded driver: ${driverData.name} (${driverData.vehicleType})`);
    }
  }

  // 5. Seed promo code
  await db
    .insert(schema.promoCodes)
    .values({
      code: "CONFLUENCE50",
      discountPercent: 50,
      isActive: true,
      expiresAt: new Date("2026-12-31"),
      usageLimit: 1000,
    })
    .onConflictDoNothing();
  console.log("  ✓ Seeded promo code: CONFLUENCE50 (50% off)");

  await sql.end();
  console.log("\n✅ Seed complete!");
  console.log("\nTest credentials:");
  console.log("  Rider: +2348012345678 / Password123");
  console.log("  Admin: +2348000000001 / Admin123456");
  console.log("  Drivers: +234801234560X / Driver123");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
