import Link from "next/link";
import { ArrowLeft, CalendarDays, Megaphone, RotateCcw, Save, Trash2 } from "lucide-react";
import { deleteAdAction, upsertAdAction } from "@/app/admin/ads/actions";
import { AdDirectUploadController } from "@/components/admin/ads/ad-direct-upload-controller";
import { AdFormCategoryGuard } from "@/components/admin/ads/ad-form-category-guard";
import { AdPreviewTabs } from "@/components/admin/ads/ad-preview-tabs";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { publicMediaUrl } from "@/lib/media/public-url";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminAdsPageProps = {
  searchParams: Promise<{ message?: string; sort?: string; status?: string }>;
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

type CampaignStatus = "active" | "deactivated" | "expired" | "expiring_soon" | "planned";
type CampaignStatusFilter = "all" | CampaignStatus;
type CampaignSort = "expires_asc" | "expires_desc" | "priority" | "starts_asc" | "status";

const dayMs = 24 * 60 * 60 * 1000;

const campaignStatusLabels: Record<CampaignStatus, string> = {
  active: "Aktiv",
  deactivated: "Deaktiveret",
  expired: "Udløbet",
  expiring_soon: "Udløber snart",
  planned: "Planlagt",
};

const campaignStatusClasses: Record<CampaignStatus, string> = {
  active: "bg-[#DDEED6] text-[#275B2D] ring-[#4F7A45]/35",
  deactivated: "bg-[#2F2A32]/10 text-[#3A333D] ring-[#2F2A32]/20",
  expired: "bg-stone-100 text-stone-600 ring-stone-300",
  expiring_soon: "bg-[#FFE2BD] text-[#7A3F11] ring-[#D06B1E]/35",
  planned: "bg-[#EDE4F7] text-[#6D4D86] ring-[#8B6FAA]/30",
};

const campaignStatusFilters: Array<{ label: string; value: CampaignStatusFilter }> = [
  { label: "Alle", value: "all" },
  { label: "Aktive", value: "active" },
  { label: "Planlagte", value: "planned" },
  { label: "Udløber snart", value: "expiring_soon" },
  { label: "Udløbne", value: "expired" },
  { label: "Deaktiverede", value: "deactivated" },
];

const campaignSortOptions: Array<{ label: string; value: CampaignSort }> = [
  { label: "Nærmeste udløbsdato", value: "expires_asc" },
  { label: "Seneste udløbsdato", value: "expires_desc" },
  { label: "Startdato", value: "starts_asc" },
  { label: "Status", value: "status" },
  { label: "Prioritet", value: "priority" },
];

function dateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return "Ingen dato";
  return new Intl.DateTimeFormat("da-DK", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function normalizeCampaignStatusFilter(value?: string): CampaignStatusFilter {
  return campaignStatusFilters.some((item) => item.value === value) ? (value as CampaignStatusFilter) : "all";
}

function normalizeCampaignSort(value?: string): CampaignSort {
  return campaignSortOptions.some((item) => item.value === value) ? (value as CampaignSort) : "priority";
}

function startOfDate(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysUntil(value: string | null, now: Date) {
  if (!value) return null;
  return Math.ceil((startOfDate(new Date(value)).getTime() - startOfDate(now).getTime()) / dayMs);
}

function inclusiveCampaignDays(startsAt: string | null, endsAt: string | null) {
  if (!startsAt || !endsAt) return null;
  const start = startOfDate(new Date(startsAt)).getTime();
  const end = startOfDate(new Date(endsAt)).getTime();
  if (end < start) return null;
  return Math.floor((end - start) / dayMs) + 1;
}

function campaignStatus(ad: Ad, now = new Date()): { className: string; label: string; value: CampaignStatus } {
  if (!ad.is_active) return { label: campaignStatusLabels.deactivated, className: campaignStatusClasses.deactivated, value: "deactivated" };
  if (ad.starts_at && new Date(ad.starts_at) > now) return { label: campaignStatusLabels.planned, className: campaignStatusClasses.planned, value: "planned" };
  const remainingDays = daysUntil(ad.ends_at, now);
  if (remainingDays !== null && remainingDays < 0) return { label: campaignStatusLabels.expired, className: campaignStatusClasses.expired, value: "expired" };
  if (remainingDays !== null && remainingDays <= 14) return { label: campaignStatusLabels.expiring_soon, className: campaignStatusClasses.expiring_soon, value: "expiring_soon" };
  return { label: campaignStatusLabels.active, className: campaignStatusClasses.active, value: "active" };
}

function campaignPeriodText(ad: Ad) {
  const startText = ad.starts_at ? formatDate(ad.starts_at) : "Starter straks";
  const endText = ad.ends_at ? formatDate(ad.ends_at) : "Ingen udløbsdato";
  return startText + " – " + endText;
}

function campaignTimingText(ad: Ad, now = new Date()) {
  const remainingDays = daysUntil(ad.ends_at, now);
  if (remainingDays === null) return "Ingen udløbsdato";
  if (remainingDays < 0) return "Udløbet";
  if (remainingDays === 0) return "Udløber i dag";
  if (remainingDays <= 30) return "Udløber om " + remainingDays + " dage";
  return remainingDays + " dage tilbage";
}

function campaignDurationText(ad: Ad) {
  const duration = inclusiveCampaignDays(ad.starts_at, ad.ends_at);
  if (!duration) return "Varighed mangler";
  return "Varighed: " + duration + " " + (duration === 1 ? "dag" : "dage");
}

function adPlacements(ad: Ad, categoryNamesById: Map<string, string>) {
  const placements: string[] = [];

  if (ad.show_on_homepage) {
    placements.push("Forside · " + (ad.homepage_placement === "middle" ? "Midten" : "Nederst"));
  }

  if (ad.show_on_category_pages) {
    const categoryNames = (ad.ad_main_categories ?? [])
      .map((row) => categoryNamesById.get(row.main_category_id))
      .filter(Boolean) as string[];

    if (categoryNames.length > 0) {
      categoryNames.forEach((name) => placements.push("Kategori · " + name));
    } else {
      placements.push("Kategorier");
    }
  }

  if (ad.show_in_newsletter) {
    placements.push("Nyhedsbrev");
  }

  return placements.length > 0 ? placements : ["Ingen offentlig placering"];
}

function expectedAvailability(ads: Ad[], categoryNamesById: Map<string, string>, now: Date) {
  const placementMap = new Map<string, { count: number; nextEndsAt: string | null }>();

  for (const ad of ads) {
    const status = campaignStatus(ad, now).value;
    if (!["active", "expiring_soon", "planned"].includes(status)) continue;

    for (const placement of adPlacements(ad, categoryNamesById)) {
      if (placement === "Ingen offentlig placering") continue;
      const current = placementMap.get(placement) ?? { count: 0, nextEndsAt: null };
      current.count += 1;
      if (ad.ends_at && (!current.nextEndsAt || new Date(ad.ends_at) < new Date(current.nextEndsAt))) {
        current.nextEndsAt = ad.ends_at;
      }
      placementMap.set(placement, current);
    }
  }

  return Array.from(placementMap.entries())
    .map(([placement, value]) => ({ placement, ...value }))
    .sort((a, b) => a.placement.localeCompare(b.placement, "da"));
}

function isCurrentlyActiveAd(ad: Ad) {
  const status = campaignStatus(ad).value;
  return status === "active" || status === "expiring_soon";
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
            {status && <span className={"inline-flex h-8 items-center rounded-full px-3 text-xs font-bold uppercase tracking-wide shadow-soft ring-1 " + status.className}>Status: {status.label}</span>}
            {ad && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60 shadow-soft">{campaignPeriodText(ad)}</span>}
            {ad && <span className={campaignStatus(ad).value === "expiring_soon" ? "rounded-full bg-[#FFE2BD] px-3 py-1 text-xs font-bold text-[#7A3F11] shadow-soft" : "rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60 shadow-soft"}>{campaignTimingText(ad)}</span>}
            {ad && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60 shadow-soft">{campaignDurationText(ad)}</span>}
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
        <input name="current_image_path" type="hidden" value={ad?.image_path ?? ""} />
        <input name="current_mobile_image_path" type="hidden" value={ad?.mobile_image_path ?? ""} />
        <input name="image_path" type="hidden" value={ad?.image_path ?? ""} />
        <input name="mobile_image_path" type="hidden" value={ad?.mobile_image_path ?? ""} />
        <input name="uploaded_image_path" type="hidden" />
        <input name="uploaded_mobile_image_path" type="hidden" />
        <AdFormCategoryGuard formId={formId} />
        <AdDirectUploadController formId={formId} />

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
                  <input accept="image/png,image/jpeg,image/webp,video/mp4" className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sage-700" data-ad-file-input="desktop" type="file" />
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
                  <input accept="image/png,image/jpeg,image/webp,video/mp4" className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sage-700" data-ad-file-input="mobile" type="file" />
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
  const [{ message, sort, status }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = createAdminClient();
  const selectedStatus = normalizeCampaignStatusFilter(status);
  const selectedSort = normalizeCampaignSort(sort);
  const now = new Date();
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

  const categoryNamesById = new Map(mainCategories.map((category) => [category.id, category.name]));
  const allAdsWithImages = ads
    .map((ad) => ({ ...ad, image_url: publicMediaUrl(ad.image_path), mobile_image_url: publicMediaUrl(ad.mobile_image_path) }))
    .sort((a, b) => {
      const activeDifference = Number(isCurrentlyActiveAd(b)) - Number(isCurrentlyActiveAd(a));
      if (activeDifference !== 0) return activeDifference;
      return (a.priority ?? 100) - (b.priority ?? 100);
    });
  const adsWithImages = allAdsWithImages
    .filter((ad) => selectedStatus === "all" || campaignStatus(ad, now).value === selectedStatus)
    .sort((a, b) => {
      if (selectedSort === "expires_asc") return new Date(a.ends_at ?? "9999-12-31").getTime() - new Date(b.ends_at ?? "9999-12-31").getTime();
      if (selectedSort === "expires_desc") return new Date(b.ends_at ?? "0001-01-01").getTime() - new Date(a.ends_at ?? "0001-01-01").getTime();
      if (selectedSort === "starts_asc") return new Date(a.starts_at ?? "0001-01-01").getTime() - new Date(b.starts_at ?? "0001-01-01").getTime();
      if (selectedSort === "status") return campaignStatusLabels[campaignStatus(a, now).value].localeCompare(campaignStatusLabels[campaignStatus(b, now).value], "da");
      return (a.priority ?? 100) - (b.priority ?? 100);
    });
  const activeCount = allAdsWithImages.filter((ad) => campaignStatus(ad, now).value === "active" || campaignStatus(ad, now).value === "expiring_soon").length;
  const plannedCount = allAdsWithImages.filter((ad) => campaignStatus(ad, now).value === "planned").length;
  const expiringWithinThirtyCount = allAdsWithImages.filter((ad) => {
    const remainingDays = daysUntil(ad.ends_at, now);
    const statusValue = campaignStatus(ad, now).value;
    return ["active", "expiring_soon", "planned"].includes(statusValue) && remainingDays !== null && remainingDays >= 0 && remainingDays <= 30;
  }).length;
  const expiredCount = allAdsWithImages.filter((ad) => campaignStatus(ad, now).value === "expired").length;
  const totalClicks = allAdsWithImages.reduce((sum, ad) => sum + (ad.clicks_count ?? 0), 0);
  const availability = expectedAvailability(allAdsWithImages, categoryNamesById, now);

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white"><Megaphone className="size-5" aria-hidden="true" /></div><div><p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p><h1 className="text-xl font-semibold text-midnight">Reklamer / Partnerindhold</h1></div></div><Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta" href="/admin"><ArrowLeft className="size-4" aria-hidden="true" />Tilbage</Link></div></header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />
        {loadError && <AuthMessage message={"Reklamer kunne ikke hentes: " + loadError} />}
        <section className="rounded-card border border-midnight/10 bg-white p-5 shadow-soft sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Partnerindhold</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">Diskrete reklamer på forsiden og hovedkategorisider</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/68">
                Brug denne side til samarbejdspartnere, webshops, festivaler, koncerter eller relevante kampagner. Reklamer vises roligt som karusel og på forsiden og/eller de hovedkategorier, du vælger.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-5">
              <div className="rounded-md bg-sage-50 px-4 py-3">
                <p className="text-2xl font-semibold text-sage-700">{activeCount}</p>
                <p className="text-xs text-ink/60">Aktive</p>
              </div>
              <div className="rounded-md bg-[#EDE4F7] px-4 py-3">
                <p className="text-2xl font-semibold text-[#7A4EAB]">{plannedCount}</p>
                <p className="text-xs text-ink/60">Planlagte</p>
              </div>
              <div className="rounded-md bg-[#FFF1DB] px-4 py-3">
                <p className="text-2xl font-semibold text-[#7A3F11]">{expiringWithinThirtyCount}</p>
                <p className="text-xs text-ink/60">Udløber 30 dage</p>
              </div>
              <div className="rounded-md bg-stone-100 px-4 py-3">
                <p className="text-2xl font-semibold text-stone-600">{expiredCount}</p>
                <p className="text-xs text-ink/60">Udløbne</p>
              </div>
              <div className="rounded-md bg-white px-4 py-3">
                <p className="text-2xl font-semibold text-midnight">{totalClicks}</p>
                <p className="text-xs text-ink/60">Klik</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Næste forventede ledighed</p>
            <p className="mt-2 text-sm leading-6 text-ink/64">
              Der findes ikke en fast kapacitetsregel pr. annonceplacering i systemet endnu. Derfor vises aktive og planlagte reklamer pr. placering samt nærmeste kendte udløbsdato.
            </p>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {availability.length > 0 ? (
                availability.slice(0, 6).map((item) => (
                  <div className="rounded-[18px] border border-midnight/10 bg-[#FAF6EF] p-3 text-sm" key={item.placement}>
                    <p className="font-semibold text-midnight">{item.placement}</p>
                    <p className="mt-1 text-ink/64">
                      {item.count} {item.count === 1 ? "reklame" : "reklamer"} optager placeringen
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#7A4EAB]">
                      {item.nextEndsAt ? "Næste forventede ledighed: " + formatDate(item.nextEndsAt) : "Ingen kendt udløbsdato"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-midnight/10 bg-[#FAF6EF] p-3 text-sm text-ink/64">Ingen aktive eller planlagte placeringer lige nu.</div>
              )}
            </div>
          </div>
          <form action="/admin/ads" className="grid gap-3 rounded-[18px] border border-midnight/10 bg-[#fbfaf7] p-4 sm:grid-cols-2 lg:min-w-[360px] lg:grid-cols-1">
            <label className="grid gap-2 text-sm font-semibold text-midnight">
              Status
              <select className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-sm outline-none transition focus:border-sage-700" defaultValue={selectedStatus} name="status">
                {campaignStatusFilters.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-midnight">
              Sortering
              <select className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-sm outline-none transition focus:border-sage-700" defaultValue={selectedSort} name="sort">
                {campaignSortOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="h-11 rounded-md bg-midnight px-4 text-sm font-semibold text-white sm:col-span-2 lg:col-span-1" type="submit">
              Anvend
            </button>
          </form>
        </section>

        <AdForm mainCategories={mainCategories} title="Opret ny reklame" />
        <div className="grid gap-5">
          {adsWithImages.length === 0 ? (
            <div className="rounded-card border border-midnight/10 bg-white p-6 text-sm text-ink/64 shadow-soft">Ingen reklamer matcher det valgte filter.</div>
          ) : null}
          {adsWithImages.map((ad) => <AdForm ad={ad} mainCategories={mainCategories} title={ad.title} key={ad.id} />)}
        </div>
      </section>
    </main>
  );
}
