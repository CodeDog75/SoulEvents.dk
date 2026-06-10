import Link from "next/link";
import { ArrowLeft, Save, Tags, Trash2 } from "lucide-react";
import {
  deleteTaxonomyItemAction,
  upsertMainCategoryAction,
  upsertSubcategoryAction,
  upsertTagAction,
} from "@/app/admin/category-architecture/actions";
import { CategoryForm } from "@/components/admin/taxonomy/category-form";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ message?: string }>;
};

type BasicItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_path?: string | null;
  color_hex?: string;
  is_active: boolean;
  sort_order: number;
};

function BasicForm({
  action,
  item,
  title,
  table,
  showColor,
  showImage,
}: {
  action: (formData: FormData) => Promise<void>;
  item?: BasicItem;
  title: string;
  table: string;
  showColor?: boolean;
  showImage?: boolean;
}) {
  return (
    <form action={action} className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <input name="id" type="hidden" value={item?.id ?? ""} />
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-midnight">{title}</h3>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink/72">
          <input className="size-4 accent-sage-700" defaultChecked={item?.is_active ?? true} name="is_active" type="checkbox" />
          Aktiv
        </label>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.name ?? ""} name="name" placeholder="Navn" required />
        <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.slug ?? ""} name="slug" placeholder="slug dannes automatisk" />
        {showColor && (
          <div className="grid grid-cols-[52px_1fr] gap-2">
            <input className="h-10 w-12 rounded-md border border-midnight/15 bg-white p-1" defaultValue={item?.color_hex ?? "#87A878"} name="color_hex" type="color" />
            <span className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-white" style={{ backgroundColor: item?.color_hex ?? "#87A878" }}>
              {item?.name || "Preview"}
            </span>
          </div>
        )}
        {showImage && <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.image_path ?? ""} name="image_path" placeholder="Billede-sti" />}
        <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.sort_order ?? 0} name="sort_order" type="number" />
      </div>
      <textarea className="mt-3 min-h-20 w-full rounded-md border border-midnight/15 p-3" defaultValue={item?.description ?? ""} name="description" placeholder="Beskrivelse" />
      <div className="mt-4 flex gap-2">
        <button className="inline-flex h-9 items-center gap-2 rounded-md bg-midnight px-3 text-sm font-semibold text-white" type="submit">
          <Save className="size-4" aria-hidden="true" />
          Gem
        </button>
        {item?.id && (
          <>
            <input name="delete_id" type="hidden" value={item.id} />
            <input name="delete_table" type="hidden" value={table} />
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-terracotta/30 px-3 text-sm font-semibold text-terracotta"
              formAction={deleteTaxonomyItemAction}
              type="submit"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Slet
            </button>
          </>
        )}
      </div>
    </form>
  );
}

function SubcategoryForm({ item, mainCategories }: { item?: BasicItem; mainCategories: BasicItem[] }) {
  return (
    <form action={upsertSubcategoryAction} className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <input name="id" type="hidden" value={item?.id ?? ""} />
      <h3 className="font-semibold text-midnight">{item ? "Rediger underkategori" : "Opret underkategori"}</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.name ?? ""} name="name" placeholder="Navn" required />
        <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.slug ?? ""} name="slug" placeholder="slug dannes automatisk" />
        <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.image_path ?? ""} name="image_path" placeholder="Billede-sti" />
        <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.sort_order ?? 0} name="sort_order" type="number" />
      </div>
      <textarea className="mt-3 min-h-20 w-full rounded-md border border-midnight/15 p-3" defaultValue={item?.description ?? ""} name="description" placeholder="Beskrivelse" />
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink/72">
        <input className="size-4 accent-sage-700" defaultChecked={item?.is_active ?? true} name="is_active" type="checkbox" />
        Aktiv
      </label>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {mainCategories.map((mainCategory) => (
          <label className="flex items-center gap-2 rounded-md border border-midnight/10 p-2 text-sm" key={mainCategory.id}>
            <input className="size-4 accent-sage-700" name="main_category_ids" type="checkbox" value={mainCategory.id} />
            {mainCategory.name}
          </label>
        ))}
      </div>
      <button className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-midnight px-3 text-sm font-semibold text-white" type="submit">
        <Save className="size-4" aria-hidden="true" />
        Gem
      </button>
    </form>
  );
}

export default async function CategoryArchitecturePage({ searchParams }: PageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = await createClient();
  const [{ data: mainCategories }, { data: subcategories }, { data: tags }, { data: eventCategories }] = await Promise.all([
    supabase.from("main_categories").select("*").order("sort_order"),
    supabase.from("subcategories").select("*").order("sort_order"),
    supabase.from("tags").select("*").order("sort_order"),
    supabase.from("categories").select("*").order("sort_order"),
  ]);

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <Tags className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Kategoriarkitektur</h1>
            </div>
          </div>
          <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight" href="/admin">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />
        <div className="rounded-md border border-sage-700/20 bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-midnight">Eventformat</h2>
          <p className="mt-2 text-sm leading-6 text-ink/64">
            Eventformat er et separat felt på events: Fysisk event, Online event eller Hybrid event.
          </p>
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="grid content-start gap-4">
            <BasicForm action={upsertMainCategoryAction} table="main_categories" title="Opret hovedkategori" showColor showImage />
            {(mainCategories ?? []).map((item) => (
              <BasicForm action={upsertMainCategoryAction} item={item as BasicItem} key={item.id} table="main_categories" title="Rediger hovedkategori" showColor showImage />
            ))}
          </div>
          <div className="grid content-start gap-4">
            <SubcategoryForm mainCategories={(mainCategories ?? []) as BasicItem[]} />
            {(subcategories ?? []).map((item) => (
              <SubcategoryForm item={item as BasicItem} key={item.id} mainCategories={(mainCategories ?? []) as BasicItem[]} />
            ))}
          </div>
          <div className="grid content-start gap-4">
            <BasicForm action={upsertTagAction} table="tags" title="Opret tag" />
            {(tags ?? []).map((item) => (
              <BasicForm action={upsertTagAction} item={item as BasicItem} key={item.id} table="tags" title="Rediger tag" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
