import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";

function canAccess(
  user: { isSuperAdmin: boolean; memberships: { storeId: string; role: Role }[] },
  storeId: string,
) {
  if (user.isSuperAdmin) return true;
  return user.memberships.some((m) => m.storeId === storeId);
}

describe("tenant isolation helpers", () => {
  it("denies cross-store access for retailers", () => {
    const user = {
      isSuperAdmin: false,
      memberships: [{ storeId: "store-a", role: Role.ORG_OWNER }],
    };
    expect(canAccess(user, "store-a")).toBe(true);
    expect(canAccess(user, "store-b")).toBe(false);
  });

  it("allows super admin", () => {
    const user = { isSuperAdmin: true, memberships: [] as { storeId: string; role: Role }[] };
    expect(canAccess(user, "any")).toBe(true);
  });
});
