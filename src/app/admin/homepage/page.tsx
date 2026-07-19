import Link from "next/link";
import { ArrowLeft, ChevronDown, LayoutGrid, Save, Trash2 } from "lucide-react";
import {
  deleteHeroImageAction,
  deleteHomepageTileAction,
  updateSiteLogoAction,
  upsertWeeklyReflectionAction,
  upsertHeroImageAction,
  upsertHomepageTileAction,
  useHomepageHeroImageAction,
} from "@/app/admin/homepage/actions";
import { HomepageImageUploadPreview } from "@/components/admin/homepage-image-upload-preview";
import {
  WeeklyReflectionBackgroundFields,
  WeeklyReflectionLivePreview,
  WeeklyReflectionStatusSwitch,
  WeeklyReflectionSubmitButton,
} from "@/components/admin/weekly-reflection-editor-ui";
import { WeeklyReflectionImageField } from "@/components/admin/weekly-reflection-image-field";
import { BrandLogo } from "@/components/brand-logo";
import { AuthMessage } from "@/components/auth/auth-message";
import { desktopBrandLogoSettingKey, faviconSettingKey, mobileBrandLogoSettingKey, resolveBrandLogoUrl } from "@/lib/brand-logo";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminHomepagePageProps = {
  searchParams: Promise<{ message?: string; logo_message?: string; reflection_message?: string }>;
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

type MainCategory = {
  id: string;
  name: string;
};

type HeroImage = {
  id: string;
  scope: "homepage" | "main_category";
  main_category_id: string | null;
  image_path: string;
  image_url?: string | null;
  alt_text: string | null;
  is_active: boolean;
  sort_order: number;
};

type WeeklyReflection = {
  id: string;
  title: string;
  reflection_text: string;
  author: string | null;
  background_color: string;
  image_alt_text: string | null;
  image_path: string | null;
  image_url?: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
};

const weeklyReflectionGradientOptions = [
  { value: "gradient:lavender-cream", label: "Lavendel til creme" },
  { value: "gradient:sage-sand", label: "Salvie til varm sand" },
  { value: "gradient:dusty-purple-beige", label: "Støvet lilla til lys beige" },
  { value: "gradient:warm-grey-cream", label: "Varm grå til creme" },
];

function copenhagenDateInputValue(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Copenhagen",
    year: "numeric",
  }).format(date);
}

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

