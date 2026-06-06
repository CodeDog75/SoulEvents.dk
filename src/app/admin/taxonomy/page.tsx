import Link from "next/link";
import { ArrowLeft, Shapes } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { CategoryForm } from "@/components/admin/taxonomy/category-form";
import { RegionForm } from "@/components/admin/taxonomy/region-form";
import { TaxonomyLists } from "@/components/admin/taxonomy/taxonomy-lists";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TaxonomyPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function TaxonomyPage({ searchParams }: TaxonomyPageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = await createClient();

  const [{ data: categories }, { data: regions }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("regions").select("*").order("sort_order"),
  ]);

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <Shapes className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Kategorier og regioner</h1>
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

        <div className="grid gap-6 xl:grid-cols-2">
          <CategoryForm title="Opret kategori" />
          <RegionForm title="Opret region" />
        </div>

        <TaxonomyLists categories={(categories ?? []) as never} regions={(regions ?? []) as never} />
      </section>
    </main>
  );
}
