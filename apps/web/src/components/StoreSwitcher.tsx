"use client";

import { useEffect, useState } from "react";

type StoreOpt = { id: string; name: string; slug: string; role: string };

export function StoreSwitcher({ onChanged }: { onChanged?: () => void }) {
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    fetch("/api/retailer/active-store")
      .then((r) => r.json())
      .then((j) => {
        setStores(j.stores ?? []);
        if (j.activeStoreId) setActive(j.activeStoreId);
        else if (j.stores?.length) setActive(j.stores[0].id);
      })
      .catch(() => undefined);
  }, []);

  if (stores.length <= 1) return null;

  return (
    <label className="text-sm text-[var(--muted)]">
      Active store
      <select
        className="ml-2 rounded-lg border border-[rgba(107,30,46,0.2)] bg-white/80 px-2 py-1"
        value={active}
        onChange={async (e) => {
          const storeId = e.target.value;
          setActive(storeId);
          await fetch("/api/retailer/active-store", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ storeId }),
          });
          onChanged?.();
          window.location.reload();
        }}
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
