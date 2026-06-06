import { Save } from "lucide-react";
import { upsertCategoryAction } from "@/app/admin/taxonomy/actions";

type Category = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  color_hex?: string;
  icon_name?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

type CategoryFormProps = {
  category?: Category;
  title: string;
};

export function CategoryForm({ category, title }: CategoryFormProps) {
  return (
    <form action={upsertCategoryAction} className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <input name="id" type="hidden" value={category?.id ?? ""} />
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-midnight">{title}</h2>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink/72">
          <input
            className="size-4 accent-sage-700"
            defaultChecked={category?.is_active ?? true}
            name="is_active"
            type="checkbox"
          />
          Aktiv
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Navn
          <input
            className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={category?.name ?? ""}
            name="name"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Slug
          <input
            className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={category?.slug ?? ""}
            name="slug"
            placeholder="dannes automatisk"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Farve
          <input
            className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={category?.color_hex ?? "#87A878"}
            name="color_hex"
            pattern="^#[0-9A-Fa-f]{6}$"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Ikonnavn
          <input
            className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={category?.icon_name ?? ""}
            name="icon_name"
            placeholder="leaf, sparkles, flame..."
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Sortering
          <input
            className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={category?.sort_order ?? 0}
            name="sort_order"
            type="number"
          />
        </label>
      </div>

      <label className="mt-4 grid gap-2 text-sm font-medium text-ink/72">
        Beskrivelse
        <textarea
          className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700"
          defaultValue={category?.description ?? ""}
          name="description"
        />
      </label>

      <button
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700"
        type="submit"
      >
        <Save className="size-4" aria-hidden="true" />
        Gem kategori
      </button>
    </form>
  );
}
