import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, MapPinned, Phone, Sparkles, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PublicEventList } from "@/components/events/public-event-list";
import { ShareFacilitatorButton } from "@/components/facilitator/share-facilitator-button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FacilitatorPageProps = {
  params: Promise<{ id: string }>;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function ensureUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function nameOf(facilitator: any) {
  const profile = first(facilitator?.profiles);
  return facilitator?.company_name || profile?.full_name || "Facilitator";
}

export async function generateMetadata({ params }: FacilitatorPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: facilitator } = await supabase
    .from("facilitator_profiles")
    .select("company_name, short_description, profiles(full_name)")
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (!facilitator) return {};

  const name = nameOf(facilitator);
  return {
    title: name + " | Facilitator på SoulEvents",
    description: facilitator.short_description || "Find facilitatorprofil på SoulEvents.",
  };
}

export default async function PublicFacilitatorPage({ params }: FacilitatorPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: facilitator } = await supabase
    .from("facilitator_profiles")
    .select(
      "id, company_name, profile_image_path, short_description, long_description, website_url, public_email, public_phone, facebook_url, instagram_url, youtube_url, tiktok_url, address_line, postal_code, city, country, is_online_facilitator, profiles(full_name, email, phone), regions(name), facilitator_categories(categories(name, color_hex)), facilitator_images(image_path, alt_text, sort_order)",
    )
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (!facilitator) {
    notFound();
  }

  const { data: events } = await supabase
    .from("events")
    .select(
      "id, title, short_description, starts_at, city, price_cents, capacity, event_format, facilitator_profiles!inner(status, company_name, profiles(full_name)), regions(name), event_categories(categories(name, color_hex))",
    )
    .eq("facilitator_id", id)
    .eq("status", "active")
    .eq("facilitator_profiles.status", "approved")
    .gte("starts_at", startOfToday().toISOString())
    .order("starts_at", { ascending: true });

  const profile = first(facilitator.profiles);
  const region = first(facilitator.regions);
  const name = nameOf(facilitator);
  const imageUrl = facilitator.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl
    : null;
  const gallery =
    [...(facilitator.facilitator_images ?? [])]
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .slice(0, 10)
      .map((image: any) => ({
        ...image,
        url: supabase.storage.from("media").getPublicUrl(image.image_path).data.publicUrl,
      })) ?? [];
  const categories =
    facilitator.facilitator_categories
      ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
      .filter(Boolean) ?? [];
  const publicEmail = facilitator.public_email || profile?.email || null;
  const publicPhone = facilitator.public_phone || profile?.phone || null;
  const links = [
    facilitator.website_url ? { label: "Hjemmeside", href: ensureUrl(facilitator.website_url) } : null,
    facilitator.facebook_url ? { label: "Facebook", href: ensureUrl(facilitator.facebook_url) } : null,
    facilitator.instagram_url ? { label: "Instagram", href: ensureUrl(facilitator.instagram_url) } : null,
    facilitator.youtube_url ? { label: "YouTube", href: ensureUrl(facilitator.youtube_url) } : null,
    facilitator.tiktok_url ? { label: "TikTok", href: ensureUrl(facilitator.tiktok_url) } : null,
  ].filter((link): link is { label: string; href: string } => Boolean(link));

  return (
    <main className="min-h-screen bg-cream text-ink">
      <header className="bg-white shadow-soft">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
          <Link aria-label="SoulEvents.dk forside" href="/">
            <BrandLogo className="h-20 w-20" priority />
          </Link>
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive transition hover:border-rose hover:text-rose"
            href="/facilitators"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Facilitatorer
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          <section className="overflow-hidden rounded-card bg-white shadow-soft">
            <div className="grid gap-8 p-8 sm:p-10 md:grid-cols-[260px_1fr] md:items-center">
              <div className="aspect-square overflow-hidden rounded-card bg-sage-50">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={name} className="h-full w-full object-cover" src={imageUrl} />
                ) : (
                  <div className="grid h-full place-items-center text-sage-700">
                    <UserRound className="size-20" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap gap-2">
                  {facilitator.is_online_facilitator && (
                    <span className="rounded-full border border-olive/10 bg-white px-2.5 py-1 text-xs font-medium text-ink/55">💻 Online facilitator</span>
                  )}
                  {categories.map((category: any) => (
                    <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" key={category.name} style={{ backgroundColor: category.color_hex }}>
                      {category.name}
                    </span>
                  ))}
                </div>
                <h1 className="mt-4 text-5xl font-medium leading-tight text-olive">{name}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-ink/72">
                  {facilitator.short_description || "Facilitatorens korte præsentation kommer snart."}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-card bg-white p-8 shadow-soft">
            <h2 className="text-4xl font-medium text-olive">Om facilitatoren</h2>
            <div className="mt-4 whitespace-pre-line text-sm leading-7 text-ink/72">
              {facilitator.long_description || facilitator.short_description || "Der kommer mere information om facilitatoren snart."}
            </div>
          </section>

          {gallery.length > 0 && (
            <section className="rounded-card bg-white p-8 shadow-soft">
              <h2 className="text-4xl font-medium text-olive">Galleri</h2>
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                {gallery.map((image: any) => (
                  <div className="aspect-square overflow-hidden rounded-card bg-sage-50" key={image.image_path}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={image.alt_text || name} className="h-full w-full object-cover" src={image.url} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-card bg-white p-8 shadow-soft">
            <h2 className="text-4xl font-medium text-olive">Kommende events</h2>
            <div className="mt-5">
              {events && events.length > 0 ? (
                <PublicEventList events={events as never} layout="stack" />
              ) : (
                <div className="rounded-card bg-cream p-8 text-center">
                  <Sparkles className="mx-auto size-8 text-rose" aria-hidden="true" />
                  <p className="mt-4 text-lg font-semibold text-olive">Der er ingen planlagte events for denne facilitator.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-5 lg:sticky lg:top-6">
          <section className="rounded-card bg-white p-6 shadow-soft">
            <h2 className="text-3xl font-medium text-olive">Kontakt og lokation</h2>
            <div className="mt-4 grid gap-3 text-sm text-ink/72">
              <div className="flex gap-2">
                <MapPinned className="mt-0.5 size-4 text-sage-700" aria-hidden="true" />
                <span>
                  {facilitator.is_online_facilitator
                    ? "Online facilitator"
                    : [facilitator.city, region?.name, facilitator.country].filter(Boolean).join(", ") || "Lokation kommer snart"}
                </span>
              </div>
              {publicEmail && (
                <a className="inline-flex items-center gap-2 font-semibold text-olive transition hover:text-rose" href={"mailto:" + publicEmail}>
                  <Mail className="size-4" aria-hidden="true" />
                  {publicEmail}
                </a>
              )}
              {publicPhone && (
                <a className="inline-flex items-center gap-2 font-semibold text-olive transition hover:text-rose" href={"tel:" + publicPhone}>
                  <Phone className="size-4" aria-hidden="true" />
                  {publicPhone}
                </a>
              )}
              {links.map((link) => (
                <a className="inline-flex items-center gap-2 font-semibold text-olive transition hover:text-rose" href={link.href} key={link.label} rel="noreferrer" target="_blank">
                  <ExternalLink className="size-4" aria-hidden="true" />
                  {link.label}
                </a>
              ))}
            </div>
          </section>

          <ShareFacilitatorButton facilitatorId={facilitator.id} facilitatorName={name} />

          <section className="rounded-card bg-white p-6 shadow-soft">
            <h2 className="text-3xl font-medium text-olive">Tilmeld påmindelse</h2>
            <p className="mt-3 text-sm leading-6 text-ink/66">
              Få besked på e-mail, når denne facilitator opretter et nyt event.
            </p>
            <form className="mt-4 grid gap-3">
              <input className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base outline-none transition focus:border-rose" name="email" placeholder="din@email.dk" type="email" />
              <button className="inline-flex h-12 items-center justify-center rounded-button bg-rose px-6 text-sm font-semibold text-white shadow-soft" type="button">
                Tilmeld påmindelse
              </button>
            </form>
          </section>
        </aside>
      </section>
    </main>
  );
}
