import { describe, expect, it, beforeAll } from "vitest";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

describe("cross-store catalogue isolation", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  it("sarees from store A are not visible under store B filter", async () => {
    const plan = await prisma.subscriptionPlan.findFirst();
    if (!plan) return;

    const suffix = randomUUID().slice(0, 8);
    const hash = await bcrypt.hash("Temp1234!", 10);

    const userA = await prisma.user.create({
      data: {
        email: `owner-a-${suffix}@test.local`,
        name: "A",
        passwordHash: hash,
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: `owner-b-${suffix}@test.local`,
        name: "B",
        passwordHash: hash,
      },
    });

    const orgA = await prisma.organisation.create({
      data: { name: `OrgA ${suffix}`, slug: `orga-${suffix}` },
    });
    const orgB = await prisma.organisation.create({
      data: { name: `OrgB ${suffix}`, slug: `orgb-${suffix}` },
    });

    const storeA = await prisma.store.create({
      data: { organisationId: orgA.id, name: "A", slug: `store-a-${suffix}` },
    });
    const storeB = await prisma.store.create({
      data: { organisationId: orgB.id, name: "B", slug: `store-b-${suffix}` },
    });

    await prisma.storeMember.create({
      data: { storeId: storeA.id, userId: userA.id, role: Role.ORG_OWNER },
    });
    await prisma.storeMember.create({
      data: { storeId: storeB.id, userId: userB.id, role: Role.ORG_OWNER },
    });

    const sareeA = await prisma.sareeProduct.create({
      data: { storeId: storeA.id, name: "Secret Saree A" },
    });

    const leaked = await prisma.sareeProduct.findFirst({
      where: { id: sareeA.id, storeId: storeB.id },
    });
    expect(leaked).toBeNull();

    const owned = await prisma.sareeProduct.findFirst({
      where: { id: sareeA.id, storeId: storeA.id },
    });
    expect(owned?.name).toBe("Secret Saree A");
  });
});
