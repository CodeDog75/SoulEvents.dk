import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LegalDocumentPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function LegalDocumentPage({ params }: LegalDocumentPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("legal_documents")
    .select("title, body, updated_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!document) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-3" href="/">
            <BrandLogo className="h-16 w-16" priority />
            <span className="text-sm font-semibold text-olive">SoulEvents.dk</span>
          </Link>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href="/auth/signup"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <article className="rounded-card bg-white p-6 shadow-soft sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Juridisk dokument</p>
          <h1 className="mt-2 text-4xl font-medium text-olive">{document.title}</h1>
          <p className="mt-3 text-sm text-ink/55">
            Senest opdateret:{" "}
            {new Intl.DateTimeFormat("da-DK", { dateStyle: "long" }).format(new Date(document.updated_at))}
          </p>
          <div className="mt-8 whitespace-pre-line text-sm leading-7 text-ink/72">{document.body}</div>
        </article>
      </section>
    </main>
  );
}
