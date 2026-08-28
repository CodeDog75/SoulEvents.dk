import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { publicMediaUrl } from "@/lib/media/public-url";
import { createPageMetadata, stripHtml, truncateText } from "@/lib/open-graph";
import { createPublicClient } from "@/lib/supabase/public";
import { formatWeeklyReflectionDate, weeklyReflectionBackground, weeklyReflectionPath } from "@/lib/weekly-reflections";

export const revalidate = 300;

type ReflectionArchiveItem = {
  background_color: string;
  image_alt_text: string | null;
  image_path: string | null;
  published_at: string | null;
  reflection_text: string;
  slug: string;
  start_date: string | null;
  title: string;
};

async function getPublishedReflections() {
  const supabase = createPublicClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("weekly_reflections")
    .select("background_color, image_alt_text, image_path, published_at, reflection_text, slug, start_date, title")
    .or("published_at.not.is.null,is_active.eq.true")
    .or("start_date.is.null,start_date.lte." + today)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);

  if (error || !data) {
    return [];
  }

  return (data as ReflectionArchiveItem[]).map((reflection) => ({
    ...reflection,
    dateLabel: formatWeeklyReflectionDate(reflection.published_at ?? reflection.start_date),
    excerpt: truncateText(stripHtml(reflection.reflection_text), 150),
    imageAltText: reflection.image_alt_text?.trim() || "Illustration til refleksionen " + reflection.title,
    imageUrl: publicMediaUrl(reflection.image_path),
    path: weeklyReflectionPath(reflection.slug),
  }));
}

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "Refleksioner | SoulEvents.dk",
    description: "Læs tidligere refleksioner fra SoulEvents.",
    path: "/refleksioner",
  });
}

export default async function ReflectionsArchivePage() {
  const reflections = await getPublishedReflections();

  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <section className="px-5 py-8 sm:px-8 lg:py-10">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4">
          <Link aria-label="Gå til forsiden" href="/">
            <BrandLogo className="h-10 w-auto" />
          </Link>
          <Link className="text-sm font-semibold text-[#7A4EAB] underline-offset-4 hover:underline" href="/">
            Til forsiden
          </Link>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 lg:pb-24">
        <div className="mx-auto max-w-[1120px]">
          <div className="max-w-[680px]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7A4EAB]">SoulEvents</p>
            <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-[#2F2633] sm:text-5xl">
              Refleksioner
            </h1>
            <p className="mt-4 text-lg leading-8 text-[#2F2633]/70">
              Små øjeblikke til ro, nærvær og eftertanke.
            </p>
          </div>

          {reflections.length > 0 ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {reflections.map((reflection) => (
                <article
                  className="overflow-hidden rounded-[26px] border border-white/75 bg-white shadow-[0_18px_52px_rgba(47,38,51,0.09)]"
                  key={reflection.slug}
                >
                  <Link className="block h-full" href={reflection.path}>
                    <div
                      className="relative aspect-[4/3] overflow-hidden"
                      style={{ background: weeklyReflectionBackground(reflection.background_color || "#FAF6EF") }}
                    >
                      {reflection.imageUrl ? (
                        <Image
                          alt={reflection.imageAltText}
                          className="object-cover"
                          fill
                          sizes="(min-width: 1280px) 352px, (min-width: 768px) 50vw, 100vw"
                          src={reflection.imageUrl}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-8 text-center font-serif text-3xl text-[#2F2633]/45">
                          &rdquo;
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      {reflection.dateLabel && (
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A4EAB]">{reflection.dateLabel}</p>
                      )}
                      <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#2F2633]">{reflection.title}</h2>
                      <p className="mt-3 text-sm leading-6 text-[#2F2633]/66">{reflection.excerpt}</p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-[26px] border border-white/75 bg-white px-6 py-10 text-[#2F2633]/68 shadow-soft">
              Der er ingen publicerede refleksioner endnu.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
