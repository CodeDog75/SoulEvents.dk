"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FacilitatorAdminStatus } from "@/components/admin/facilitator-status-badge";

type AdminUserSearchFormProps = {
  activeResultType: "all" | "events" | "facilitators";
  clearHref: string;
  query: string;
  selectedLoginActivity: string;
  selectedSort: string;
  selectedStatus: "all" | FacilitatorAdminStatus;
};

export function AdminUserSearchForm({
  activeResultType,
  clearHref,
  query,
  selectedLoginActivity,
  selectedSort,
  selectedStatus,
}: AdminUserSearchFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const hasValue = value.trim().length > 0;

  function clearSearch() {
    setValue("");
    router.push(clearHref);
  }

  return (
    <form action="/admin/users" className="grid gap-2">
      <label className="text-sm font-semibold text-midnight" htmlFor="admin-user-search">
        Søg efter arrangør eller event
      </label>
      {activeResultType === "facilitators" ? (
        <>
          <input name="status" type="hidden" value={selectedStatus} />
          <input name="sort" type="hidden" value={selectedSort} />
          <input name="login_activity" type="hidden" value={selectedLoginActivity} />
        </>
      ) : (
        <input name="type" type="hidden" value="events" />
      )}
      <div className="flex min-w-0 gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/45" aria-hidden="true" />
          <input
            className="h-11 w-full rounded-md border border-midnight/15 bg-white pl-9 pr-11 text-sm outline-none transition focus:border-sage-700"
            id="admin-user-search"
            name="q"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && hasValue) {
                event.preventDefault();
                clearSearch();
              }
            }}
            placeholder="Søg efter arrangør eller event..."
            value={value}
          />
          {hasValue ? (
            <button
              aria-label="Ryd søgning"
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink/54 transition hover:bg-sage-50 hover:text-midnight"
              onClick={clearSearch}
              type="button"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <button className="h-11 rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
          Søg
        </button>
      </div>
    </form>
  );
}
