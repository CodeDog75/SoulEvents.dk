import Link from "next/link";
import { ArrowLeft, CalendarDays, Megaphone, Save, Trash2 } from "lucide-react";
import { deleteAdAction, upsertAdAction } from "@/app/admin/ads/actions";
import { AdFormCategoryGuard } from "@/components/admin/ads/ad-form-category-guard";
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

function isVideoMedia(path: string | null) {
  return Boolean(path && /\.mp4($|[?#])/i.test(path));
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

function AdPreview({ ad }: { ad?: Ad }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-midnight/10 bg-[#F6F1E7] shadow-soft">
      {ad?.image_url && isVideoMedia(ad.image_path) ? (
        <video autoPlay className="aspect-[16/6] w-full object-cover" loop muted playsInline src={ad.image_url} />
      ) : ad?.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={ad.alt_text || ad.title} className="aspect-[16/6] w-full object-cover" src={ad.image_url} />
      ) : (
        <div className="grid aspect-[16/6] place-items-center bg-gradient-to-br from-[#2F2633] via-[#7A4EAB] to-[#D8A7B1] px-6 text-center text-sm font-semibold text-white">
          Upload billede eller MP4
        </div>
      )}
    </div>
  );
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
            {ad && <p className="mt-1 text-sm text-ink/60">Reference-ID bruges på faktura: <span className="font-semibold text-[#7A4EAB]">{ad.ad_reference_id || "afventer"}</span></p>}
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
        <AdFormCategoryGuard formId={formId} />

        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <aside className="grid content-start gap-4">
            <AdPreview ad={ad} />
            <section className="rounded-md border border-midnight/10 bg-[#FAF6EF] p-4">
              <h3 className="text-sm font-semibold text-midnight">Medie</h3>
              <label className="mt-3 grid gap-2 text-sm font-semibold text-ink/72">
                Vælg reklamebillede
                <input accept="image/png,image/jpeg,image/webp,video/mp4" className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sage-700" name="image_file" type="file" />
              </label>
              <p className="mt-2 text-xs leading-5 text-ink/55">Anbefalet banner: 1600 x 500 px. Brug helst WebP, ellers JPG eller PNG under 1-2 MB. MP4 kan bruges som kort video uden lyd, helst 5-10 sekunder og under 8-12 MB, maksimum 30 MB.</p>
              {ad?.image_path && (
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
                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm font-medium text-ink/72">Titel/navn<input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.title ?? ""} name="title" required maxLength={80} /></label>
                  <label className="flex items-start gap-2 rounded-md bg-[#FAF6EF] p-3 text-sm font-semibold text-midnight">
                    <input className="mt-1 size-4 shrink-0 accent-sage-700" defaultChecked={ad?.show_title_on_banner ?? true} name="show_title_on_banner" type="checkbox" />
                    <span>
                      Vis titel oven på banner
                      <span className="block pt-1 text-xs font-medium leading-5 text-ink/55">
                        Fjern markeringen, hvis billedet eller videoen allerede indeholder teksten.
                      </span>
                    </span>
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-medium text-ink/72">Sponsor / partnernavn<input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.sponsor_name ?? ""} name="sponsor_name" maxLength={80} /></label>
                <label className="grid gap-2 text-sm font-medium text-ink/72 md:col-span-2">Link ved klik (valgfrit)<input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.target_url ?? ""} name="target_url" placeholder="https://... eller /artikler/..." maxLength={300} /><span className="text-xs leading-5 text-ink/55">Hvis feltet er tomt, vises reklamen uden klik-link.</span></label>
                <label className="grid gap-2 text-sm font-medium text-ink/72 md:col-span-2">Alt-tekst til billede<input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.alt_text ?? ""} name="alt_text" placeholder="Kort beskrivelse af billedet" maxLength={160} /></label>
              </div>
            </section>

            <section className="rounded-md border border-midnight/10 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-sage-700">Visning</h3><p className="mt-2 text-sm leading-6 text-ink/60">Hvis flere reklamer vises samme sted, skifter de automatisk i et roligt tempo. Står én reklame alene, vises den statisk.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-ink/72">Prioritet<input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.priority ?? 100} name="priority" type="number" /></label>
                <label className="grid gap-2 text-sm font-medium text-ink/72">Startdato<input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={dateInputValue(ad?.starts_at ?? null)} name="starts_at" type="date" /></label>
                <label className="grid gap-2 text-sm font-medium text-ink/72">Slutdato<input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={dateInputValue(ad?.ends_at ?? null)} name="ends_at" type="date" /></label>
              </div>
              {ad && <div className="mt-4 grid gap-2 rounded-md bg-[#FAF6EF] p-3 text-sm text-ink/70 sm:grid-cols-2"><span className="inline-flex items-center gap-2"><CalendarDays className="size-4" aria-hidden="true" /> Start: {formatDate(ad.starts_at)}</span><span className="inline-flex items-center gap-2"><CalendarDays className="size-4" aria-hidden="true" /> Slut: {formatDate(ad.ends_at)}</span></div>}
            </section>

            <section className="rounded-md border border-midnight/10 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-sage-700">Placering</h3>
              <div className="mt-4 grid gap-3 rounded-md bg-[#FAF6EF] p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-midnight"><input className="size-4 accent-sage-700" defaultChecked={ad?.is_active ?? true} name="is_active" type="checkbox" /> Reklamen er aktiv</label>
                <label className="flex items-center gap-2 text-sm font-semibold text-midnight"><input className="size-4 accent-sage-700" defaultChecked={ad?.show_on_homepage ?? false} name="show_on_homepage" type="checkbox" /> Vis på forsiden</label>
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Forsideplacering
                  <select
                    className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base font-semibold outline-none transition focus:border-sage-700"
                    defaultValue={ad?.homepage_placement ?? "bottom"}
                    name="homepage_placement"
                  >
                    <option value="middle">Midten - mellem Nye events og Sauna & Velvære</option>
                    <option value="bottom">Nederst - almindeligt banner</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-midnight"><input className="size-4 accent-sage-700" defaultChecked={ad?.show_on_category_pages ?? false} name="show_on_category_pages" type="checkbox" /> Vis også på hovedkategorisider</label>
                <label className="flex items-center gap-2 text-sm font-semibold text-midnight"><input className="size-4 accent-sage-700" defaultChecked={ad?.show_in_newsletter ?? false} name="show_in_newsletter" type="checkbox" /> Reklame i nyhedsbrev/påmindelsesmails</label>
                <label className="flex items-center gap-2 text-sm font-semibold text-midnight"><input className="size-4 accent-sage-700" defaultChecked={ad?.show_sponsor_on_banner ?? true} name="show_sponsor_on_banner" type="checkbox" /> Vis partnernavn på banner</label>
              </div>

              <fieldset className="mt-4 grid gap-2 rounded-md border border-midnight/10 p-4">
                <legend className="px-1 text-sm font-semibold text-midnight">Hovedkategorier hvor reklamen må vises, hvis hovedkategorisider er valgt</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {mainCategories.map((category) => <label className="flex items-center gap-2 rounded-md bg-[#FAF6EF] px-3 py-2 text-sm font-semibold text-ink/76" key={category.id}><input className="size-4 accent-[#7A4EAB]" defaultChecked={Boolean(ad && selectedCategoryIds.has(category.id))} name="main_category_ids" type="checkbox" value={category.id} />{category.name}</label>)}
                </div>
              </fieldset>
            </section>

            <section className="rounded-md border border-midnight/10 p-4">
              <label className="grid gap-2 text-sm font-medium text-ink/72">Intern note til admin<textarea className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.admin_note ?? ""} name="admin_note" maxLength={1000} /></label>
            </section>

            <button className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700" type="submit"><Save className="size-4" aria-hidden="true" />Gem reklame</button>
          </div>
        </div>
      </form>

      {ad && <form action={deleteAdAction} className="border-t border-midnight/10 bg-white px-5 py-4 sm:px-6"><input name="id" type="hidden" value={ad.id} /><button className="inline-flex h-9 items-center gap-2 rounded-md border border-terracotta/30 bg-white px-3 text-sm font-semibold text-terracotta transition hover:bg-terracotta hover:text-white" type="submit"><Trash2 className="size-4" aria-hidden="true" />Slet reklame</button></form>}
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
    .map((ad) => ({ ...ad, image_url: publicMediaUrl(ad.image_path) }))
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
