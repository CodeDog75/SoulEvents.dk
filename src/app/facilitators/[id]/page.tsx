import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, MapPinned, Sparkles, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PublicEventList } from "@/components/events/public-event-list";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FacilitatorPageProps = {
  params: Promise<{
    id: string;
  }>;
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

export default async function PublicFacilitatorPage({ params }: FacilitatorPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: facilitator } = await supabase
    .from("facilitator_profiles")
    .select(
      "id, company_name, profile_image_path, short_description, long_description, website_url, facebook_url, instagram_url, address_line, postal_code, city, profiles(full_name), regions(name), facilitator_categories(categories(name, color_hex))",
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
      "id, title, short_description, starts_at, city, price_cents, capacity, facilitator_profiles!inner(status, company_name, profiles(full_name)), regions(name), event_categories(categories(name, color_hex))",
    )
    .eq("facilitator_id", id)
    .eq("status", "active")
    .eq("facilitator_profiles.status", "approved")
    .gte("starts_at", startOfToday().toISOString())
    .order("starts_at", { ascending: true });

  const profile = first(facilitator.profiles);
  const region = first(facilitator.regions);
  const name = facilitator.company_name || profile?.full_name || "Facilitator";
  const imageUrl = facilitator.profile_image_path
    ? supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl
    : null;
  const categories =
    facilitator.facilitator_categories
      ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories))
      .filter(Boolean) ?? [];
  const links = [
    facilitator.website_url ? { label: "Hjemmeside", href: ensureUrl(facilitator.website_url) } : null,
    facilitator.facebook_url ? { label: "Facebook", href: ensureUrl(facilitator.facebook_url) } : null,
    facilitator.instagram_url ? { label: "Instagram", href: ensureUrl(facilitator.instagram_url) } : null,
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
            href="/#facilitators"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Facilitatorer
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          <section className="overflow-hidden rounded-card bg-white shadow-soft">
            <div className="grid gap-8 p-8 sm:p-10 md:grid-cols-[240px_1fr] md:items-center">
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
                <p className="text-sm font-semibold uppercase tracking-wide text-rose">Facilitator</p>
                <h1 className="mt-3 text-5xl font-medium leading-tight text-olive">{name}</h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-ink/72">
                  {facilitator.short_description || "Facilitatorens korte beskrivelse kommer snart."}
                </p>
                {categories.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {categories.map((category: { name: string; color_hex: string | null }) => (
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                        key={category.name}
                        style={{ backgroundColor: category.color_hex ?? "#6f7f4f" }}
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-card bg-white p-8 shadow-soft">
            <h2 className="text-4xl font-medium text-olive">Om facilitatoren</h2>
            <div className="mt-4 whitespace-pre-line text-sm leading-7 text-ink/72">
              {facilitator.long_description || facilitator.short_description || "Der kommer mere information om facilitatoren snart."}
            </div>
          </section>

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
            <h2 className="text-3xl font-medium text-olive">Praktisk</h2>
            <div className="mt-4 grid gap-3 text-sm text-ink/72">
              <div className="flex gap-2">
                <MapPinned className="mt-0.5 size-4 text-sage-700" aria-hidden="true" />
                <span>
                  {[facilitator.address_line, facilitator.postal_code, facilitator.city, region?.name].filter(Boolean).join(", ") ||
                    "Lokation kommer snart"}
                </span>
              </div>
              {links.map((link) => (
                <a
                  className="inline-flex items-center gap-2 font-semibold text-olive transition hover:text-rose"
                  href={link.href}
                  key={link.label}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                  {link.label}
                </a>
              ))}
            </div>
          </section>

          <section className="rounded-card bg-white p-6 shadow-soft">
            <h2 className="text-3xl font-medium text-olive">Tilmeld påmindelse</h2>
            <p className="mt-3 text-sm leading-6 text-ink/66">
              Få besked på e-mail, når denne facilitator opretter et nyt event.
            </p>
            <form className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-semibold text-olive">
                E-mail
                <input
                  className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-rose"
                  name="email"
                  placeholder="din@email.dk"
                  type="email"
                />
              </label>
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-button bg-rose px-6 text-sm font-semibold text-white shadow-soft"
                type="button"
              >
                <Mail className="size-4" aria-hidden="true" />
                Tilmeld påmindelse
              </button>
            </form>
          </section>
        </aside>
      </section>
    </main>
  );
}
