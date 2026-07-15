import Link from "next/link";
import { ArrowLeft, CalendarDays, Megaphone, RotateCcw, Save, Trash2 } from "lucide-react";
import { deleteAdAction, upsertAdAction } from "@/app/admin/ads/actions";
import { AdFormCategoryGuard } from "@/components/admin/ads/ad-form-category-guard";
import { AdPreviewTabs } from "@/components/admin/ads/ad-preview-tabs";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminAdsPageProps = {
  searchParams: Promise<{ message?: string }>;
};

type MainCategory = { id: string; name: string };

type Ad = {
  id: string;
  title: string;
  image_path: string | null;
  image_url?: string | null;
  mobile_image_path: string | null;
  mobile_image_url?: string | null;
  ad_reference_id?: string | null;
  alt_text: string | null;
  sponsor_name: string | null;
  target_url: string | null;
  priority: number;
  display_seconds: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  show_on_category_pages: boolean;
  show_on_homepage: boolean;
  homepage_placement: "middle" | "bottom";
  show_in_newsletter: boolean;
  show_title_on_banner: boolean;
  show_sponsor_on_banner: boolean;
  admin_note: string | null;
  clicks_count: number;
  ad_main_categories?: Array<{ main_category_id: string }>;
};

function dateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return "Ingen dato";
  return new Intl.DateTimeFormat("da-DK", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function publicMediaUrl(imagePath: string | null) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  const encodedPath = imagePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/media/" + encodedPath;
}

function campaignStatus(ad: Ad) {
  if (!ad.is_active) return { label: "Deaktiveret", className: "bg-stone-100 text-stone-600" };
  const now = new Date();
  if (ad.starts_at && new Date(ad.starts_at) > now) return { label: "Planlagt", className: "bg-[#EDE4F7] text-[#7A4EAB]" };
  if (ad.ends_at && new Date(ad.ends_at) < now) return { label: "Udløbet", className: "bg-rose-50 text-rose-700" };
  return { label: "Aktiv", className: "bg-sage-50 text-sage-700" };
}

function isCurrentlyActiveAd(ad: Ad) {
  return campaignStatus(ad).label === "Aktiv";
}

