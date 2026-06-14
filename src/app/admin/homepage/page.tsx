import Link from "next/link";
import { ArrowLeft, ChevronDown, LayoutGrid, Save, Trash2 } from "lucide-react";
import { upsertHomepageTileAction, deleteHomepageTileAction, updateSiteLogoAction } from "@/app/admin/homepage/actions";
import { HomepageImageUploadPreview } from "@/components/admin/homepage-image-upload-preview";
import { BrandLogo } from "@/components/brand-logo";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminHomepagePageProps = {
  searchParams: Promise<{ message?: string; logo_message?: string }>;
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

function TileStatus({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex h-8 items-center rounded-full bg-sage-50 px-3 text-xs font-bold uppercase tracking-wide text-sage-700 shadow-soft">
      Aktiv
    </span>
  ) : (
    <span className="inline-flex h-8 items-center rounded-full bg-stone-100 px-3 text-xs font-bold uppercase tracking-wide text-stone-600 shadow-soft">
      Skjult
    </span>
  );
}

function tileTypeLabel(type: string) {
  const labels: Record<string, string> = {
    navigation: "Navigation",
    nearby: "Events nær dig",
    category: "Kategori",
    campaign: "Kampagne/tema",
  };
  return labels[type] ?? type;
}

function LogoForm({ logoPath, logoUrl }: { logoPath: string | null; logoUrl: string | null }) {
  return (
    <details className="overflow-hidden rounded-card border border-midnight/10 bg-white shadow-soft" id="logo" open>
      <summary className="cursor-pointer list-none border-b border-midnight/10 bg-[#FAF6EF] px-5 py-4 marker:hidden sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-700">Logo</p>
            <h2 className="mt-1 text-xl font-semibold text-midnight">Upload logo</h2>
          </div>
          <span className="rounded-full border border-midnight/10 bg-white px-3 py-1 text-xs font-semibold text-ink/60">
            Klik for at åbne/lukke
          </span>
        </div>
      </summary>

      <form action={updateSiteLogoAction} className="p-5 sm:p-6">
        <input name="current_logo_path" type="hidden" value={logoPath ?? ""} />
        <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
          <div className="grid gap-3">
            <div className="grid min-h-[200px] place-items-center rounded-md border border-midnight/10 bg-[#FAF6EF] p-6">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Nuværende logo" className="max-h-36 max-w-full object-contain" src={logoUrl} />
              ) : (
                <BrandLogo className="h-32 w-32" />
              )}
            </div>
            <p className="text-xs leading-5 text-ink/55">
              Anbefalet: transparent PNG eller SVG. Undgå hvid baggrund i selve filen.
            </p>
          </div>

          <div>
            <p className="max-w-2xl text-sm leading-6 text-ink/68">
              Logoet bruges i toppen af siden og på forsiden. Upload gerne en transparent PNG eller SVG, så logoet passer på farvede baggrunde.
            </p>
            <label className="mt-5 grid gap-2 text-sm font-medium text-ink/72">
              Vælg logo
              <input accept="image/png,image/webp,image/jpeg,image/svg+xml" className="rounded-md border border-midnight/15 bg-white px-3 py-2 text-sm" name="logo_file" type="file" />
            </label>
            {logoPath && (
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink/70">
                <input className="size-4 accent-terracotta" name="remove_logo" type="checkbox" />
                Fjern uploadet logo og brug standardlogo
              </label>
            )}
            <button className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700" type="submit">
              <Save className="size-4" aria-hidden="true" />
              Gem logo
            </button>
          </div>
        </div>
      </form>
    </details>
  );
}

