import { Power, PowerOff } from "lucide-react";
import { toggleCategoryStatusAction } from "@/app/admin/taxonomy/actions";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color_hex: string;
  icon_name: string | null;
  is_active: boolean;
  sort_order: number;
};

type Region = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

type TaxonomyListsProps = {
  categories: Category[];
  regions: Region[];
};

export function TaxonomyLists({ categories, regions }: TaxonomyListsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
        <div className="border-b border-midnight/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-midnight">Kategorier</h2>
          <p className="mt-1 text-sm text-ink/64">Bruges til facilitatorprofiler, events, kategori-tags og kortmarkører.</p>
        </div>

        <div className="divide-y divide-midnight/10">
          {categories.map((category) => (
            <article className="grid gap-4 p-5 md:grid-cols-[1fr_auto]" key={category.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: category.color_hex }}
                  >
                    {category.name}
                  </span>
                  <span className="rounded-md bg-sage-50 px-2 py-1 text-xs font-semibold text-sage-700">
                    {category.slug}
                  </span>
                  <span className="rounded-md bg-midnight/5 px-2 py-1 text-xs font-semibold text-midnight">
                    {category.color_hex}
                  </span>
                  {!category.is_active && (
                    <span className="rounded-md bg-midnight/10 px-2 py-1 text-xs font-semibold text-midnight">
                      Inaktiv
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-ink/64">
                  {category.description || "Ingen beskrivelse endnu."}
                </p>
                <p className="mt-2 text-xs text-ink/50">
                  Ikon: {category.icon_name || "ikke valgt"} · Sortering: {category.sort_order}
                </p>
              </div>

              <form action={toggleCategoryStatusAction}>
                <input name="id" type="hidden" value={category.id} />
                <input name="is_active" type="hidden" value={category.is_active ? "false" : "true"} />
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
                  type="submit"
                >
                  {category.is_active ? (
                    <>
                      <PowerOff className="size-4" aria-hidden="true" />
                      Deaktiver
                    </>
                  ) : (
                    <>
                      <Power className="size-4" aria-hidden="true" />
                      Aktiver
                    </>
                  )}
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
        <div className="border-b border-midnight/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-midnight">Regioner</h2>
          <p className="mt-1 text-sm text-ink/64">Bruges til filtrering, nyhedsbrev og lokation.</p>
        </div>

        <div className="divide-y divide-midnight/10">
          {regions.map((region) => (
            <article className="p-5" key={region.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-midnight">{region.name}</h3>
                  <p className="mt-1 text-sm text-ink/60">{region.slug}</p>
                </div>
                <span className="rounded-md bg-sand px-2.5 py-1 text-xs font-semibold text-midnight">
                  {region.sort_order}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