function AdForm({ ad, mainCategories, title }: { ad?: Ad; mainCategories: MainCategory[]; title: string }) {
  const selectedCategoryIds = new Set((ad?.ad_main_categories ?? []).map((row) => row.main_category_id));
  const status = ad ? campaignStatus(ad) : null;
  const formId = "ad-form-" + (ad?.id ?? "new");

  return (
    <details className={"overflow-hidden rounded-card border shadow-soft " + (ad && isCurrentlyActiveAd(ad) ? "border-sage-700/25 bg-sage-50/70" : ad && !ad.is_active ? "border-stone-300 bg-stone-50/80 opacity-80" : "border-midnight/10 bg-white")}>
      <summary className={"cursor-pointer list-none border-b border-midnight/10 px-5 py-4 marker:hidden sm:px-6 " + (ad && isCurrentlyActiveAd(ad) ? "bg-sage-50" : "bg-[#FAF6EF]")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">{ad ? "Rediger reklame" : "Ny reklame"}</p>
            <h2 className="mt-1 text-xl font-semibold text-midnight">{title}</h2>
            {ad && <p className="mt-1 text-sm text-ink/60">Internt reference-ID: <span className="font-semibold text-[#7A4EAB]">{ad.ad_reference_id || "afventer"}</span></p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status && <span className={"inline-flex h-8 items-center rounded-full px-3 text-xs font-bold uppercase tracking-wide shadow-soft " + status.className}>Status: {status.label}</span>}
            {ad && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60 shadow-soft">Ref. {ad.ad_reference_id || "afventer"}</span>}
            {ad && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60 shadow-soft">Klik: {ad.clicks_count ?? 0}</span>}
            {ad?.show_on_homepage && <span className="rounded-full bg-[#EDE4F7] px-3 py-1 text-xs font-semibold text-[#7A4EAB] shadow-soft">Vises: Forside</span>}
            {ad?.show_on_homepage && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60 shadow-soft">Placering: {ad.homepage_placement === "middle" ? "Midten" : "Nederst"}</span>}
            {ad?.show_on_category_pages && <span className="rounded-full bg-sage-50 px-3 py-1 text-xs font-semibold text-sage-700 shadow-soft">Vises: Kategorier</span>}
            {ad && !ad.show_on_homepage && !ad.show_on_category_pages && <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600 shadow-soft">Ingen offentlig placering</span>}
            <span className="rounded-full border border-midnight/10 bg-white px-3 py-1 text-xs font-semibold text-ink/60">Klik for at åbne/lukke</span>
          </div>
        </div>
      </summary>

      <form action={upsertAdAction} className="p-5 sm:p-6" id={formId}>
        <input name="id" type="hidden" value={ad?.id ?? ""} />
        <input name="image_path" type="hidden" value={ad?.image_path ?? ""} />
        <input name="mobile_image_path" type="hidden" value={ad?.mobile_image_path ?? ""} />
        <AdFormCategoryGuard formId={formId} />

        <div className="grid gap-6">
          <AdPreviewTabs
            altText={ad?.alt_text}
            desktopPath={ad?.image_path}
            desktopUrl={ad?.image_url}
            formId={formId}
            mobilePath={ad?.mobile_image_path}
            mobileUrl={ad?.mobile_image_url}
            showSponsor={ad?.show_sponsor_on_banner ?? true}
            showTitle={ad?.show_title_on_banner ?? true}
            sponsorName={ad?.sponsor_name}
            title={ad?.title ?? title}
          />

          <section className="rounded-card border border-midnight/10 bg-white p-5 shadow-soft" data-ad-media-section="true">
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Bannere</p>
            <h3 className="mt-1 text-xl font-semibold text-midnight">Desktop- og mobilbanner</h3>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-md border border-midnight/10 bg-[#FAF6EF] p-4">
                <label className="grid gap-2 text-sm font-semibold text-ink/72">
                  Desktopbanner
                  <input accept="image/png,image/jpeg,image/webp,video/mp4" className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sage-700" name="image_file" type="file" />
                </label>
                <p className="mt-2 text-xs leading-5 text-ink/55">Anbefalet: 2800 x 1050 px. Minimum: 2400 x 900 px. JPG/PNG/WEBP op til 20 MB eller MP4 op til 100 MB.</p>
                {ad?.image_path && (
                  <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-terracotta">
                    <input className="size-4 accent-terracotta" name="remove_image" type="checkbox" />
                    Fjern nuværende desktopbanner
                  </label>
                )}
              </div>
              <div className="rounded-md border border-midnight/10 bg-[#FAF6EF] p-4">
                <label className="grid gap-2 text-sm font-semibold text-ink/72">
                  Mobilbanner
                  <input accept="image/png,image/jpeg,image/webp,video/mp4" className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sage-700" name="mobile_image_file" type="file" />
                </label>
                <p className="mt-2 text-xs leading-5 text-ink/55">Anbefalet: 1600 x 1600 px. Minimum: 1200 x 1200 px. Hvis tomt, bruges desktopbanner som fallback. MP4 kan være op til 100 MB.</p>
                {ad?.mobile_image_path && (
                  <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-terracotta">
                    <input className="size-4 accent-terracotta" name="remove_mobile_image" type="checkbox" />
                    Fjern nuværende mobilbanner
                  </label>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Indhold</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Titel/navn
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.title ?? ""} maxLength={80} name="title" required />
              </label>
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Sponsor / partnernavn
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.sponsor_name ?? ""} maxLength={80} name="sponsor_name" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-ink/72 md:col-span-2">
                Link ved klik
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.target_url ?? ""} maxLength={300} name="target_url" placeholder="https://... eller /kontakt" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-ink/72 md:col-span-2">
                Alt-tekst
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.alt_text ?? ""} maxLength={160} name="alt_text" placeholder="Kort beskrivelse af billedet" />
              </label>
              <div className="grid gap-3 rounded-md bg-[#FAF6EF] p-4 md:col-span-2">
                <label className="flex items-start gap-2 text-sm font-semibold text-midnight">
                  <input className="mt-1 size-4 shrink-0 accent-sage-700" defaultChecked={ad?.show_title_on_banner ?? true} name="show_title_on_banner" type="checkbox" />
                  Vis titel oven på banner
                </label>
                <label className="flex items-start gap-2 text-sm font-semibold text-midnight">
                  <input className="mt-1 size-4 shrink-0 accent-sage-700" defaultChecked={ad?.show_sponsor_on_banner ?? true} name="show_sponsor_on_banner" type="checkbox" />
                  Vis partnernavn på banner
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Periode og prioritet</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Startdato
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={dateInputValue(ad?.starts_at ?? null)} name="starts_at" type="date" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Slutdato
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={dateInputValue(ad?.ends_at ?? null)} name="ends_at" type="date" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Prioritet
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.priority ?? 100} name="priority" type="number" />
              </label>
            </div>
            <div className="mt-4 rounded-md bg-[#FAF6EF] p-3 text-sm text-ink/70">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden="true" />
                Vises fra {formatDate(ad?.starts_at ?? null)} til {formatDate(ad?.ends_at ?? null)}
              </span>
            </div>
          </section>

          <section className="rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Placering</p>
            <div className="mt-5 grid gap-3 rounded-md bg-[#FAF6EF] p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-midnight"><input className="size-4 accent-sage-700" defaultChecked={ad?.is_active ?? true} name="is_active" type="checkbox" /> Aktiv</label>
              <label className="flex items-center gap-2 text-sm font-semibold text-midnight"><input className="size-4 accent-sage-700" defaultChecked={ad?.show_on_homepage ?? false} name="show_on_homepage" type="checkbox" /> Vis på forsiden</label>
              <label className="grid gap-2 text-sm font-semibold text-midnight">
                Forsideplacering
                <select className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base font-semibold outline-none transition focus:border-sage-700" defaultValue={ad?.homepage_placement ?? "bottom"} name="homepage_placement">
                  <option value="middle">Midten</option>
                  <option value="bottom">Nederst</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-midnight"><input className="size-4 accent-sage-700" defaultChecked={ad?.show_on_category_pages ?? false} name="show_on_category_pages" type="checkbox" /> Vis på hovedkategorisider</label>
              <label className="flex items-center gap-2 text-sm font-semibold text-midnight"><input className="size-4 accent-sage-700" defaultChecked={ad?.show_in_newsletter ?? false} name="show_in_newsletter" type="checkbox" /> Vis i nyhedsbrev/påmindelser</label>
            </div>
          </section>

          <section className="rounded-card border border-midnight/10 bg-white p-5 shadow-soft" data-ad-categories-section hidden={!ad?.show_on_category_pages}>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Hovedkategorier</p>
            <p className="mt-2 text-sm leading-6 text-ink/60">Vælg hvilke hovedkategorisider reklamen må vises på.</p>
            <fieldset className="mt-4 grid gap-2 rounded-md border border-midnight/10 p-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {mainCategories.map((category) => (
                  <label className="flex items-center gap-2 rounded-md bg-[#FAF6EF] px-3 py-2 text-sm font-semibold text-ink/76" key={category.id}>
                    <input className="size-4 accent-[#7A4EAB]" defaultChecked={Boolean(ad && selectedCategoryIds.has(category.id))} name="main_category_ids" type="checkbox" value={category.id} />
                    {category.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <details className="rounded-card border border-midnight/10 bg-white shadow-soft">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold uppercase tracking-wide text-sage-700 marker:hidden">
              Intern note
            </summary>
            <div className="border-t border-midnight/10 p-5">
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Intern note til admin
                <textarea className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.admin_note ?? ""} maxLength={1000} name="admin_note" />
              </label>
            </div>
          </details>
        </div>
      </form>

      <div className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-midnight/10 bg-white/95 px-5 py-4 shadow-soft backdrop-blur sm:flex-row sm:items-center sm:justify-end sm:px-6">
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-midnight/15 bg-white px-4 text-sm font-semibold text-ink/70 transition hover:border-sage-700 hover:text-sage-700" form={formId} type="reset">
          <RotateCcw className="size-4" aria-hidden="true" />
          Fortryd ændringer
        </button>
        {ad && (
          <form action={deleteAdAction}>
            <input name="id" type="hidden" value={ad.id} />
            <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-terracotta/30 bg-white px-4 text-sm font-semibold text-terracotta transition hover:bg-terracotta hover:text-white sm:w-auto" type="submit">
              <Trash2 className="size-4" aria-hidden="true" />
              Slet reklame
            </button>
          </form>
        )}
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-midnight px-5 text-sm font-semibold text-white transition hover:bg-sage-700" form={formId} type="submit">
          <Save className="size-4" aria-hidden="true" />
          Gem reklame
        </button>
      </div>
    </details>
  );
}

export default async function AdminAdsPage({ searchParams }: AdminAdsPageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = createAdminClient();
  let mainCategories: MainCategory[] = [];
  let ads: Ad[] = [];
  let loadError = "";

  try {
    const [mainCategoriesResult, adsResult] = await Promise.all([
      supabase.from("main_categories").select("id, name").eq("is_active", true).order("sort_order"),
      supabase.from("ads").select("*, ad_main_categories(main_category_id)").order("priority", { ascending: true }).order("created_at", { ascending: false }),
    ]);

    mainCategories = (mainCategoriesResult.data ?? []) as MainCategory[];
    ads = (adsResult.data ?? []) as Ad[];
    loadError = mainCategoriesResult.error?.message || adsResult.error?.message || "";
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Reklamer kunne ikke hentes.";
  }

  const adsWithImages = ads
    .map((ad) => ({ ...ad, image_url: publicMediaUrl(ad.image_path), mobile_image_url: publicMediaUrl(ad.mobile_image_path) }))
    .sort((a, b) => {
      const activeDifference = Number(isCurrentlyActiveAd(b)) - Number(isCurrentlyActiveAd(a));
      if (activeDifference !== 0) return activeDifference;
      return (a.priority ?? 100) - (b.priority ?? 100);
    });
  const activeCount = adsWithImages.filter(isCurrentlyActiveAd).length;
  const newsletterCount = adsWithImages.filter((ad) => ad.show_in_newsletter).length;
  const totalClicks = adsWithImages.reduce((sum, ad) => sum + (ad.clicks_count ?? 0), 0);

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white"><Megaphone className="size-5" aria-hidden="true" /></div><div><p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p><h1 className="text-xl font-semibold text-midnight">Reklamer / Partnerindhold</h1></div></div><Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta" href="/admin"><ArrowLeft className="size-4" aria-hidden="true" />Tilbage</Link></div></header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />
        {loadError && <AuthMessage message={"Reklamer kunne ikke hentes: " + loadError} />}
        <section className="rounded-card border border-midnight/10 bg-white p-5 shadow-soft sm:p-6"><div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Partnerindhold</p><h2 className="mt-2 text-2xl font-semibold text-midnight">Diskrete reklamer på forsiden og hovedkategorisider</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-ink/68">Brug denne side til samarbejdspartnere, webshops, festivaler, koncerter eller relevante kampagner. Reklamer vises roligt som karusel og på forsiden og/eller de hovedkategorier, du vælger.</p></div><div className="grid grid-cols-4 gap-2 text-center text-sm"><div className="rounded-md bg-[#FAF6EF] px-4 py-3"><p className="text-2xl font-semibold text-midnight">{adsWithImages.length}</p><p className="text-xs text-ink/60">I alt</p></div><div className="rounded-md bg-sage-50 px-4 py-3"><p className="text-2xl font-semibold text-sage-700">{activeCount}</p><p className="text-xs text-ink/60">Aktive</p></div><div className="rounded-md bg-[#EDE4F7] px-4 py-3"><p className="text-2xl font-semibold text-[#7A4EAB]">{newsletterCount}</p><p className="text-xs text-ink/60">Mail</p></div><div className="rounded-md bg-white px-4 py-3"><p className="text-2xl font-semibold text-midnight">{totalClicks}</p><p className="text-xs text-ink/60">Klik</p></div></div></div></section>

        <AdForm mainCategories={mainCategories} title="Opret ny reklame" />
        <div className="grid gap-5">{adsWithImages.map((ad) => <AdForm ad={ad} mainCategories={mainCategories} title={ad.title} key={ad.id} />)}</div>
      </section>
    </main>
  );
}
