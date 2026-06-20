import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Sparkles } from "lucide-react";
import { sendInspiratorContactAction } from "@/app/inspiration/[slug]/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ contact?: string }>;
};

function publicMediaUrl(imagePath: string | null) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  const encodedPath = imagePath.split("/").map((part) => encodeURIComponent(part)).join("/");
  return supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/media/" + encodedPath;
}

function paragraphs(text: string | null) {
  if (!text) return null;
  return text.split(/\n{2,}/).map((part, index) => (
    <p className="mt-4 leading-8 text-[#2F2633]/78" key={index}>{part}</p>
  ));
}

function linkItems(profile: any) {
  return [
    ["Hjemmeside", profile.website_url],
    ["Instagram", profile.instagram_url],
    ["Facebook", profile.facebook_url],
    ["YouTube", profile.youtube_url],
    ["Spotify", profile.spotify_url],
    ["Webshop", profile.webshop_url],
  ].filter(([, url]) => Boolean(url));
}

export default async function InspiratorProfilePage({ params, searchParams }: PageProps) {
  const [{ slug }, { contact }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("inspirator_profiles")
    .select("*, inspirator_images(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) notFound();

  const profileImageUrl = publicMediaUrl(profile.profile_image_path);
  const heroImageUrl = publicMediaUrl(profile.hero_image_path);
  const images = (profile.inspirator_images ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const moodImages = images.filter((image: any) => image.section === "mood");
  const galleryImages = images.filter((image: any) => image.section === "gallery");
  const contactMessage =
    contact === "sent"
      ? "Din besked er sendt."
      : contact === "email-missing"
        ? "Mailafsendelse mangler opsætning, eller der er ikke angivet en kontaktmail."
        : contact === "error"
          ? "Beskeden kunne ikke sendes. Tjek navn, e-mail og besked."
          : undefined;

  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <header className="border-b border-[#E5DDEA] bg-white/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/"><BrandLogo className="h-20 w-20" priority /></Link>
          <Link className="inline-flex h-10 items-center gap-2 rounded-full border border-[#7A5D91]/20 bg-white px-4 text-sm font-semibold text-[#7A5D91]" href="/inspiration">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Inspiration
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <article className="overflow-hidden rounded-[2rem] border border-[#D8CBE4] bg-white shadow-soft">
          <div className="relative min-h-[360px] bg-gradient-to-br from-[#7A5D91] via-[#D8A7B1] to-[#FAF6EF] p-8 sm:p-12">
            {heroImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="absolute inset-0 h-full w-full object-cover" src={heroImageUrl} />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#2F2633]/70 via-[#2F2633]/35 to-transparent" />
            <div className="relative z-10 grid gap-8 lg:grid-cols-[240px_1fr] lg:items-end">
              <div className="size-44 overflow-hidden rounded-[2rem] border border-white/50 bg-white/20 shadow-soft sm:size-56">
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={profile.name} className="h-full w-full object-cover" src={profileImageUrl} />
                ) : (
                  <div className="grid h-full place-items-center text-white"><Sparkles className="size-12" aria-hidden="true" /></div>
                )}
              </div>
              <div className="max-w-3xl text-white">
                {profile.category && <p className="text-sm font-semibold uppercase tracking-wide text-white/78">{profile.category}</p>}
                <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-6xl">{profile.name}</h1>
                {profile.title && <p className="mt-4 text-lg font-semibold text-white/90">{profile.title}</p>}
                {profile.short_intro && <p className="mt-5 text-base leading-8 text-white/86 sm:text-lg">{profile.short_intro}</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_340px]">
            <div>
              {moodImages.length > 0 && (
                <section className="mb-10 grid gap-3 sm:grid-cols-3">
                  {moodImages.slice(0, 6).map((image: any) => {
                    const url = publicMediaUrl(image.image_path);
                    return url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={image.alt_text || profile.name} className="aspect-[4/3] rounded-2xl object-cover" key={image.id} src={url} />
                    ) : null;
                  })}
                </section>
              )}

              <section>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Om personen</p>
                <h2 className="mt-2 text-3xl font-semibold">Mød {profile.name}</h2>
                <div className="mt-4 text-base">{paragraphs(profile.about_body)}</div>
              </section>

              {galleryImages.length > 0 && (
                <section className="mt-12">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Galleri</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {galleryImages.map((image: any) => {
                      const url = publicMediaUrl(image.image_path);
                      return url ? (
                        <figure className="overflow-hidden rounded-2xl border border-[#E5DDEA] bg-[#FAF6EF]" key={image.id}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt={image.alt_text || profile.name} className="aspect-[4/3] w-full object-cover" src={url} />
                          {image.alt_text && <figcaption className="p-3 text-sm text-[#6E6475]">{image.alt_text}</figcaption>}
                        </figure>
                      ) : null;
                    })}
                  </div>
                </section>
              )}
            </div>

            <aside className="grid content-start gap-5">
              {linkItems(profile).length > 0 && (
                <section className="rounded-[1.5rem] border border-[#E5DDEA] bg-[#FAF6EF] p-5">
                  <h2 className="font-semibold">Links</h2>
                  <div className="mt-4 grid gap-2">
                    {linkItems(profile).map(([label, url]) => (
                      <a className="inline-flex items-center justify-between rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#7A5D91]" href={String(url)} key={label} rel="noreferrer" target="_blank">
                        {label}
                        <ExternalLink className="size-4" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {profile.contact_email && (
                <section className="rounded-[1.5rem] border border-[#D8CBE4] bg-[#F4F0F7] p-5" id="contact">
                  <div className="flex items-center gap-2">
                    <Mail className="size-5 text-[#7A5D91]" aria-hidden="true" />
                    <h2 className="font-semibold">Kontakt</h2>
                  </div>
                  <div className="mt-4"><AuthMessage message={contactMessage} /></div>
                  <form action={sendInspiratorContactAction} className="mt-4 grid gap-3">
                    <input name="slug" type="hidden" value={profile.slug} />
                    <input className="h-11 rounded-xl border border-[#D8CBE4] bg-white px-4 outline-none focus:border-[#7A5D91]" maxLength={100} name="name" placeholder="Navn" required />
                    <input className="h-11 rounded-xl border border-[#D8CBE4] bg-white px-4 outline-none focus:border-[#7A5D91]" maxLength={160} name="email" placeholder="E-mail" required type="email" />
                    <textarea className="min-h-32 rounded-xl border border-[#D8CBE4] bg-white p-4 outline-none focus:border-[#7A5D91]" maxLength={1000} name="message" placeholder="Besked" required />
                    <button className="h-11 rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white transition hover:bg-[#6E5285]" type="submit">Send besked</button>
                  </form>
                </section>
              )}
            </aside>
          </div>
        </article>
      </section>
    </main>
  );
}
