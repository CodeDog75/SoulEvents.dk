import Link from "next/link";
import { ArrowLeft, HeartHandshake, MapPinned, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooterLogin } from "@/components/site-footer-login";
import { aboutPageSettingKey, parseAboutPageContent, type AboutImageKey } from "@/lib/about-page-content";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function publicMediaUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null) {
  return path ? supabase.storage.from("media").getPublicUrl(path).data.publicUrl : null;
}

function StorySection({
  imageKey,
  imagePosition = "right",
  supabase,
  text,
  title,
  images,
}: {
  imageKey?: AboutImageKey;
  imagePosition?: "left" | "right";
  supabase: Awaited<ReturnType<typeof createClient>>;
  text: string;
  title: string;
  images: ReturnType<typeof parseAboutPageContent>["images"];
}) {
  if (!title && !text) {
    return null;
  }

  const image = imageKey ? images[imageKey] : null;
  const imageUrl = image ? publicMediaUrl(supabase, image.path) : null;
  const textBlock = (
    <div>
      <h2 className="text-3xl font-medium text-olive sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 whitespace-pre-line text-base leading-7 text-ink/70">{text}</p>}
    </div>
  );
  const imageBlock = imageUrl ? (
    <div className="overflow-hidden rounded-[24px] bg-sage-50 shadow-soft">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={image?.alt || title} className="aspect-[16/11] w-full object-cover" src={imageUrl} />
    </div>
  ) : null;

  return (
    <section className="grid gap-6 rounded-[28px] bg-white p-6 shadow-soft sm:p-8 lg:grid-cols-2 lg:items-center">
      {imagePosition === "left" && imageBlock}
      {textBlock}
      {imagePosition === "right" && imageBlock}
    </section>
  );
}

export default async function AboutPage() {
  const supabase = await createClient();
  const { data: setting } = await supabase.from("site_settings").select("value").eq("key", aboutPageSettingKey).maybeSingle();
  const content = parseAboutPageContent(setting?.value);
  const heroImageUrl = publicMediaUrl(supabase, content.images.hero.path);

  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <section className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-12">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-olive transition hover:text-rose" href="/">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tilbage til forsiden
        </Link>

        <div className="mt-8 grid gap-8 rounded-[28px] bg-white p-6 shadow-soft sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            {heroImageUrl ? (
              <div className="overflow-hidden rounded-[24px] bg-sage-50 shadow-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={content.images.hero.alt} className="aspect-square w-full object-cover" src={heroImageUrl} />
              </div>
            ) : (
              <BrandLogo className="h-28 w-28 sm:h-40 sm:w-40" priority />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Om SoulEvents</p>
            <h1 className="mt-3 text-4xl font-medium leading-tight text-olive sm:text-6xl">{content.headline}</h1>
            <p className="mt-4 whitespace-pre-line text-base leading-7 text-ink/70">{content.introduction}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Ro og overblik",
              text: "Find events, ydelser og arrangører i et enkelt og trygt univers.",
            },
            {
              icon: MapPinned,
              title: "Tæt på dig",
              text: "Udforsk oplevelser på kortet eller søg efter område, kategori og dato.",
            },
            {
              icon: HeartHandshake,
              title: "Fællesskab",
              text: "SoulEvents samler mennesker og arrangører, der skaber nærvær og udvikling.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article className="rounded-[24px] bg-white p-6 shadow-soft" key={item.title}>
                <Icon className="size-6 text-[#7A4EAB]" aria-hidden="true" />
                <h2 className="mt-4 text-2xl font-medium text-olive">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink/68">{item.text}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6">
          <StorySection imageKey="why" images={content.images} supabase={supabase} text={content.whyText} title={content.whyTitle} />
          <StorySection imageKey="vision" imagePosition="left" images={content.images} supabase={supabase} text={content.visionText} title={content.visionTitle} />
          <StorySection imageKey="story" images={content.images} supabase={supabase} text={content.storyText} title={content.storyTitle} />
          <StorySection images={content.images} supabase={supabase} text={content.howText} title={content.howTitle} />
          <StorySection images={content.images} supabase={supabase} text={content.valuesText} title={content.valuesTitle} />
        </div>

        {(content.ctaTitle || content.ctaText || content.ctaButtonText) && (
          <section className="mt-8 rounded-[28px] bg-[#EDE4F7] p-6 text-center shadow-soft sm:p-8">
            {content.ctaTitle && <h2 className="text-3xl font-medium text-[#2F2633] sm:text-4xl">{content.ctaTitle}</h2>}
            {content.ctaText && <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-ink/70">{content.ctaText}</p>}
            {content.ctaButtonText && (
              <Link
                className="mt-6 inline-flex h-12 items-center justify-center rounded-button bg-olive px-6 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-sage-700 hover:shadow-lift"
                href={content.ctaButtonLink || "/auth/signup"}
              >
                {content.ctaButtonText}
              </Link>
            )}
          </section>
        )}
      </section>

      <SiteFooterLogin />
    </main>
  );
}
