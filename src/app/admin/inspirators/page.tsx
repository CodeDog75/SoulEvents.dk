import Link from "next/link";
import { ArrowLeft, ImagePlus, Save, Sparkles, Trash2 } from "lucide-react";
import { archiveInspiratorAction, deleteInspiratorImageAction, upsertInspiratorAction } from "@/app/admin/inspirators/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminInspiratorsPageProps = {
  searchParams: Promise<{ message?: string }>;
};

type InspiratorImage = {
  id: string;
  section: "mood" | "gallery";
  image_path: string;
  alt_text: string | null;
  sort_order: number;
};

type Inspirator = {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  short_intro: string | null;
  profile_image_path: string | null;
  hero_image_path: string | null;
  about_body: string | null;
  category: string | null;
  contact_email: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  webshop_url: string | null;
  is_active: boolean;
  sort_order: number;
  inspirator_images?: InspiratorImage[];
};

const categories = ["Musiker", "Kunstner", "Forfatter", "Håndværker", "Facilitator", "Underviser", "Retreatsted", "Podcast", "Naturformidler", "Andet"];

function publicMediaUrl(imagePath: string | null) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  const encodedPath = imagePath.split("/").map((part) => encodeURIComponent(part)).join("/");
  return supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/media/" + encodedPath;
}

function imagePreview(path: string | null, label: string) {
  const url = publicMediaUrl(path);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={label} className="h-36 w-full rounded-xl object-cover" src={url} />
  ) : (
    <div className="grid h-36 place-items-center rounded-xl bg-[#F4F0F7] text-sm font-semibold text-[#7A5D91]">Intet billede endnu</div>
  );
}

function ImageUpload({ name, label, currentPath }: { name: string; label: string; currentPath?: string | null }) {
  return (
    <div className="rounded-2xl border border-[#E5DDEA] bg-[#FAF6EF] p-4">
      {currentPath !== undefined && imagePreview(currentPath, label)}
      <label className="mt-3 grid gap-2 text-sm font-semibold text-[#2F2633]/75">
        {label}
        <input accept="image/png,image/jpeg,image/webp" className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#7A5D91]" name={name} type="file" />
      </label>
      {currentPath && (
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#6E6475]">
          <input className="size-4 accent-[#7A5D91]" name={"remove_" + name} type="checkbox" />
          Fjern nuværende billede
        </label>
      )}
      <p className="mt-2 text-xs leading-5 text-[#6E6475]">Brug JPG, PNG eller WebP under 8 MB.</p>
    </div>
  );
}

function TextInput({ label, name, defaultValue, required, placeholder, maxLength = 180 }: { label: string; name: string; defaultValue?: string | null; required?: boolean; placeholder?: string; maxLength?: number }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#2F2633]/75">
      {label}
      <input className="h-11 rounded-xl border border-[#D8CBE4] bg-white px-4 text-base outline-none transition focus:border-[#7A5D91]" defaultValue={defaultValue ?? ""} maxLength={maxLength} name={name} placeholder={placeholder} required={required} />
    </label>
  );
}

