import { PrismaClient, Role, SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile, copyFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

const prisma = new PrismaClient();
const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "../../uploads");

async function makeSampleImage(filePath: string, color: string, label: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const svg = `
    <svg width="600" height="900" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${color}"/>
          <stop offset="100%" stop-color="#2a1518"/>
        </linearGradient>
      </defs>
      <rect width="600" height="900" fill="url(#g)"/>
      <rect x="40" y="40" width="520" height="820" fill="none" stroke="#C4A35A" stroke-width="4"/>
      <text x="300" y="450" text-anchor="middle" fill="#F5E6C8" font-size="36" font-family="Georgia, serif">${label}</text>
    </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(filePath);
}

async function main() {
  console.log("Seeding…");

  await prisma.auditLog.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.tryOnResult.deleteMany();
  await prisma.tryOnJob.deleteMany();
  await prisma.customerConsent.deleteMany();
  await prisma.sareeImage.deleteMany();
  await prisma.sareeProduct.deleteMany();
  await prisma.storeSettings.deleteMany();
  await prisma.storeMember.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.store.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.billingEvent.deleteMany();
  await prisma.aiProvider.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.user.deleteMany();

  const plans = await Promise.all([
    prisma.subscriptionPlan.create({
      data: {
        code: "BASIC",
        name: "Basic",
        priceInrPaise: 4999_00,
        monthlyCredits: 200,
      },
    }),
    prisma.subscriptionPlan.create({
      data: {
        code: "PROFESSIONAL",
        name: "Professional",
        priceInrPaise: 9999_00,
        monthlyCredits: 500,
      },
    }),
    prisma.subscriptionPlan.create({
      data: {
        code: "ENTERPRISE",
        name: "Enterprise",
        priceInrPaise: 19999_00,
        monthlyCredits: 1500,
      },
    }),
  ]);

  await prisma.aiProvider.createMany({
    data: [
      { code: "demo", name: "Demo Try-On Provider", isEnabled: true, configHint: "No credentials" },
      { code: "external", name: "External API Provider", isEnabled: false, configHint: "EXTERNAL_TRYON_URL + API key" },
      { code: "selfhosted", name: "Self-Hosted FastAPI", isEnabled: false, configHint: "AI_WORKER_URL" },
    ],
  });

  const adminHash = await bcrypt.hash("Admin123!", 12);
  const retailerHash = await bcrypt.hash("Retailer123!", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@trail9.local",
      name: "Platform Admin",
      passwordHash: adminHash,
      isSuperAdmin: true,
    },
  });

  const retailer = await prisma.user.create({
    data: {
      email: "retailer@demo-sarees.local",
      name: "Demo Silk House Owner",
      passwordHash: retailerHash,
      isSuperAdmin: false,
    },
  });

  const org = await prisma.organisation.create({
    data: { name: "Demo Silk House", slug: "demo-silk-house" },
  });

  const store = await prisma.store.create({
    data: {
      organisationId: org.id,
      name: "Demo Silk House — Hyderabad",
      slug: "demo-silk-house",
      settings: {
        create: {
          primaryColor: "#42105C",
          accentColor: "#D99A22",
          defaultLocale: "en",
          retentionHours: 24,
          welcomeMessage: "Welcome to Demo Silk House. Try our sarees virtually — free in-store demo.",
          privacyNotice:
            "We capture a photo only after you consent. Images are stored privately and deleted within 24 hours.",
        },
      },
    },
  });

  await prisma.storeMember.create({
    data: { storeId: store.id, userId: retailer.id, role: Role.ORG_OWNER },
  });

  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await prisma.subscription.create({
    data: {
      organisationId: org.id,
      planId: plans[1].id,
      status: SubscriptionStatus.DEMO,
      creditsRemaining: 500,
      creditsPeriodTotal: 500,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  const samples = [
    { name: "Kanchipuram Temple Border", color: "#6B1E2E", fabric: "Silk", occasion: "Wedding", price: 18500 },
    { name: "Pochampally Ikat", color: "#1E3A5F", fabric: "Cotton Silk", occasion: "Festive", price: 7200 },
    { name: "Banarasi Gold Zari", color: "#8B6914", fabric: "Silk", occasion: "Wedding", price: 24000 },
    { name: "Uppada Tissue", color: "#4A1942", fabric: "Tissue Silk", occasion: "Party", price: 9800 },
    { name: "Gadwal Cotton", color: "#2F4F3E", fabric: "Cotton", occasion: "Daily", price: 3500 },
    { name: "Dharmavaram Classic", color: "#5C1A1B", fabric: "Pure Silk", occasion: "Wedding", price: 16000 },
  ];

  for (const [i, s] of samples.entries()) {
    const rel = `catalogue/${store.id}/saree-${i + 1}.jpg`;
    const abs = path.join(uploadDir, rel);
    await makeSampleImage(abs, s.color, s.name);
    await prisma.sareeProduct.create({
      data: {
        storeId: store.id,
        name: s.name,
        sku: `DSH-${1000 + i}`,
        description: `Handpicked ${s.fabric} saree for ${s.occasion.toLowerCase()} wear.`,
        fabric: s.fabric,
        color: s.color,
        occasion: s.occasion,
        priceInr: s.price,
        images: { create: [{ path: rel, sortOrder: 0 }] },
      },
    });
  }

  // Person sample for offline tests
  const personRel = `samples/person-demo.jpg`;
  await makeSampleImage(path.join(uploadDir, personRel), "#C4A090", "Sample Person");

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "seed.completed",
      entityType: "platform",
      meta: { storeSlug: store.slug },
    },
  });

  console.log("Seed complete.");
  console.log("  Super-admin: admin@trail9.local / Admin123!");
  console.log("  Retailer:    retailer@demo-sarees.local / Retailer123!");
  console.log("  Kiosk:       /kiosk/demo-silk-house");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
