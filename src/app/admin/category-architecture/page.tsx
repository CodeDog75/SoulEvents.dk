import Link from "next/link";
import { ArrowLeft, ChevronDown, Layers3, Save, Tags, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
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

type EventCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color_hex: string;
  icon_name: string | null;
  is_active: boolean;
  sort_order: number;
};

function SectionShell({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="scroll-mt-6 rounded-md border border-midnight/10 bg-white shadow-soft" id={id}>
      <div className="border-b border-midnight/10 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sage-700">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold text-midnight">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink/64">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="rounded-full bg-sage-50 px-2.5 py-1 text-xs font-semibold text-sage-700">Aktiv</span>
  ) : (
    <span className="rounded-full bg-midnight/10 px-2.5 py-1 text-xs font-semibold text-midnight">Inaktiv</span>
  );
}

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
  const color = item?.color_hex ?? "#87A878";

  return (
    <form action={action} className="rounded-md border border-midnight/10 bg-white p-4">
      <input name="id" type="hidden" value={item?.id ?? ""} />
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-midnight">{title}</h3>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink/72">
          <input className="size-4 accent-sage-700" defaultChecked={item?.is_active ?? true} name="is_active" type="checkbox" />
          Aktiv
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-ink/72">
          Navn
          <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.name ?? ""} name="name" required />
        </label>
        <label className="grid gap-1 text-sm font-medium text-ink/72">
          Slug
          <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.slug ?? ""} name="slug" placeholder="dannes automatisk" />
        </label>
        {showColor && (
          <label className="grid gap-1 text-sm font-medium text-ink/72">
            Farve
            <div className="grid grid-cols-[52px_1fr] gap-2">
              <input className="h-10 w-12 rounded-md border border-midnight/15 bg-white p-1" defaultValue={color} name="color_hex" type="color" />
              <span className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-white" style={{ backgroundColor: color }}>
                {item?.name || "Preview"}
              </span>
            </div>
          </label>
        )}
        {showImage && (
          <label className="grid gap-1 text-sm font-medium text-ink/72">
            Billede-sti
            <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.image_path ?? ""} name="image_path" placeholder="Billede-sti" />
          </label>
        )}
        <label className="grid gap-1 text-sm font-medium text-ink/72">
          Sortering
          <input className="h-10 rounded-md border border-midnight/15 px-3" defaultValue={item?.sort_order ?? 0} name="sort_order" type="number" />
        </label>
      </div>

      <label className="mt-3 grid gap-1 text-sm font-medium text-ink/72">
        Beskrivelse
        <textarea className="min-h-20 rounded-md border border-midnight/15 p-3" defaultValue={item?.description ?? ""} name="description" />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
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
    <form action={upsertSubcategoryAction} className="rounded-md border border-midnight/10 bg-white p-4">
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