function InspiratorForm({ inspirator, title }: { inspirator?: Inspirator; title: string }) {
  const moodImages = (inspirator?.inspirator_images ?? []).filter((image) => image.section === "mood").sort((a, b) => a.sort_order - b.sort_order);
  const galleryImages = (inspirator?.inspirator_images ?? []).filter((image) => image.section === "gallery").sort((a, b) => a.sort_order - b.sort_order);

  return (
    <details className="overflow-hidden rounded-[1.5rem] border border-[#E5DDEA] bg-white shadow-soft">
      <summary className="cursor-pointer list-none bg-[#FAF6EF] px-5 py-4 marker:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A5D91]">{inspirator ? "Rediger inspirator" : "Ny inspirator"}</p>
            <h2 className="mt-1 text-xl font-semibold text-[#2F2633]">{title}</h2>
            {inspirator && <p className="mt-1 text-sm text-[#6E6475]">/inspiration/{inspirator.slug}</p>}
          </div>
          <span className={"rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide " + (inspirator?.is_active ?? true ? "bg-[#DDE8D7] text-[#4E6A45]" : "bg-[#F4E7C8] text-[#7A6235]")}>
            {inspirator?.is_active ?? true ? "Aktiv" : "Skjult"}
          </span>
        </div>
      </summary>

      <form action={upsertInspiratorAction} className="grid gap-6 p-5">
        <input name="id" type="hidden" value={inspirator?.id ?? ""} />
        <input name="profile_image_path" type="hidden" value={inspirator?.profile_image_path ?? ""} />
        <input name="hero_image_path" type="hidden" value={inspirator?.hero_image_path ?? ""} />

        <section className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="grid content-start gap-4">
            <ImageUpload currentPath={inspirator?.profile_image_path ?? null} label="Profilbillede" name="profile_image" />
            <ImageUpload currentPath={inspirator?.hero_image_path ?? null} label="Hero/stemningsbillede" name="hero_image" />
          </aside>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput defaultValue={inspirator?.name} label="Navn" name="name" required />
              <TextInput defaultValue={inspirator?.slug} label="Webadresse" name="slug" placeholder="fornavn-efternavn" />
              <TextInput defaultValue={inspirator?.title} label="Titel" name="title" placeholder="Fx Musiker, lydkunstner og facilitator" />
              <label className="grid gap-2 text-sm font-semibold text-[#2F2633]/75">
                Kategori
                <select className="h-11 rounded-xl border border-[#D8CBE4] bg-white px-4 text-base outline-none transition focus:border-[#7A5D91]" defaultValue={inspirator?.category ?? ""} name="category">
                  <option value="">Vælg kategori</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <TextInput defaultValue={inspirator?.contact_email} label="Kontakt e-mail" maxLength={180} name="contact_email" placeholder="mail@eksempel.dk" />
              <TextInput defaultValue={String(inspirator?.sort_order ?? 100)} label="Sortering" maxLength={6} name="sort_order" />
            </div>

            <label className="grid gap-2 text-sm font-semibold text-[#2F2633]/75">
              Kort introduktion
              <textarea className="min-h-24 rounded-xl border border-[#D8CBE4] bg-white p-4 text-base outline-none transition focus:border-[#7A5D91]" defaultValue={inspirator?.short_intro ?? ""} maxLength={360} name="short_intro" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#2F2633]/75">
              Om personen
              <textarea className="min-h-64 rounded-xl border border-[#D8CBE4] bg-white p-4 text-base outline-none transition focus:border-[#7A5D91]" defaultValue={inspirator?.about_body ?? ""} name="about_body" placeholder="Rich text kan skrives som afsnit, overskrifter og links." />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <TextInput defaultValue={inspirator?.website_url} label="Hjemmeside" maxLength={300} name="website_url" />
              <TextInput defaultValue={inspirator?.instagram_url} label="Instagram" maxLength={300} name="instagram_url" />
              <TextInput defaultValue={inspirator?.facebook_url} label="Facebook" maxLength={300} name="facebook_url" />
              <TextInput defaultValue={inspirator?.youtube_url} label="YouTube" maxLength={300} name="youtube_url" />
              <TextInput defaultValue={inspirator?.spotify_url} label="Spotify" maxLength={300} name="spotify_url" />
              <TextInput defaultValue={inspirator?.webshop_url} label="Webshop" maxLength={300} name="webshop_url" />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-[#D8CBE4] bg-[#FAF6EF] p-4 text-sm font-semibold text-[#2F2633]">
              <input className="size-4 accent-[#7A5D91]" defaultChecked={inspirator?.is_active ?? true} name="is_active" type="checkbox" />
              Vis offentlig profil
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E5DDEA] bg-[#FAF6EF] p-5">
          <div className="flex items-center gap-2">
            <ImagePlus className="size-5 text-[#7A5D91]" aria-hidden="true" />
            <h3 className="font-semibold text-[#2F2633]">Stemningsbilleder og galleri</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#6E6475]">Upload nye billeder her. Eksisterende billeder kan slettes enkeltvis nedenfor.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="rounded-xl bg-white p-4" key={"mood-" + index}>
                <ImageUpload label={"Stemningsbillede " + (index + 1)} name={"mood_image_" + (index + 1)} />
                <TextInput label="Billedtekst" name={"mood_alt_" + (index + 1)} maxLength={160} />
              </div>
            ))}
            {Array.from({ length: 4 }, (_, index) => (
              <div className="rounded-xl bg-white p-4" key={"gallery-" + index}>
                <ImageUpload label={"Galleribillede " + (index + 1)} name={"gallery_image_" + (index + 1)} />
                <TextInput label="Billedtekst" name={"gallery_alt_" + (index + 1)} maxLength={160} />
              </div>
            ))}
          </div>
        </section>

        <button className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white transition hover:bg-[#6E5285]" type="submit">
          <Save className="size-4" aria-hidden="true" />
          Gem inspirator
        </button>
      </form>

      {(moodImages.length > 0 || galleryImages.length > 0) && (
        <section className="border-t border-[#E5DDEA] bg-white p-5">
          <h3 className="font-semibold text-[#2F2633]">Eksisterende billeder</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...moodImages, ...galleryImages].map((image) => (
              <article className="overflow-hidden rounded-xl border border-[#E5DDEA]" key={image.id}>
                {imagePreview(image.image_path, image.alt_text || inspirator?.name || "Inspirator")}
                <div className="p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7A5D91]">{image.section === "mood" ? "Stemning" : "Galleri"}</p>
                  <p className="mt-1 text-sm text-[#6E6475]">{image.alt_text || "Ingen billedtekst"}</p>
                  <form action={deleteInspiratorImageAction} className="mt-3">
                    <input name="id" type="hidden" value={image.id} />
                    <button className="inline-flex h-9 items-center gap-2 rounded-full border border-[#D8A7B1] px-3 text-sm font-semibold text-[#9A5D68]" type="submit">
                      <Trash2 className="size-4" aria-hidden="true" />
                      Slet billede
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {inspirator && (
        <form action={archiveInspiratorAction} className="border-t border-[#E5DDEA] bg-white px-5 py-4">
          <input name="id" type="hidden" value={inspirator.id} />
          <button className="inline-flex h-9 items-center gap-2 rounded-full border border-[#D8A7B1] px-3 text-sm font-semibold text-[#9A5D68]" type="submit">
            Skjul profil
          </button>
        </form>
      )}
    </details>
  );
}

export default async function AdminInspiratorsPage({ searchParams }: AdminInspiratorsPageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inspirator_profiles")
    .select("*, inspirator_images(*)")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const inspirators = (data ?? []) as Inspirator[];

  return (
    <main className="min-h-screen bg-[#FAF6EF] px-4 py-8 text-[#2F2633]">
      <section className="mx-auto max-w-7xl">
        <Link className="mb-6 inline-flex h-10 items-center gap-2 rounded-full border border-[#7A5D91]/20 bg-white px-4 text-sm font-semibold text-[#7A5D91]" href="/admin">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tilbage til admin
        </Link>

        <div className="rounded-[1.75rem] border border-[#E5DDEA] bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Inspiration</p>
          <h1 className="mt-2 text-3xl font-semibold">Inspiratorprofiler</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6E6475]">
            Opret særligt udvalgte personer, kunstnere, musikere, undervisere og andre inspirerende mennesker, som bidrager til SoulEvents-universet uden nødvendigvis at afholde events.
          </p>
        </div>

        <div className="mt-5">
          <AuthMessage message={message || error?.message} />
        </div>

        <div className="mt-6 grid gap-5">
          <InspiratorForm title="Opret ny inspirator" />
          {inspirators.map((inspirator) => (
            <InspiratorForm inspirator={inspirator} key={inspirator.id} title={inspirator.name} />
          ))}
        </div>
      </section>
    </main>
  );
}
