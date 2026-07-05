import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

type AdminReportsPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-midnight text-white">
              <FileText className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Rapporter og eksport</h1>
            </div>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href="/admin"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />

        <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Statistikeksport</p>
              <h2 className="mt-1 text-xl font-semibold text-midnight">Eksportér data til Excel</h2>
              <p className="mt-2 text-sm leading-6 text-ink/64">
                Hent arrangørdata, kontaktoplysninger, events, tilmeldinger, kategorier, priser og profilvisninger til nyhedsbreve, status og dokumentation af SoulEvents&apos; værdi.
              </p>
            </div>
            <form action="/admin/reports/export" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="grid gap-1 text-sm font-semibold text-midnight">
                Fra dato
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-sm outline-none focus:border-[#7A5D91]" name="from" type="date" />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-midnight">
                Til dato
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-sm outline-none focus:border-[#7A5D91]" name="to" type="date" />
              </label>
              <button className="h-11 rounded-md bg-[#7A5D91] px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-[#6E5285]" type="submit">
                Eksportér statistik
              </button>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
