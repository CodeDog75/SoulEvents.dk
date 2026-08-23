/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Sparkles } from "lucide-react";
import { sendInspiratorContactAction } from "@/app/inspiration/[slug]/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { BrandLogo } from "@/components/brand-logo";
import { EventMediaGallery } from "@/components/events/detail/event-media-gallery";
import { isEventGalleryVideoPath } from "@/lib/events/gallery-media";
import { normalizeInspiratorEmbedUrl } from "@/lib/inspiration/embed-links";
import { createPageMetadata, getHomepageOgImageUrl, stripHtml } from "@/lib/open-graph";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ contact?: string }>;
};

type PublicMediaItem = {
  alt: string;
  src: string;
  type: "image" | "video";
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

function providerLabel(provider: "spotify" | "youtube") {
  return provider === "spotify" ? "Spotify" : "YouTube";
}

function embedFrameClass(height: "compact" | "tall" | "video") {
  if (height === "video") return "aspect-video w-full";
  return height === "compact" ? "h-[152px] w-full" : "h-[352px] w-full";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("inspirator_profiles")
    .select("slug, name, title, short_intro, body, profile_image_path, hero_image_path")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) {
    return createPageMetadata({
      title: "Inspiration | SoulEvents.dk",
      description: "Mød inspirerende mennesker i SoulEvents-universet.",
      path: "/inspiration/" + slug,
    });
  }

  const imageUrl = publicMediaUrl(profile.hero_image_path || profile.profile_image_path) ?? (await getHomepageOgImageUrl(supabase as any));
  const description = stripHtml(profile.short_intro || profile.body) || "Mød " + profile.name + " i SoulEvents-universet.";

  return createPageMetadata({
    title: profile.name + " | Inspiration på SoulEvents.dk",
    description,
    imageTitle: profile.name,
    imageSubtitle: profile.title || "Inspiration på SoulEvents.dk",
    imageUrl,
    path: "/inspiration/" + slug,
    type: "article",
  });
}

export default async function InspiratorProfilePage({ params, searchParams }: PageProps) {
  const [{ slug }, { contact }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("inspirator_profiles")
    .select("*, inspirator_embeds(*), inspirator_images(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) notFound();

  const profileImageUrl = publicMediaUrl(profile.profile_image_path);
  const heroImageUrl = publicMediaUrl(profile.hero_image_path);
  const images = (profile.inspirator_images ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const moodImages = images.filter((image: any) => image.section === "mood");
  const galleryImages = images.filter((image: any) => image.section === "gallery");
  const moodMediaItems = moodImages
    .slice(0, 6)
    .map((image: any) => {
      const url = publicMediaUrl(image.image_path);
      return url
        ? {
            alt: image.alt_text || profile.name,
            src: url,
            type: isEventGalleryVideoPath(image.image_path) ? "video" as const : "image" as const,
          }
        : null;
    })
    .filter((item: PublicMediaItem | null): item is PublicMediaItem => Boolean(item));
  const galleryMediaItems = galleryImages
    .map((image: any) => {
      const url = publicMediaUrl(image.image_path);
      return url
        ? {
            alt: image.alt_text || profile.name,
            src: url,
            type: isEventGalleryVideoPath(image.image_path) ? "video" as const : "image" as const,
          }
        : null;
    })
    .filter((item: PublicMediaItem | null): item is PublicMediaItem => Boolean(item));
  const editorialMediaItems = moodMediaItems.slice(0, 2);
  const remainingMoodMediaItems = moodMediaItems.slice(2);
  const heroSubtitle =
    profile.title && profile.title.trim().toLowerCase() !== String(profile.category || "").trim().toLowerCase()
      ? profile.title
      : null;
  const contactMessage =
    contact === "sent"
      ? "Din besked er sendt."
      : contact === "email-missing"
        ? "Mailafsendelse mangler opsætning, eller der er ikke angivet en kontaktmail."
        : contact === "error"
          ? "Beskeden kunne ikke sendes. Tjek navn, e-mail og besked."
          : undefined;
  const musicAndVideoEmbeds =
    (profile.inspirator_embeds ?? [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .slice(0, 6)
      .map((embed: any) => {
        const normalizedEmbed = normalizeInspiratorEmbedUrl(embed.url);
        return normalizedEmbed
            ? {
                embedUrl: normalizedEmbed.embedUrl,
                height: normalizedEmbed.height,
                provider: normalizedEmbed.provider,
                title: embed.title || providerLabel(normalizedEmbed.provider),
                url: normalizedEmbed.url,
            }
          : null;
      })
      .filter(Boolean);

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
            <div className="absolute inset-0 bg-gradient-to-r from-[#241C29]/85 via-[#2F2633]/58 to-[#2F2633]/38" />
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
                <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl xl:text-6xl">{profile.name}</h1>
                {heroSubtitle && <p className="mt-4 text-lg font-semibold text-white/90">{heroSubtitle}</p>}
                {profile.short_intro && <p className="mt-5 text-base leading-8 text-white/86 sm:text-lg">{profile.short_intro}</p>}
              </div>
            </div>
          </div>

          {editorialMediaItems.length > 0 && (
            <section className="border-b border-[#E5DDEA] bg-white p-4 sm:p-6">
              <EventMediaGallery items={editorialMediaItems} variant="editorial" />
            </section>
          )}

          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_340px]">
            <div>
              {remainingMoodMediaItems.length > 0 && (
                <section className="mb-10">
                  <EventMediaGallery items={remainingMoodMediaItems} />
                </section>
              )}

              <section>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Om personen</p>
                <h2 className="mt-2 text-3xl font-semibold">Mød {profile.name}</h2>
                <div className="mt-4 text-base">{paragraphs(profile.about_body)}</div>
              </section>

              {musicAndVideoEmbeds.length > 0 && (
                <section className="mt-12">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Musik og videoer</p>
                  <div className="mt-5 grid gap-5">
                    {musicAndVideoEmbeds.map((embed: any, index: number) => (
                      <article className="overflow-hidden rounded-[1.5rem] border border-[#E5DDEA] bg-[#FAF6EF] shadow-soft" key={embed.url + index}>
                        <div className="flex items-center justify-between gap-3 border-b border-[#E5DDEA] bg-white/76 px-5 py-4">
                          <h2 className="font-semibold text-[#2F2633]">{embed.title}</h2>
                          <span className="rounded-full bg-[#F4F0F7] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#7A5D91]">
                            {providerLabel(embed.provider)}
                          </span>
                        </div>
                        <iframe
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          className={embedFrameClass(embed.height)}
                          loading="lazy"
                          referrerPolicy="strict-origin-when-cross-origin"
                          src={embed.embedUrl}
                          title={embed.title}
                        />
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {galleryMediaItems.length > 0 && (
                <section className="mt-12">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Galleri</p>
                  <EventMediaGallery items={galleryMediaItems} />
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
