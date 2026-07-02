import Link from "next/link";
import { ArrowLeft, Search, ShieldCheck } from "lucide-react";
import { transferAdminByEmailAction } from "@/app/admin/users/actions";
import { UserRoleTable } from "@/components/admin/users/user-role-table";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams: Promise<{
    message?: string;
    q?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const [{ message, q }, profile] = await Promise.all([searchParams, requireRole("admin")]);
  const queryText = (q ?? "").trim().toLowerCase();
  const supabase = createAdminClient();
  const [{ data: users }, { data: facilitators }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, full_name, email, phone, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("facilitator_profiles")
      .select("id, profile_id, host_reference_id, status, company_name, short_description, city, postal_code, website_url, facilitator_categories(categories(name))"),
  ]);

  const facilitatorByProfileId = new Map((facilitators ?? []).map((facilitator) => [facilitator.profile_id, facilitator]));
  const enrichedUsers = (users ?? []).map((user) => {
    const facilitator = facilitatorByProfileId.get(user.id);
    const categories =
      facilitator?.facilitator_categories
        ?.map((row) => (Array.isArray(row.categories) ? row.categories[0] : row.categories)?.name)
        .filter(Boolean) ?? [];

    return {
      ...user,
      facilitator_categories: categories,
      facilitator_city: facilitator?.city ?? null,
      facilitator_company_name: facilitator?.company_name ?? null,
      facilitator_host_reference_id: facilitator?.host_reference_id ?? null,
      facilitator_postal_code: facilitator?.postal_code ?? null,
      facilitator_short_description: facilitator?.short_description ?? null,
      facilitator_status: facilitator?.status ?? null,
      facilitator_website_url: facilitator?.website_url ?? null,
    };
  });

  const visibleUsers = enrichedUsers.filter((user) => {
    if (!queryText) return true;
    return [
      user.full_name,
      user.email,
      user.phone,
      user.role,
      user.facilitator_company_name,
      user.facilitator_host_reference_id,
      user.facilitator_status,
      user.facilitator_city,
      user.facilitator_postal_code,
      user.facilitator_short_description,
      user.facilitator_website_url,
      user.facilitator_categories.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(queryText);
  });

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
            <h1 className="text-xl font-semibold text-midnight">Arrangører og admin</h1>
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
          <form action="/admin/users" className="grid gap-2">
            <label className="text-sm font-semibold text-midnight" htmlFor="admin-user-search">
              Søg arrangør eller admin
            </label>
            <div className="flex min-w-0 gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/45" aria-hidden="true" />
                <input
                  className="h-11 w-full rounded-md border border-midnight/15 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sage-700"
                  defaultValue={q ?? ""}
                  id="admin-user-search"
                  name="q"
                  placeholder="Søg navn, kaldenavn, e-mail, telefon, by eller medlemsnummer"
                />
              </div>
              <button className="h-11 rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
                Søg
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 size-5 text-sage-700" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-midnight">Tilføj administrator</h2>
              <p className="mt-1 text-sm leading-6 text-ink/65">
                Brugeren skal først være oprettet i systemet. Skriv e-mailen på den bruger, der også skal have adminadgang. Din nuværende adminadgang bevares som standard.
              </p>
            </div>
          </div>

          <form action={transferAdminByEmailAction} className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              E-mail på ny administrator
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
              Tilføj admin
            </button>

            <label className="flex items-start gap-2 text-sm leading-6 text-ink/72 md:col-span-2">
              <input className="mt-1 size-4 accent-sage-700" name="make_current_facilitator" type="checkbox" />
              Fjern adminadgang fra min nuværende bruger efter den nye admin er aktiveret. Brug kun dette, hvis adminrollen skal flyttes i stedet for deles.
            </label>
          </form>
        </section>

        <UserRoleTable currentProfileId={profile.id} users={visibleUsers as never} />
      </section>
    </main>
  );
}
