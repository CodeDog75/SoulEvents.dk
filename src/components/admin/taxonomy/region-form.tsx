import { Save } from "lucide-react";
import { upsertRegionAction } from "@/app/admin/taxonomy/actions";

type Region = {
  id?: string;
  name?: string;
  slug?: string;
  sort_order?: number;
};

type RegionFormProps = {
  region?: Region;
  title: string;
};

export function RegionForm({ region, title }: RegionFormProps) {
  return (
    <form action={upsertRegionAction} className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <input name="id" type="hidden" value={region?.id ?? ""} />
      <h2 className="text-lg font-semibold text-midnight">{title}</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Navn
          <input
            className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={region?.name ?? ""}
            name="name"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Slug
          <input
            className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={region?.slug ?? ""}
            name="slug"
            placeholder="dannes automatisk"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Sortering
          <input
            className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={region?.sort_order ?? 0}
            name="sort_order"
            type="number"
          />
        </label>
      </div>

      <button
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700"
        type="submit"
      >
        <Save className="size-4" aria-hidden="true" />
        Gem region
      </button>
    </form>
  );
}
