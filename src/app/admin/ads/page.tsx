import Link from "next/link";
import { ArrowLeft, Megaphone, Save, Trash2 } from "lucide-react";
import { deleteAdAction, upsertAdAction } from "@/app/admin/ads/actions";
import { HomepageImageUploadPreview } from "@/components/admin/homepage-image-upload-preview";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminAdsPageProps = {
  searchParams: Promise<{ message?: string }>;
};

type MainCategory = {
  id: string;
  name: string;
};

type Ad = {
  id: string;
  title: string;
  image_path: string | null;
  image_url?: string | null;
  alt_text: string | null;
  sponsor_name: string | null;
  target_url: string | null;
  priority: number;
  display_seconds: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  show_on_category_pages: boolean;
  show_in_newsletter: boolean;
  admin_note: string | null;
  ad_main_categories?: Array<{ main_category_id: string }>;
};

function dateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function campaignStatus(ad: Ad) {
  if (!ad.is_active) return "Deaktiveret";
  const now = new Date();
  if (ad.starts_at && new Date(ad.starts_at) > now) return "Planlagt";
  if (ad.ends_at && new Date(ad.ends_at) < now) return "Udløbet";
  return "Aktiv";
}

function AdForm({ ad, mainCategories, title }: { ad?: Ad; mainCategories: MainCategory[]; title: string }) {
  const selectedCategoryIds = new Set((ad?.ad_main_categories ?? []).map((row) => row.main_category_id));
  return (
    <form action={upsertAdAction} className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <input name="id" type="hidden" value={ad?.id ?? ""} />
      <input name="image_path" type="hidden" value={ad?.image_path ?? ""} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-midnight">{title}</h2>
          {ad && <p className="mt-1 text-sm font-semibold text-sage-700">Status: {campaignStatus(ad)}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink/72">
          <input className="size-4 accent-sage-700" defaultChecked={ad?.is_active ?? true} name="is_active" type="checkbox" />
          Aktiv
        </label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[240px_1fr]">
        <div className="grid content-start gap-3">
          <HomepageImageUploadPreview imagePath={ad?.image_path ?? null} imageUrl={ad?.image_url ?? null} />
          <label className="grid gap-2 text-sm font-semibold text-ink/72">
            Upload reklamebillede
            <input accept="image/png,image/jpeg,image/webp" className="rounded-md border border-midnight/15 bg-white px-3 py-2 text-sm" name="image_file" type="file" />
          </label>
          <p className="text-xs leading-5 text-ink/55">Anbefalet: bredt billede, fx 1600 x 500 px. JPG, PNG eller WebP under 8 MB.</p>
          {ad?.image_path && (
            <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
              <input className="size-4 accent-terracotta" name="remove_image" type="checkbox" />
              Fjern nuværende billede
            </label>
          )}
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Titel/navn
              <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.title ?? ""} name="title" required />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Sponsor / partnernavn
              <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.sponsor_name ?? ""} name="sponsor_name" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Link ved klik
              <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.target_url ?? ""} name="target_url" placeholder="https://... eller /artikler/..." />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Alt-tekst til billede
              <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.alt_text ?? ""} name="alt_text" placeholder="Kort beskrivelse af billedet" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Prioritet
              <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.priority ?? 100} name="priority" type="number" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Visningstid i sekunder
              <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.display_seconds ?? 10} max={30} min={6} name="display_seconds" type="number" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Startdato
              <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={dateInputValue(ad?.starts_at ?? null)} name="starts_at" type="date" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Slutdato
              <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700" defaultValue={dateInputValue(ad?.ends_at ?? null)} name="ends_at" type="date" />
            </label>
          </div>

          <div className="grid gap-3 rounded-md bg-[#FAF6EF] p-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-midnight">
              <input className="size-4 accent-sage-700" defaultChecked={ad?.show_on_category_pages ?? true} name="show_on_category_pages" type="checkbox" />
              Vis på hovedkategorisider
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-midnight">
              <input className="size-4 accent-sage-700" defaultChecked={ad?.show_in_newsletter ?? false} name="show_in_newsletter" type="checkbox" />
              Reklame i nyhedsbrev/påmindelsesmails
            </label>
          </div>

          <fieldset className="grid gap-2 rounded-md border border-midnight/10 p-4">
            <legend className="px-1 text-sm font-semibold text-midnight">Hovedkategorier hvor reklamen må vises</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {mainCategories.map((category) => (
                <label className="flex items-center gap-2 rounded-md bg-[#FAF6EF] px-3 py-2 text-sm font-semibold text-ink/76" key={category.id}>
                  <input className="size-4 accent-[#7A4EAB]" defaultChecked={selectedCategoryIds.has(category.id)} name="main_category_ids" type="checkbox" value={category.id} />
                  {category.name}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Intern note til admin
            <textarea className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700" defaultValue={ad?.admin_note ?? ""} name="admin_note" />
          </label>

          <button className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700" type="submit">
            <Save className="size-4" aria-hidden="true" />
            Gem reklame
          </button>
        </div>
      </div>
    </form>
  );
}

export default async function AdminAdsPage({ searchParams }: AdminAdsPageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = createAdminClient();
  const [{ data: mainCategories }, { data: ads }] = await Promise.all([
    supabase.from("main_categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("ads").select("*, ad_main_categories(main_category_id)").order("priority", { ascending: true }).order("created_at", { ascending: false }),
  ]);

  const adsWithImages = (ads ?? []).map((ad: any) => ({
    ...ad,
    image_url: ad.image_path ? supabase.storage.from("media").getPublicUrl(ad.image_path).data.publicUrl : null,
  }));

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <Megaphone className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Reklamer / Partnerindhold</h1>
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
        <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Partnerindhold</p>
          <h2 className="mt-2 text-2xl font-semibold text-midnight">Diskrete reklamer på hovedkategorisider</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/68">
            Brug denne side til samarbejdspartnere, webshops, festivaler, koncerter eller relevante kampagner. Reklamer vises roligt som karusel og kun på de hovedkategorier, du vælger.
          </p>
        </section>

        <AdForm mainCategories={(mainCategories ?? []) as MainCategory[]} title="Opret ny reklame" />

        <div className="grid gap-5">
          {adsWithImages.map((ad: any) => (
            <article className="grid gap-3" key={ad.id}>
              <AdForm ad={ad as Ad} mainCategories={(mainCategories ?? []) as MainCategory[]} title={"Rediger: " + ad.title} />
              <form action={deleteAdAction} className="-mt-4 px-5 pb-2">
                <input name="id" type="hidden" value={ad.id} />
                <button className="inline-flex h-9 items-center gap-2 rounded-md border border-terracotta/30 bg-white px-3 text-sm font-semibold text-terracotta transition hover:bg-terracotta hover:text-white" type="submit">
                  <Trash2 className="size-4" aria-hidden="true" />
                  Slet reklame
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
