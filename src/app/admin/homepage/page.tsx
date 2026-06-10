import Link from "next/link";
import { ArrowLeft, LayoutGrid, Save, Trash2 } from "lucide-react";
import { upsertHomepageTileAction, deleteHomepageTileAction } from "@/app/admin/homepage/actions";
import { HomepageImageUploadPreview } from "@/components/admin/homepage-image-upload-preview";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminHomepagePageProps = {
  searchParams: Promise<{ message?: string }>;
};

type Tile = {
  id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  image_url?: string | null;
  href: string;
  tile_type: string;
  is_active: boolean;
  sort_order: number;
};

function TileForm({ tile, title }: { tile?: Tile; title: string }) {
  return (
    <form action={upsertHomepageTileAction} className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <input name="id" type="hidden" value={tile?.id ?? ""} />
      <input name="image_path" type="hidden" value={tile?.image_path ?? ""} />

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-midnight">{title}</h2>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink/72">
          <input className="size-4 accent-sage-700" defaultChecked={tile?.is_active ?? true} name="is_active" type="checkbox" />
          Aktiv
        </label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className="grid gap-3">
          <HomepageImageUploadPreview imagePath={tile?.image_path ?? null} imageUrl={tile?.image_url ?? null} />

          {tile?.image_path && (
            <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
              <input className="size-4 accent-terracotta" name="remove_image" type="checkbox" />
              Fjern nuværende billede
            </label>
          )}
        </div>

        <div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Titel
              <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={tile?.title ?? ""} name="title" required />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Link
              <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={tile?.href ?? "/#events"} name="href" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Type
              <select className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={tile?.tile_type ?? "navigation"} name="tile_type">
                <option value="navigation">Navigation</option>
                <option value="nearby">Events nær dig</option>
                <option value="category">Kategori</option>
                <option value="campaign">Kampagne/tema</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Sortering
              <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={tile?.sort_order ?? 0} name="sort_order" type="number" />
            </label>
          </div>

          <label className="mt-4 grid gap-2 text-sm font-medium text-ink/72">
            Beskrivelse
            <textarea className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700" defaultValue={tile?.description ?? ""} name="description" />
          </label>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700" type="submit">
              <Save className="size-4" aria-hidden="true" />
              Gem boks
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default async function AdminHomepagePage({ searchParams }: AdminHomepagePageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = await createClient();
  const { data: tiles } = await supabase.from("homepage_tiles").select("*").order("sort_order");
  const tilesWithImages =
    tiles?.map((tile) => ({
      ...tile,
      image_url: tile.image_path ? supabase.storage.from("media").getPublicUrl(tile.image_path).data.publicUrl : null,
    })) ?? [];

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <LayoutGrid className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Forsidebokse</h1>
            </div>
          </div>
          <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta" href="/admin">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />
        <TileForm title="Opret ny boks" />

        <div className="grid gap-5">
          {tilesWithImages.map((tile) => (
            <article className="grid gap-3" key={tile.id}>
              <TileForm tile={tile as Tile} title={"Rediger: " + tile.title} />
              <form action={deleteHomepageTileAction} className="-mt-4 px-5 pb-2">
                <input name="id" type="hidden" value={tile.id} />
                <button className="inline-flex h-9 items-center gap-2 rounded-md border border-terracotta/30 bg-white px-3 text-sm font-semibold text-terracotta transition hover:bg-terracotta hover:text-white" type="submit">
                  <Trash2 className="size-4" aria-hidden="true" />
                  Slet boks
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
