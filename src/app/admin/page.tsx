import Link from "next/link";
import { Banknote, CalendarDays, FileText, ReceiptText, Scale, Shapes, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { FacilitatorApprovalTable } from "@/components/admin/facilitator-approval-table";
import { AuthMessage } from "@/components/auth/auth-message";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { FacilitatorStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    status?: string;
    message?: string;
  }>;
};

const statuses: Array<{ label: string; value: "all" | FacilitatorStatus }> = [
  { label: "Alle", value: "all" },
  { label: "Afventer", value: "pending" },
  { label: "Godkendt", value: "approved" },
  { label: "Deaktiveret", value: "disabled" },
];

function normalizeStatus(status?: string) {
  return statuses.some((item) => item.value === status) ? (status as "all" | FacilitatorStatus) : "pending";
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const [{ status, message }, profile] = await Promise.all([searchParams, requireRole("admin")]);
  const selectedStatus = normalizeStatus(status);
  const supabase = await createClient();

  let query = supabase
    .from("facilitator_profiles")
    .select(
      `
      id,
      status,
      company_name,
      short_description,
      city,
      postal_code,
      website_url,
      created_at,
      profiles(full_name, email, phone),
      regions(name),
      facilitator_categories(categories(name))
    `,
    )
    .order("created_at", { ascending: false });

  if (selectedStatus !== "all") {
    query = query.eq("status", selectedStatus);
  }

  const [
    { data: facilitators },
    { count: pendingCount },
    { count: approvedCount },
    { count: activeEventCount },
    { data: bookingStats },
  ] = await Promise.all([
      query,
      supabase.from("facilitator_profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("facilitator_profiles").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("bookings").select("booking_value_cents, commission_cents, seats"),
    ]);

  const totalBookingValue =
    bookingStats?.reduce((sum: number, booking: { booking_value_cents: number }) => sum + booking.booking_value_cents, 0) ??
    0;
  const totalCommission =
    bookingStats?.reduce((sum: number, booking: { commission_cents: number }) => sum + booking.commission_cents, 0) ?? 0;

  const stats = [
    { label: "Facilitatorer til godkendelse", value: pendingCount ?? 0, icon: UsersRound },
    { label: "Godkendte facilitatorer", value: approvedCount ?? 0, icon: ShieldCheck },
    { label: "Aktive begivenheder", value: activeEventCount ?? 0, icon: CalendarDays },
    {
      label: "Samlet kommission",
      value: `${new Intl.NumberFormat("da-DK").format(totalCommission / 100)} kr.`,
      icon: ReceiptText,
    },
  ];

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
            <h1 className="text-xl font-semibold text-midnight">Velkommen, {profile.full_name}</h1>
          </div>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5">
          <AuthMessage message={message} />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <article className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft" key={stat.label}>
              <stat.icon className="size-5 text-terracotta" aria-hidden="true" />
              <p className="mt-4 text-3xl font-semibold text-midnight">{stat.value}</p>
              <p className="mt-1 text-sm text-ink/64">{stat.label}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <Link
            className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft transition hover:border-terracotta"
            href="/admin/bookings"
          >
            <Banknote className="size-5 text-terracotta" aria-hidden="true" />
            <h2 className="mt-4 font-semibold text-midnight">Tilmeldinger og statistik</h2>
            <p className="mt-2 text-sm leading-6 text-ink/64">
              Se bookingværdi, kommission, pladser og filtrer på facilitator, status og dato.
            </p>
            <p className="mt-3 text-sm font-semibold text-midnight">
              Bookingværdi: {new Intl.NumberFormat("da-DK").format(totalBookingValue / 100)} kr.
            </p>
          </Link>
          <Link
            className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft transition hover:border-midnight"
            href="/admin/reports"
          >
            <FileText className="size-5 text-midnight" aria-hidden="true" />
            <h2 className="mt-4 font-semibold text-midnight">Månedsrapport og faktura</h2>
            <p className="mt-2 text-sm leading-6 text-ink/64">
              Generér rapporter pr. facilitator og opret fakturakladder baseret på kommission.
            </p>
          </Link>
          <Link
            className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft transition hover:border-sage-700"
            href="/admin/taxonomy"
          >
            <Shapes className="size-5 text-sage-700" aria-hidden="true" />
            <h2 className="mt-4 font-semibold text-midnight">Kategorier og regioner</h2>
            <p className="mt-2 text-sm leading-6 text-ink/64">
              Opret og vedligehold de filtre, som facilitatorer, events og nyhedsbreve bruger.
            </p>
          </Link>
          <Link
            className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft transition hover:border-sage-700"
            href="/admin/users"
          >
            <UserCog className="size-5 text-sage-700" aria-hidden="true" />
            <h2 className="mt-4 font-semibold text-midnight">Brugere og roller</h2>
            <p className="mt-2 text-sm leading-6 text-ink/64">
              Skift administrator og styr adgang til adminpanelet.
            </p>
          </Link>
          <Link
            className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft transition hover:border-sage-700"
            href="/admin/legal"
          >
            <Scale className="size-5 text-sage-700" aria-hidden="true" />
            <h2 className="mt-4 font-semibold text-midnight">Juridiske dokumenter</h2>
            <p className="mt-2 text-sm leading-6 text-ink/64">
              Opdater handelsbetingelser, privatlivspolitik og SoulEvents retningslinjer.
            </p>
          </Link>
        </div>

        <div className="my-6 flex flex-wrap gap-2">
          {statuses.map((item) => {
            const active = item.value === selectedStatus;

            return (
              <Link
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-midnight text-white"
                    : "border border-midnight/10 bg-white text-midnight hover:border-terracotta hover:text-terracotta"
                }`}
                href={item.value === "pending" ? "/admin" : `/admin?status=${item.value}`}
                key={item.value}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <FacilitatorApprovalTable facilitators={(facilitators ?? []) as never} />
      </section>
    </main>
  );
}
