import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
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

const documentOrder = ["terms", "privacy", "guidelines"];

export default async function AdminLegalPage({ searchParams }: AdminLegalPageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = await createClient();
  const { data: documents } = await supabase.from("legal_documents").select("*");
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
          Her kan du indsætte og opdatere handelsbetingelser, privatlivspolitik og SoulEvents retningslinjer.
          Dokumenterne vises via links på oprettelsessiden.
        </section>

        <div className="grid gap-6">
          {sortedDocuments.map((document) => (
            <form
              action={updateLegalDocumentAction}
              className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft"
              key={document.type}
            >
              <input name="type" type="hidden" value={document.type} />
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
                    defaultChecked={document.is_published}
                    name="is_published"
                    type="checkbox"
                  />
                  Vis dokument offentligt
                </label>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex h-10 items-center rounded-button border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                    href={`/legal/${document.slug}`}
                    target="_blank"
                  >
                    Se dokument
                  </Link>
                  <button
                    className="inline-flex h-10 items-center rounded-button bg-olive px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
                    type="submit"
                  >
                    Gem dokument
                  </button>
                </div>
              </div>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
