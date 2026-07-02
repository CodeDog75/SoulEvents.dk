import { ShieldCheck, UserRound } from "lucide-react";
import { updateUserRoleAction } from "@/app/admin/users/actions";
import type { AppRole } from "@/types/database";

type UserRow = {
  id: string;
  role: AppRole;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
};

type UserRoleTableProps = {
  currentProfileId: string;
  users: UserRow[];
};

const roleLabels: Record<AppRole, string> = {
  admin: "Administrator",
  facilitator: "Arrangør",
};

function RoleButton({ profileId, role, label }: { profileId: string; role: AppRole; label: string }) {
  return (
    <form action={updateUserRoleAction}>
      <input name="profile_id" type="hidden" value={profileId} />
      <input name="role" type="hidden" value={role} />
      <button
        className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
        type="submit"
      >
        {role === "admin" ? (
          <ShieldCheck className="size-4" aria-hidden="true" />
        ) : (
          <UserRound className="size-4" aria-hidden="true" />
        )}
        {label}
      </button>
    </form>
  );
}

export function UserRoleTable({ currentProfileId, users }: UserRoleTableProps) {
  return (
    <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-midnight">Arrangører og admin</h2>
        <p className="mt-1 text-sm text-ink/64">Styr hvem der har adgang til adminpanelet, og hvem der er arrangør.</p>
      </div>

      <div className="divide-y divide-midnight/10">
        {users.map((user) => (
          <article className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]" key={user.id}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    user.role === "admin" ? "bg-sage-50 text-sage-700" : "bg-midnight/10 text-midnight"
                  }`}
                >
                  {roleLabels[user.role]}
                </span>
                {user.id === currentProfileId && (
                  <span className="rounded-md bg-terracotta/10 px-2.5 py-1 text-xs font-semibold text-terracotta">
                    Dig
                  </span>
                )}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-midnight">{user.full_name || "Uden navn"}</h3>
              <p className="mt-1 text-sm text-ink/64">
                {user.email}
                {user.phone ? ` · ${user.phone}` : ""}
              </p>
              <p className="mt-2 text-xs text-ink/52">
                Oprettet {new Intl.DateTimeFormat("da-DK").format(new Date(user.created_at))}
              </p>
            </div>

            <div className="flex flex-wrap content-start gap-2 lg:justify-end">
              {user.role !== "admin" && <RoleButton label="Gør til admin" profileId={user.id} role="admin" />}
              {user.role !== "facilitator" && (
                <RoleButton label="Gør til arrangør" profileId={user.id} role="facilitator" />
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
