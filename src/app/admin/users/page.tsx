import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { transferAdminByEmailAction } from "@/app/admin/users/actions";
import { UserRoleTable } from "@/components/admin/users/user-role-table";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const [{ message }, profile] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, phone, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
            <h1 className="text-xl font-semibold text-midnight">Brugere og roller</h1>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href="/admin"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Admin
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />

        <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 size-5 text-sage-700" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-midnight">Flyt adminadgang</h2>
              <p className="mt-1 text-sm leading-6 text-ink/65">
                Brugeren skal først være oprettet i systemet. Skriv den nye admin-mail og vælg om din nuværende
                adminrolle skal fjernes samtidig.
              </p>
            </div>
          </div>

          <form action={transferAdminByEmailAction} className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Ny administrator
              <input
                className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                name="email"
                placeholder="munch4300@gmail.com"
                required
                type="email"
              />
            </label>

            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-midnight px-5 text-sm font-semibold text-white transition hover:bg-sage-700"
              type="submit"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              Opdater admin
            </button>

            <label className="flex items-start gap-2 text-sm leading-6 text-ink/72 md:col-span-2">
              <input className="mt-1 size-4 accent-sage-700" defaultChecked name="make_current_facilitator" type="checkbox" />
              Fjern adminadgang fra min nuværende bruger efter den nye admin er aktiveret.
            </label>
          </form>
        </section>

        <UserRoleTable currentProfileId={profile.id} users={(users ?? []) as never} />
      </section>
    </main>
  );
}