function TileForm({ tile, title }: { tile?: Tile; title: string }) {
  const active = tile?.is_active ?? true;
  const isNew = !tile;

  return (
    <details className={"overflow-hidden rounded-card border shadow-soft " + (!active ? "border-stone-300 bg-stone-50/80 opacity-85" : "border-midnight/10 bg-white")}>
      <summary className="cursor-pointer list-none border-b border-midnight/10 bg-[#FAF6EF] px-5 py-4 marker:hidden sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">{isNew ? "Ny forsideboks" : "Rediger forsideboks"}</p>
            <h2 className="mt-1 text-xl font-semibold text-midnight">{title}</h2>
            {tile && (
              <p className="mt-1 text-sm text-ink/60">
                {tileTypeLabel(tile.tile_type)} · Sortering {tile.sort_order} · {tile.href}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isNew && <TileStatus active={active} />}
            {tile && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60 shadow-soft">{tileTypeLabel(tile.tile_type)}</span>}
            <span className="rounded-full border border-midnight/10 bg-white px-3 py-1 text-xs font-semibold text-ink/60">Klik for at åbne/lukke</span>
            <ChevronDown className="size-4 text-ink/45" aria-hidden="true" />
          </div>
        </div>
      </summary>

      <form action={upsertHomepageTileAction} className="p-5 sm:p-6">
        <input name="id" type="hidden" value={tile?.id ?? ""} />
        <input name="image_path" type="hidden" value={tile?.image_path ?? ""} />

        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <aside className="grid content-start gap-4">
            <HomepageImageUploadPreview imagePath={tile?.image_path ?? null} imageUrl={tile?.image_url ?? null} />
            <section className="rounded-md border border-midnight/10 bg-[#FAF6EF] p-4">
              <h3 className="text-sm font-semibold text-midnight">Billede</h3>
              <p className="mt-2 text-xs leading-5 text-ink/55">
                Anbefalet: kvadratisk billede 1200 x 1200 px. Brug helst WebP, ellers JPG eller PNG. Hold gerne filen under 1-2 MB.
              </p>
              {tile?.image_path && (
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink/70">
                  <input className="size-4 accent-terracotta" name="remove_image" type="checkbox" />
                  Fjern nuværende billede
                </label>
              )}
            </section>
          </aside>

          <div className="min-w-0 grid gap-5">
            <section className="rounded-md border border-midnight/10 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-sage-700">Indhold</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-ink/72">
                  Titel
                  <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={tile?.title ?? ""} name="title" required />
                </label>
                <label className="grid gap-2 text-sm font-medium text-ink/72">
                  Link
                  <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={tile?.href ?? "/#events"} name="href" placeholder="/?tag=Gratis#events eller /artikler/plantemedicin" />
                  <span className="text-xs leading-5 text-ink/55">
                    Eksempler: /?tag=Gratis#events, /facilitators, /auth/signup eller en artikelside.
                  </span>
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
            </section>

            <section className="rounded-md border border-midnight/10 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-sage-700">Visning</h3>
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-midnight">
                <input className="size-4 accent-sage-700" defaultChecked={active} name="is_active" type="checkbox" />
                Boksen er aktiv på forsiden
              </label>
              <label className="mt-4 grid gap-2 text-sm font-medium text-ink/72">
                Upload billede
                <input accept="image/jpeg,image/png,image/webp" className="rounded-md border border-midnight/15 bg-white px-3 py-2 text-sm" name="image_file" type="file" />
              </label>
            </section>

            <button className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700" type="submit">
              <Save className="size-4" aria-hidden="true" />
              Gem boks
            </button>
          </div>
        </div>
      </form>

      {tile && (
        <form action={deleteHomepageTileAction} className="border-t border-midnight/10 bg-white px-5 py-4 sm:px-6">
          <input name="id" type="hidden" value={tile.id} />
          <button className="inline-flex h-9 items-center gap-2 rounded-md border border-terracotta/30 bg-white px-3 text-sm font-semibold text-terracotta transition hover:bg-terracotta hover:text-white" type="submit">
            <Trash2 className="size-4" aria-hidden="true" />
            Slet boks
          </button>
        </form>
      )}
    </details>
  );
}

export default async function AdminHomepagePage({ searchParams }: AdminHomepagePageProps) {
  const [{ message, logo_message: logoMessage }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = await createClient();
  const { data: logoSetting } = await supabase.from("site_settings").select("value").eq("key", "brand_logo_path").maybeSingle();
  const logoPath = logoSetting?.value ?? null;
  const logoUrl = logoPath ? supabase.storage.from("media").getPublicUrl(logoPath).data.publicUrl : null;
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
        <AuthMessage message={logoMessage} />

        <section className="rounded-card border border-midnight/10 bg-white p-5 shadow-soft sm:p-6">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Forsideindhold</p>
            <h2 className="text-2xl font-semibold text-midnight">Styr de store 1:1 bokse og logo</h2>
            <p className="max-w-3xl text-sm leading-6 text-ink/68">
              Brug siden til at oprette, sortere, skjule og ændre de bokse, der giver brugeren hurtige veje ind i SoulEvents.dk.
            </p>
          </div>
        </section>

        <LogoForm logoPath={logoPath} logoUrl={logoUrl} />
        <TileForm title="Opret ny boks" />

        <div className="grid gap-5">
          {tilesWithImages.map((tile) => (
            <TileForm tile={tile as Tile} title={tile.title} key={tile.id} />
          ))}
        </div>
      </section>
    </main>
  );
}
