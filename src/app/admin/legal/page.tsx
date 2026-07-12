import Link from "next/link";
import { ArrowLeft, Eye, FileText, Send } from "lucide-react";
import { updateLegalDocumentAction } from "@/app/admin/legal/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminLegalPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

const documentOrder = ["terms", "organizer_terms", "privacy", "cookies", "guidelines"];
const documentLabels: Record<string, string> = {
  cookies: "Cookiepolitik",
  guidelines: "Retningslinjer for events og indhold",
  organizer_terms: "Arrangørvilkår",
  privacy: "Privatlivspolitik",
  terms: "Brugervilkår",
};

function formatDanishDateInput(value?: string | null) {
  if (!value) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Copenhagen",
    year: "numeric",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default async function AdminLegalPage({ searchParams }: AdminLegalPageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = await createClient();
  const [{ data: documents }, { data: versions }] = await Promise.all([
    supabase.from("legal_documents").select("*"),
    supabase
      .from("legal_document_versions")
      .select("document_id, document_type, title, slug, version, published_at, effective_at, requires_acceptance")
      .order("published_at", { ascending: false }),
  ]);
  const sortedDocuments = [...(documents ?? [])].sort(
    (a: { type: string }, b: { type: string }) => documentOrder.indexOf(a.type) - documentOrder.indexOf(b.type),
  );

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <FileText className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Juridiske dokumenter</h1>
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

        <section className="rounded-card border border-sage-700/15 bg-sage-50 p-5 text-sm leading-6 text-ink/70">
          Her kan du gemme kladder og udgive nye juridiske versioner. Tidligere udgivne versioner bevares som historik
          og bruges til at dokumentere brugerens eller arrangørens accept.
        </section>

        <div className="grid gap-6">
          {sortedDocuments.map((document) => (
            <form
              action={updateLegalDocumentAction}
              className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft"
              key={document.type}
            >
              <input name="type" type="hidden" value={document.type} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sage-700">
                    {documentLabels[document.type] ?? document.type}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-midnight">{document.title}</h2>
                </div>
                <span className="rounded-full bg-[#F6F1E7] px-3 py-1 text-xs font-semibold text-ink/60">
                  Gældende version: {document.version}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-ink/72">
                  Titel
                  <input
                    className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                    defaultValue={document.title}
                    name="title"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-ink/72">
                  Link
                  <input
                    className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                    defaultValue={document.slug}
                    name="slug"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-ink/72">
                  Versionsnummer
                  <input
                    className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                    defaultValue={document.version ?? "1.0"}
                    name="version"
                    placeholder="1.1"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-ink/72">
                  Gældende fra
                  <input
                    className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                    defaultValue={formatDanishDateInput(document.effective_at)}
                    name="effective_at"
                    type="date"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Indhold
                <textarea
                  className="min-h-64 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700"
                  defaultValue={document.body}
                  name="body"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-3 text-sm font-medium text-ink/72">
                  <input
                    className="size-4 accent-sage-700"
                    defaultChecked={document.requires_acceptance}
                    name="requires_acceptance"
                    type="checkbox"
                  />
                  Kræver fornyet accept ved udgivelse
                </label>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex h-10 items-center rounded-button border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                    href={`/legal/${document.slug}`}
                    target="_blank"
                  >
                    <Eye className="mr-2 size-4" aria-hidden="true" />
                    Forhåndsvisning
                  </Link>
                  <button
                    className="inline-flex h-10 items-center rounded-button border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                    name="intent"
                    type="submit"
                    value="save_draft"
                  >
                    Gem kladde
                  </button>
                  <button
                    className="inline-flex h-10 items-center rounded-button bg-olive px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                    name="intent"
                    type="submit"
                    value="publish"
                  >
                    <Send className="mr-2 size-4" aria-hidden="true" />
                    Udgiv ny version
                  </button>
                </div>
              </div>
              <div className="rounded-md border border-midnight/10 bg-[#FBFAF7] p-4 text-sm text-ink/68">
                <h3 className="font-semibold text-midnight">Historik</h3>
                <div className="mt-3 grid gap-2">
                  {(versions ?? [])
                    .filter((version) => version.document_id === document.id)
                    .slice(0, 5)
                    .map((version) => (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2" key={version.version}>
                        <span className="font-semibold">Version {version.version}</span>
                        <span>
                          Udgivet{" "}
                          {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(new Date(version.published_at))}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