function EditableList({
  items,
  emptyText,
  renderSummary,
  renderForm,
}: {
  items: BasicItem[];
  emptyText: string;
  renderSummary: (item: BasicItem) => ReactNode;
  renderForm: (item: BasicItem) => ReactNode;
}) {
  if (items.length === 0) {
    return <p className="rounded-md bg-sage-50 p-4 text-sm text-ink/64">{emptyText}</p>;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <details className="group rounded-md border border-midnight/10 bg-white" key={item.id}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">{renderSummary(item)}</div>
            <ChevronDown className="size-4 shrink-0 text-ink/45 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-midnight/10 bg-[#fbfaf7] p-4">{renderForm(item)}</div>
        </details>
      ))}
    </div>
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

  const mainItems = (mainCategories ?? []) as BasicItem[];
  const subItems = (subcategories ?? []) as BasicItem[];
  const tagItems = (tags ?? []) as BasicItem[];
  const eventCategoryItems = (eventCategories ?? []) as EventCategory[];

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
              <h1 className="text-xl font-semibold text-midnight">Kategorier & tag-farver</h1>
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

        <nav className="grid gap-3 md:grid-cols-4">
          {[
            { href: "#event-tags", title: "Event-tags", count: eventCategoryItems.length },
            { href: "#main", title: "Hovedkategorier", count: mainItems.length },
            { href: "#sub", title: "Underkategorier", count: subItems.length },
            { href: "#tags", title: "Tags", count: tagItems.length },
          ].map((item) => (
            <a className="rounded-md border border-midnight/10 bg-white p-4 shadow-soft transition hover:border-sage-700" href={item.href} key={item.href}>
              <p className="text-sm font-semibold text-sage-700">{item.title}</p>
              <p className="mt-1 text-3xl font-semibold text-midnight">{item.count}</p>
            </a>
          ))}
        </nav>

        <div className="rounded-md border border-sage-700/20 bg-white p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <Layers3 className="mt-1 size-5 text-sage-700" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-midnight">Eventformat</h2>
              <p className="mt-2 text-sm leading-6 text-ink/64">
                Eventformat er et separat felt på events: Fysisk event, Online event eller Hybrid event.
              </p>
            </div>
          </div>
        </div>

        <SectionShell
          id="event-tags"
          eyebrow="Visning"
          title="Farver på event-tags"
          description="Disse farver bruges på kategori-tags på eventkort, kort-popup og eventsider."
        >
          <details className="mb-4 rounded-md border border-sage-700/20 bg-sage-50">
            <summary className="cursor-pointer list-none p-4 font-semibold text-olive">Opret nyt kategori-tag</summary>
            <div className="border-t border-sage-700/15 bg-white p-4">
              <CategoryForm title="Opret kategori-tag" />
            </div>
          </details>

          <div className="grid gap-3">
            {eventCategoryItems.map((category) => (
              <details className="group rounded-md border border-midnight/10 bg-white" key={category.id}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: category.color_hex }}>
                      {category.name}
                    </span>
                    <span className="rounded-md bg-midnight/5 px-2 py-1 text-xs font-semibold text-midnight">{category.color_hex}</span>
                    <StatusPill active={category.is_active} />
                  </div>
                  <ChevronDown className="size-4 shrink-0 text-ink/45 transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-midnight/10 bg-[#fbfaf7] p-4">
                  <CategoryForm category={category as never} title={"Rediger: " + category.name} />
                </div>
              </details>
            ))}
          </div>
        </SectionShell>

        <SectionShell
          id="main"
          eyebrow="Struktur"
          title="Hovedkategorier"
          description="Brede kategorier, som gør det nemmere at holde mange spirituelle eventtyper overskuelige."
        >
          <details className="mb-4 rounded-md border border-sage-700/20 bg-sage-50">
            <summary className="cursor-pointer list-none p-4 font-semibold text-olive">Opret hovedkategori</summary>
            <div className="border-t border-sage-700/15 bg-white p-4">
              <BasicForm action={upsertMainCategoryAction} table="main_categories" title="Opret hovedkategori" showColor showImage />
            </div>
          </details>
          <EditableList
            emptyText="Der er ingen hovedkategorier endnu."
            items={mainItems}
            renderForm={(item) => <BasicForm action={upsertMainCategoryAction} item={item} table="main_categories" title={"Rediger: " + item.name} showColor showImage />}
            renderSummary={(item) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-midnight">{item.name}</span>
                <span className="rounded-md bg-sage-50 px-2 py-1 text-xs font-semibold text-sage-700">{item.slug}</span>
                <StatusPill active={item.is_active} />
              </div>
            )}
          />
        </SectionShell>

        <SectionShell
          id="sub"
          eyebrow="Eventformer"
          title="Underkategorier"
          description="Konkrete eventformer som Lydbad, Yoga, Saunagus, Kirtan eller Fuldmåneceremoni."
        >
          <details className="mb-4 rounded-md border border-sage-700/20 bg-sage-50">
            <summary className="cursor-pointer list-none p-4 font-semibold text-olive">Opret underkategori</summary>
            <div className="border-t border-sage-700/15 bg-white p-4">
              <SubcategoryForm mainCategories={mainItems} />
            </div>
          </details>
          <EditableList
            emptyText="Der er ingen underkategorier endnu."
            items={subItems}
            renderForm={(item) => <SubcategoryForm item={item} mainCategories={mainItems} />}
            renderSummary={(item) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-midnight">{item.name}</span>
                <span className="rounded-md bg-sage-50 px-2 py-1 text-xs font-semibold text-sage-700">{item.slug}</span>
                <StatusPill active={item.is_active} />
              </div>
            )}
          />
        </SectionShell>

        <SectionShell
          id="tags"
          eyebrow="Filtre"
          title="Tags"
          description="Ekstra søge- og filterord som Begyndervenlig, Gratis, Weekend, Online eller Fuldmåne."
        >
          <details className="mb-4 rounded-md border border-sage-700/20 bg-sage-50">
            <summary className="cursor-pointer list-none p-4 font-semibold text-olive">Opret tag</summary>
            <div className="border-t border-sage-700/15 bg-white p-4">
              <BasicForm action={upsertTagAction} table="tags" title="Opret tag" />
            </div>
          </details>
          <EditableList
            emptyText="Der er ingen tags endnu."
            items={tagItems}
            renderForm={(item) => <BasicForm action={upsertTagAction} item={item} table="tags" title={"Rediger: " + item.name} />}
            renderSummary={(item) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-midnight">{item.name}</span>
                <span className="rounded-md bg-sage-50 px-2 py-1 text-xs font-semibold text-sage-700">{item.slug}</span>
                <StatusPill active={item.is_active} />
              </div>
            )}
          />
        </SectionShell>
      </section>
    </main>
  );
}
