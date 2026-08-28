import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { publicMediaUrl } from "@/lib/media/public-url";
import { absoluteUrl, createPageMetadata, stripHtml, truncateText } from "@/lib/open-graph";
import { createPublicClient } from "@/lib/supabase/public";
import { formatWeeklyReflectionDate, weeklyReflectionBackground, weeklyReflectionPath } from "@/lib/weekly-reflections";

export const revalidate = 300;

type ReflectionPageProps = {
  params: Promise<{ slug: string }>;
};

type PublishedReflection = {
  author: string | null;
  background_color: string;
  image_alt_text: string | null;
  image_path: string | null;
  published_at: string | null;
  reflection_text: string;
  slug: string;
  start_date: string | null;
  title: string;
};

const getPublishedReflection = cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("weekly_reflections")
    .select("author, background_color, image_alt_text, image_path, published_at, reflection_text, slug, start_date, title")
    .eq("slug", slug)
    .or("published_at.not.is.null,is_active.eq.true")
    .or("start_date.is.null,start_date.lte." + new Date().toISOString().slice(0, 10))
    .single();

  if (error || !data) {
    return null;
  }

  const reflection = data as PublishedReflection;
  return {
    ...reflection,
    imageAltText: reflection.image_alt_text?.trim() || "Illustration til refleksionen " + reflection.title,
    imageUrl: publicMediaUrl(reflection.image_path),
    path: weeklyReflectionPath(reflection.slug),
    publishedDate: formatWeeklyReflectionDate(reflection.published_at ?? reflection.start_date),
  };
});

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: ReflectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const reflection = await getPublishedReflection(slug);

  if (!reflection) {
    return createPageMetadata({
      title: "Refleksion | SoulEvents.dk",
      description: "Læs ugens refleksion fra SoulEvents.",
      path: weeklyReflectionPath(slug),
    });
  }

  const description = truncateText(stripHtml(reflection.reflection_text), 170);

  return createPageMetadata({
    title: reflection.title + " | SoulEvents.dk",
    description,
    imageTitle: reflection.title,
    imageUrl: reflection.imageUrl,
    path: reflection.path,
    type: "article",
  });
}

export default async function ReflectionPage({ params }: ReflectionPageProps) {
  const { slug } = await params;
  const reflection = await getPublishedReflection(slug);

  if (!reflection) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    author: reflection.author ? { "@type": "Person", name: reflection.author } : { "@type": "Organization", name: "SoulEvents" },
    datePublished: reflection.published_at ?? reflection.start_date ?? undefined,
    description: truncateText(stripHtml(reflection.reflection_text), 170),
    headline: reflection.title,
    image: reflection.imageUrl ? [reflection.imageUrl] : undefined,
    mainEntityOfPage: absoluteUrl(reflection.path),
    publisher: {
      "@type": "Organization",
      name: "SoulEvents",
      url: absoluteUrl("/"),
    },
  };

  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
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

      <article className="px-5 pb-16 sm:px-8 lg:pb-24">
        <div
          className="mx-auto max-w-[980px] overflow-hidden rounded-[32px] border border-white/75 px-6 py-9 shadow-[0_24px_70px_rgba(47,38,51,0.10)] sm:px-10 sm:py-12 lg:px-16 lg:py-16"
          style={{ background: weeklyReflectionBackground(reflection.background_color || "#FAF6EF") }}
        >
          {reflection.imageUrl && (
            <figure className="mb-8 overflow-hidden rounded-[24px] bg-white/50 shadow-soft">
              <Image
                alt={reflection.imageAltText}
                className="h-auto w-full object-cover"
                height={900}
                priority
                sizes="(min-width: 1024px) 860px, 100vw"
                src={reflection.imageUrl}
                width={1200}
              />
            </figure>
          )}

          <div className="mx-auto max-w-[720px] text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7A4EAB]">Ugens refleksion</p>
            <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-[#2F2633] sm:text-5xl">
              {reflection.title}
            </h1>
            {reflection.publishedDate && (
              <p className="mt-4 text-sm font-medium text-[#2F2633]/58">
                Publiceret {reflection.publishedDate}
              </p>
            )}
          </div>

          <div className="mx-auto mt-8 max-w-[720px] whitespace-pre-line font-serif text-2xl leading-[1.45] text-[#2F2633] sm:text-3xl">
            {reflection.reflection_text}
          </div>

          {reflection.author && (
            <p className="mx-auto mt-10 max-w-[720px] text-sm font-semibold uppercase tracking-[0.16em] text-[#2F2633]/58">
              - {reflection.author}
            </p>
          )}
        </div>
      </article>
    </main>
  );
}
