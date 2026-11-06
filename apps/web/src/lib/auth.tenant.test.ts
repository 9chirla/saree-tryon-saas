import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { AuthError, assertStoreAccess, type SessionUser } from "./auth";

function user(partial: Partial<SessionUser> & Pick<SessionUser, "memberships">): SessionUser {
  return {
    id: "u1",
    email: "a@b.c",
    name: "A",
    isSuperAdmin: false,
    ...partial,
  };
}

describe("assertStoreAccess multi-store", () => {
  const memberships = [
    {
      storeId: "store-a",
      organisationId: "org-a",
      role: Role.ORG_OWNER,
      storeSlug: "a",
      storeName: "A",
    },
    {
      storeId: "store-b",
      organisationId: "org-a",
      role: Role.STORE_MANAGER,
      storeSlug: "b",
      storeName: "B",
    },
  ];

  it("allows access to owned stores only", () => {
    const u = user({ memberships });
    expect(assertStoreAccess(u, "store-a").storeId).toBe("store-a");
    expect(assertStoreAccess(u, "store-b").role).toBe(Role.STORE_MANAGER);
  });

  it("denies cross-store access", () => {
    const u = user({ memberships });
    expect(() => assertStoreAccess(u, "store-c")).toThrow(AuthError);
  });

  it("enforces role restrictions", () => {
    const u = user({ memberships });
    expect(() => assertStoreAccess(u, "store-b", [Role.ORG_OWNER])).toThrow(AuthError);
    expect(assertStoreAccess(u, "store-a", [Role.ORG_OWNER]).storeId).toBe("store-a");
  });

  it("allows super admin bypass", () => {
    const u = user({ isSuperAdmin: true, memberships: [] });
    expect(assertStoreAccess(u, "any-store").role).toBe(Role.SUPER_ADMIN);
  });
});