function HeroImageForm({
  categories,
  heroImage,
  scope,
  title,
}: {
  categories: MainCategory[];
  heroImage?: HeroImage;
  scope: "homepage" | "main_category";
  title: string;
}) {
  const active = heroImage?.is_active ?? true;
  const isCategoryHero = scope === "main_category";

  return (
    <details className={"overflow-hidden rounded-card border shadow-soft " + (!active ? "border-stone-300 bg-stone-50/80 opacity-85" : "border-midnight/10 bg-white")} suppressHydrationWarning>
      <summary className="cursor-pointer list-none border-b border-midnight/10 bg-[#FAF6EF] px-5 py-4 marker:hidden sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">
              {isCategoryHero ? "Hovedkategori-hero" : "Forside-hero"}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-midnight">{title}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {heroImage && <TileStatus active={active} />}
            <span className="rounded-full border border-midnight/10 bg-white px-3 py-1 text-xs font-semibold text-ink/60">Klik for at åbne/lukke</span>
            <ChevronDown className="size-4 text-ink/45" aria-hidden="true" />
          </div>
        </div>
      </summary>

      <form action={upsertHeroImageAction} className="grid gap-5 p-5 sm:p-6">
        <input name="id" type="hidden" value={heroImage?.id ?? ""} />
        <input name="image_path" type="hidden" value={heroImage?.image_path ?? ""} />
        <input name="scope" type="hidden" value={scope} />

        <HomepageImageUploadPreview
          helpText="Anbefalet format: ca. 2400 x 1600 px. JPG, PNG eller WebP op til 10 MB."
          imagePath={heroImage?.image_path ?? null}
          imageUrl={heroImage?.image_url ?? null}
          inputName="hero_image"
          label={heroImage ? "Udskift hero-billede" : "Upload hero-billede"}
          previewAspectClassName="aspect-[3/2]"
        >
          <div className="grid min-w-0 gap-5">
            {isCategoryHero && (
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Hovedkategori
                <select
                  className="h-11 w-full min-w-0 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                  defaultValue={heroImage?.main_category_id ?? ""}
                  name="main_category_id"
                  required
                >
                  <option value="">Vælg hovedkategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Alternativ tekst
              <input
                className="h-11 w-full min-w-0 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                defaultValue={heroImage?.alt_text ?? ""}
                maxLength={160}
                name="alt_text"
                placeholder="Kort beskrivelse af billedet"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Sortering
                <input
                  className="h-11 w-full min-w-0 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                  defaultValue={heroImage?.sort_order ?? 0}
                  name="sort_order"
                  type="number"
                />
              </label>
              <label className="flex items-end gap-2 pb-3 text-sm font-semibold text-midnight">
                <input className="size-4 accent-sage-700" defaultChecked={active} name="is_active" type="checkbox" />
                Billedet er aktivt
              </label>
            </div>
          </div>
        </HomepageImageUploadPreview>

        <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700 sm:w-fit" type="submit">
          <Save className="size-4" aria-hidden="true" />
          Gem hero-billede
        </button>
      </form>

      {heroImage && (
        <div className="flex flex-wrap gap-3 border-t border-midnight/10 bg-white px-5 py-4 sm:px-6">
          {!isCategoryHero && (
            <form action={useHomepageHeroImageAction}>
              <input name="id" type="hidden" value={heroImage.id} />
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-sage-700/25 bg-white px-3 text-sm font-semibold text-sage-700 transition hover:bg-sage-700 hover:text-white"
                type="submit"
              >
                Brug som forsidebillede
              </button>
            </form>
          )}
          <form action={deleteHeroImageAction}>
            <input name="id" type="hidden" value={heroImage.id} />
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-terracotta/30 bg-white px-3 text-sm font-semibold text-terracotta transition hover:bg-terracotta hover:text-white" type="submit">
              <Trash2 className="size-4" aria-hidden="true" />
              Slet hero-billede
            </button>
          </form>
        </div>
      )}
    </details>
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

function LogoForm({
  desktopLogoPath,
  desktopLogoUrl,
  faviconPath,
  faviconUrl,
  mobileLogoPath,
  mobileLogoUrl,
}: {
  desktopLogoPath: string | null;
  desktopLogoUrl: string | null;
  faviconPath: string | null;
  faviconUrl: string | null;
  mobileLogoPath: string | null;
  mobileLogoUrl: string | null;
}) {
  return (
    <details className="overflow-hidden rounded-card border border-midnight/10 bg-white shadow-soft" id="logo" open suppressHydrationWarning>
      <summary className="cursor-pointer list-none border-b border-midnight/10 bg-[#FAF6EF] px-5 py-4 marker:hidden sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-700">Logo</p>
            <h2 className="mt-1 text-xl font-semibold text-midnight">Upload logoer</h2>
          </div>
          <span className="rounded-full border border-midnight/10 bg-white px-3 py-1 text-xs font-semibold text-ink/60">
            Klik for at åbne/lukke
          </span>
        </div>
      </summary>

      <form action={updateSiteLogoAction} className="p-5 sm:p-6">
        <input name="current_desktop_logo_path" type="hidden" value={desktopLogoPath ?? ""} />
        <input name="current_mobile_logo_path" type="hidden" value={mobileLogoPath ?? ""} />
        <input name="current_favicon_path" type="hidden" value={faviconPath ?? ""} />
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <div className="grid gap-3">
            <div className="grid min-h-[200px] place-items-center rounded-md border border-midnight/10 bg-[#FAF6EF] p-6">
              {desktopLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Nuværende desktop-logo" className="max-h-36 max-w-full object-contain" src={desktopLogoUrl} />
              ) : (
                <BrandLogo className="h-32 w-32" />
              )}
            </div>
            <p className="text-sm font-semibold text-midnight">Desktop-logo</p>
            <p className="text-xs leading-5 text-ink/55">
              Brug versionen med teksten SoulEvents. Den vises fra md-breakpointet og op.
            </p>
            <label className="mt-5 grid gap-2 text-sm font-medium text-ink/72">
              Vælg desktop-logo
              <input accept="image/png,image/webp,image/jpeg,image/svg+xml" className="rounded-md border border-midnight/15 bg-white px-3 py-2 text-sm" name="desktop_logo_file" type="file" />
            </label>
            {desktopLogoPath && (
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink/70">
                <input className="size-4 accent-terracotta" name="remove_desktop_logo" type="checkbox" />
                Fjern desktop-logo og brug standardlogo
              </label>
            )}
          </div>

          <div className="grid gap-3">
            <div className="grid min-h-[200px] place-items-center rounded-md border border-midnight/10 bg-[#FAF6EF] p-6">
              {mobileLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Nuværende mobil-logo" className="max-h-36 max-w-full object-contain" src={mobileLogoUrl} />
              ) : (
                <BrandLogo className="h-32 w-32" />
              )}
            </div>
            <p className="text-sm font-semibold text-midnight">Mobil-logo</p>
            <p className="text-xs leading-5 text-ink/55">
              Brug ikon-/træversionen uden tekst. Den vises på små skærme.
            </p>
            <label className="mt-5 grid gap-2 text-sm font-medium text-ink/72">
              Vælg mobil-logo
              <input accept="image/png,image/webp,image/jpeg,image/svg+xml" className="rounded-md border border-midnight/15 bg-white px-3 py-2 text-sm" name="mobile_logo_file" type="file" />
            </label>
            {mobileLogoPath && (
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink/70">
                <input className="size-4 accent-terracotta" name="remove_mobile_logo" type="checkbox" />
                Fjern mobil-logo og brug desktop-logo på mobil
              </label>
            )}
          </div>

          <div className="grid gap-3">
            <div className="grid min-h-[200px] place-items-center rounded-md border border-midnight/10 bg-[#FAF6EF] p-6">
              {faviconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Nuværende favicon" className="size-20 object-contain" src={faviconUrl} />
              ) : (
                <div className="grid size-20 place-items-center rounded-md border border-dashed border-midnight/20 bg-white text-xs font-semibold text-ink/45">
                  Favicon
                </div>
              )}
            </div>
            <p className="text-sm font-semibold text-midnight">Favicon</p>
            <p className="text-xs leading-5 text-ink/55">
              Brug et enkelt ikon i ICO, PNG eller SVG. Det vises i browserfanen.
            </p>
            <label className="mt-5 grid gap-2 text-sm font-medium text-ink/72">
              Vælg favicon
              <input accept="image/png,image/svg+xml,image/x-icon,.ico" className="rounded-md border border-midnight/15 bg-white px-3 py-2 text-sm" name="favicon_file" type="file" />
            </label>
            {faviconPath && (
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink/70">
                <input className="size-4 accent-terracotta" name="remove_favicon" type="checkbox" />
                Fjern favicon
              </label>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-midnight/10 pt-5">
          <p className="max-w-2xl text-sm leading-6 text-ink/68">
            Upload gerne transparente SVG-filer til logoerne, så de står skarpt på Retina-skærme og passer på farvede baggrunde.
          </p>
          <button className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700" type="submit">
            <Save className="size-4" aria-hidden="true" />
            Gem logoer
          </button>
        </div>
      </form>
    </details>
  );
}

function WeeklyReflectionForm({ reflection }: { reflection?: WeeklyReflection }) {
  const currentBackground = reflection?.background_color ?? "#FAF6EF";
  const usesGradient = currentBackground.startsWith("gradient:");
  const today = copenhagenDateInputValue();
  const isExpired = Boolean(reflection?.end_date && reflection.end_date < today);

  return (
    <section className="overflow-hidden rounded-card border border-midnight/10 bg-white shadow-soft" id="weekly-reflection">
      <div className="border-b border-midnight/10 bg-[#FAF6EF] px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Ugens refleksion</p>
        <h2 className="mt-1 text-xl font-semibold text-midnight">Rediger refleksion på forsiden</h2>
      </div>

      <form action={upsertWeeklyReflectionAction} className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_380px]" id="weekly-reflection-form">
        <input name="id" type="hidden" value={reflection?.id ?? ""} />

        <div className="grid gap-8">
          <section className="grid gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A4EAB]">1. Indhold</p>
              <h3 className="mt-1 text-lg font-semibold text-midnight">Tekst og afsender</h3>
            </div>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Overskrift
              <input
                className="h-11 w-full rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                defaultValue={reflection?.title ?? "Ugens refleksion"}
                maxLength={80}
                name="title"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Refleksionstekst
              <textarea
                className="min-h-44 w-full rounded-md border border-midnight/15 px-3 py-3 text-lg leading-8 outline-none transition focus:border-sage-700"
                defaultValue={reflection?.reflection_text ?? ""}
                maxLength={600}
                name="reflection_text"
                placeholder="Skriv en kort refleksion eller et citat"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Forfatter (valgfri)
              <input
                className="h-11 w-full rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                defaultValue={reflection?.author ?? ""}
                maxLength={80}
                name="author"
                placeholder="SoulEvents"
              />
            </label>
          </section>

          <section className="grid gap-5 border-t border-midnight/10 pt-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A4EAB]">2. Udseende</p>
              <h3 className="mt-1 text-lg font-semibold text-midnight">Baggrund og billede</h3>
            </div>
            <WeeklyReflectionBackgroundFields
              currentBackground={currentBackground}
              gradientOptions={weeklyReflectionGradientOptions}
              usesGradient={usesGradient}
            />
            <WeeklyReflectionImageField
              altText={reflection?.image_alt_text ?? null}
              imagePath={reflection?.image_path ?? null}
              imageUrl={reflection?.image_url ?? null}
            />
          </section>

          <section className="grid gap-5 border-t border-midnight/10 pt-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A4EAB]">3. Publicering</p>
              <h3 className="mt-1 text-lg font-semibold text-midnight">Periode og status</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Startdato (valgfri)
                <input
                  className="h-11 w-full rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                  defaultValue={reflection?.start_date ?? today}
                  name="start_date"
                  type="date"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Slutdato (valgfri)
                <input
                  className="h-11 w-full rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                  defaultValue={reflection?.end_date ?? ""}
                  name="end_date"
                  type="date"
                />
              </label>
            </div>
            <WeeklyReflectionStatusSwitch defaultChecked={reflection?.is_active ?? false} isExpired={isExpired} />
            <WeeklyReflectionSubmitButton />
          </section>
        </div>

        <WeeklyReflectionLivePreview
          author={reflection?.author ?? null}
          backgroundColor={currentBackground}
          imageAltText={reflection?.image_alt_text ?? null}
          imageUrl={reflection?.image_url ?? null}
          reflectionText={reflection?.reflection_text ?? ""}
          title={reflection?.title ?? "Ugens refleksion"}
          usesGradient={usesGradient}
        />
      </form>
    </section>
  );
}

function TileForm({ tile, title }: { tile?: Tile; title: string }) {
  const active = tile?.is_active ?? true;
  const isNew = !tile;

  return (
    <details className={"overflow-hidden rounded-card border shadow-soft " + (!active ? "border-stone-300 bg-stone-50/80 opacity-85" : "border-midnight/10 bg-white")} suppressHydrationWarning>
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
                  <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={tile?.title ?? ""} name="title" required maxLength={80} />
                </label>
                <label className="grid gap-2 text-sm font-medium text-ink/72">
                  Link
                  <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={tile?.href ?? "/#events"} name="href" placeholder="/?tag=Gratis#events eller /artikler/plantemedicin" maxLength={300} />
                  <span className="text-xs leading-5 text-ink/55">
                    Eksempler: /?tag=Gratis#events, /facilitators, /bliv-arrangoer eller en artikelside.
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
                <textarea className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700" defaultValue={tile?.description ?? ""} name="description" maxLength={300} />
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
  const [{ message, logo_message: logoMessage, reflection_message: reflectionMessage }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = createAdminClient();
  const [{ data: desktopLogoSetting }, { data: mobileLogoSetting }, { data: faviconSetting }] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", desktopBrandLogoSettingKey).maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", mobileBrandLogoSettingKey).maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", faviconSettingKey).maybeSingle(),
  ]);
  const desktopLogoPath = desktopLogoSetting?.value ?? null;
  const mobileLogoPath = mobileLogoSetting?.value ?? null;
  const faviconPath = faviconSetting?.value ?? null;
  const desktopLogoUrl = resolveBrandLogoUrl(desktopLogoPath);
  const mobileLogoUrl = mobileLogoPath ? resolveBrandLogoUrl(mobileLogoPath) : null;
  const faviconUrl = faviconPath ? resolveBrandLogoUrl(faviconPath) : null;
  const [{ data: tiles }, { data: categories }, { data: heroImages, error: heroImagesError }, { data: weeklyReflections, error: weeklyReflectionError }] = await Promise.all([
    supabase.from("homepage_tiles").select("*").order("sort_order"),
    supabase.from("main_categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("hero_images").select("*").order("scope").order("sort_order"),
    supabase.from("weekly_reflections").select("*").order("is_active", { ascending: false }).order("updated_at", { ascending: false }).limit(1),
  ]);
  const tilesWithImages =
    tiles?.map((tile) => ({
      ...tile,
      image_url: tile.image_path ? supabase.storage.from("media").getPublicUrl(tile.image_path).data.publicUrl : null,
    })) ?? [];
  const categoriesList = (categories ?? []) as MainCategory[];
  const heroImagesWithUrls =
    heroImages?.map((heroImage) => ({
      ...heroImage,
      image_url: heroImage.image_path ? supabase.storage.from("media").getPublicUrl(heroImage.image_path).data.publicUrl : null,
    })) ?? [];
  const homepageHeroImages = heroImagesWithUrls.filter((heroImage) => heroImage.scope === "homepage") as HeroImage[];
  const categoryHeroImages = heroImagesWithUrls.filter((heroImage) => heroImage.scope === "main_category") as HeroImage[];
  const weeklyReflection = weeklyReflections?.[0] as WeeklyReflection | undefined;
  if (weeklyReflection?.image_path) {
    weeklyReflection.image_url = supabase.storage.from("media").getPublicUrl(weeklyReflection.image_path).data.publicUrl;
  }
  const knownCategoryIds = new Set(categoriesList.map((category) => category.id));
  const categoryHeroImagesByCategoryId = new Map<string, HeroImage[]>();

  for (const heroImage of categoryHeroImages) {
    if (!heroImage.main_category_id) {
      continue;
    }

    const existingImages = categoryHeroImagesByCategoryId.get(heroImage.main_category_id) ?? [];
    categoryHeroImagesByCategoryId.set(heroImage.main_category_id, [...existingImages, heroImage]);
  }

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
        <AuthMessage message={reflectionMessage} />

        <section className="rounded-card border border-midnight/10 bg-white p-5 shadow-soft sm:p-6">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Forsideindhold</p>
            <h2 className="text-2xl font-semibold text-midnight">Styr de store 1:1 bokse og logo</h2>
            <p className="max-w-3xl text-sm leading-6 text-ink/68">
              Brug siden til at oprette, sortere, skjule og ændre de bokse, der giver brugeren hurtige veje ind i SoulEvents.dk.
            </p>
          </div>
        </section>

        <LogoForm desktopLogoPath={desktopLogoPath} desktopLogoUrl={desktopLogoUrl} faviconPath={faviconPath} faviconUrl={faviconUrl} mobileLogoPath={mobileLogoPath} mobileLogoUrl={mobileLogoUrl} />

        {weeklyReflectionError ? (
          <section className="rounded-card border border-terracotta/30 bg-terracotta/10 p-5 text-sm font-semibold leading-6 text-terracotta shadow-soft" id="weekly-reflection">
            Ugens refleksion mangler databaseopsætning. Kør migrationen til weekly_reflections i Supabase først.
          </section>
        ) : (
          <WeeklyReflectionForm reflection={weeklyReflection} />
        )}

        <section className="grid gap-5 rounded-card border border-midnight/10 bg-white p-5 shadow-soft sm:p-6" id="hero-images">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Hero-billeder</p>
            <h2 className="text-2xl font-semibold text-midnight">Stemningsbilleder til forside og hovedkategorier</h2>
            <p className="max-w-3xl text-sm leading-6 text-ink/68">
              Upload op til 5 forsidebilleder, vælg hvilke der er aktive, og lad SoulEvents vise ét roligt stemningsbillede pr. besøg.
            </p>
          </div>

          {heroImagesError && (
            <div className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm font-semibold leading-6 text-terracotta">
              Hero-billeder mangler databaseopsætning. Kør migrationen til hero_images i Supabase, før billeder kan gemmes.
            </div>
          )}

          <div className="grid gap-4">
            {homepageHeroImages.length < 5 ? (
              <HeroImageForm categories={categoriesList} scope="homepage" title="Tilføj hero-billede til forsiden" />
            ) : (
              <div className="rounded-card border border-sage-700/20 bg-sage-50 p-5 text-sm font-semibold leading-6 text-sage-700 shadow-soft">
                Du har allerede 5 hero-billeder til forsiden. Slet et eksisterende billede, før du uploader et nyt.
              </div>
            )}
            <HeroImageForm categories={categoriesList} scope="main_category" title="Tilføj hero-billede til hovedkategori" />
          </div>

          {homepageHeroImages.length > 0 && (
            <section className="grid gap-3">
              <h3 className="text-lg font-semibold text-midnight">Forsidebilleder</h3>
              <div className="grid gap-4">
                {homepageHeroImages.map((heroImage) => (
                  <HeroImageForm categories={categoriesList} heroImage={heroImage} key={heroImage.id} scope="homepage" title={"Forsidebillede · Sortering " + heroImage.sort_order} />
                ))}
              </div>
            </section>
          )}

          {categoryHeroImages.length > 0 && (
            <section className="grid gap-3">
              <h3 className="text-lg font-semibold text-midnight">Hovedkategori-billeder</h3>
              <div className="grid gap-5">
                {categoriesList.map((category) => {
                  const categoryImages = categoryHeroImagesByCategoryId.get(category.id) ?? [];

                  if (categoryImages.length === 0) {
                    return null;
                  }

                  return (
                    <section className="grid gap-3 rounded-card border border-midnight/10 bg-[#FAF6EF] p-4" key={category.id}>
                      <h4 className="text-base font-semibold text-midnight">{category.name}</h4>
                      <div className="grid gap-4">
                        {categoryImages.map((heroImage) => (
                          <HeroImageForm
                            categories={categoriesList}
                            heroImage={heroImage}
                            key={heroImage.id}
                            scope="main_category"
                            title={category.name + " · Sortering " + heroImage.sort_order}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
                {categoryHeroImages
                  .filter((heroImage) => !heroImage.main_category_id || !knownCategoryIds.has(heroImage.main_category_id))
                  .map((heroImage) => (
                    <HeroImageForm
                      categories={categoriesList}
                      heroImage={heroImage}
                      key={heroImage.id}
                      scope="main_category"
                      title={"Ukendt hovedkategori · Sortering " + heroImage.sort_order}
                    />
                  ))}
              </div>
            </section>
          )}
        </section>

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
