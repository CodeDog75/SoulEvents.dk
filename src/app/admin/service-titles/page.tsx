import { BriefcaseBusiness, Save } from "lucide-react";
import Link from "next/link";
import { deactivateServiceTitleAction, upsertServiceTitleAction } from "@/app/admin/service-titles/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ message?: string }>;
};

type ServiceTitle = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

function ServiceTitleForm({ item }: { item?: ServiceTitle }) {
  return (
    <form action={upsertServiceTitleAction} className="grid gap-4 rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <input name="id" type="hidden" value={item?.id ?? ""} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">{item ? "Rediger titel" : "Ny titel"}</p>
          <h2 className="mt-1 text-xl font-semibold text-midnight">{item?.name ?? "Opret ny behandlertitel"}</h2>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink/70">
          <input defaultChecked={item?.is_active ?? true} name="is_active" type="checkbox" />
          Aktiv
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Navn
          <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-[#7A4EAB]" defaultValue={item?.name ?? ""} name="name" required maxLength={80} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Webadresse
          <input className="h-11 rounded-md border border-midnight/15 bg-sage-50 px-3 text-base text-ink/60 outline-none" defaultValue={item?.slug ?? ""} name="slug" placeholder="Genereres automatisk ved tomt felt" maxLength={100} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Sortering
          <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-[#7A4EAB]" defaultValue={item?.sort_order ?? 0} name="sort_order" type="number" />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-ink/72">
        Kort intern beskrivelse
        <textarea className="min-h-24 rounded-md border border-midnight/15 px-3 py-2 text-base outline-none transition focus:border-[#7A4EAB]" defaultValue={item?.description ?? ""} name="description" maxLength={300} />
      </label>

      <div className="flex flex-wrap gap-2">
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-olive px-4 text-sm font-semibold text-white shadow-soft" type="submit">
          <Save className="size-4" aria-hidden="true" />
          Gem titel
        </button>
        {item?.is_active && (
          <button className="inline-flex h-10 items-center rounded-md border border-terracotta/30 px-4 text-sm font-semibold text-terracotta" formAction={deactivateServiceTitleAction}>
            Deaktiver
          </button>
        )}
      </div>
    </form>
  );
}

export default async function AdminServiceTitlesPage({ searchParams }: PageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const { data: titles } = await createAdminClient()
    .from("service_titles")
    .select("id, name, slug, description, is_active, sort_order")
    .order("sort_order")
    .order("name");

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[#EDE4F7] text-[#7A4EAB]">
              <BriefcaseBusiness className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Behandlertitler og ydelsestyper</h1>
            </div>
          </div>
          <Link className="rounded-md border border-midnight/15 bg-white px-4 py-2 text-sm font-semibold text-midnight" href="/admin">
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />
        <section className="rounded-md border border-[#E5D4F7] bg-[#FAF6EF] p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Guide</p>
          <h2 className="mt-1 text-2xl font-semibold text-midnight">Listen bruges på arrangørprofiler</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/68">
            Opret brede og genkendelige titler som healer, coach, massør eller yogalærer. Deaktiver titler i stedet for at slette dem, så historiske profiler bevarer deres valg.
          </p>
        </section>

        <ServiceTitleForm />

        <div className="grid gap-4">
          {(titles ?? []).map((title) => (
            <ServiceTitleForm item={title as ServiceTitle} key={title.id} />
          ))}
        </div>
      </section>
    </main>
  );
}
