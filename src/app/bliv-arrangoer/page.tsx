import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Play, Sparkles } from "lucide-react";
import { OrganizerPresentationGallery, type PresentationCard } from "@/components/become-organizer/organizer-presentation-gallery";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooterLogin } from "@/components/site-footer-login";
import {
  mergeBecomeFacilitatorPresentationSections,
  publicSectionImageUrl,
} from "@/lib/become-facilitator-presentation-sections";
import {
  becomeOrganizerPageSettingKey,
  parseBecomeOrganizerPageContent,
  siteContentBucketName,
  type BecomeOrganizerCta,
  type BecomeOrganizerImage,
  type BecomeOrganizerSection,
} from "@/lib/become-organizer-page-content";
import { createPageMetadata, getHomepageOgImageUrl } from "@/lib/open-graph";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getContent() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: setting } = await supabase.from("site_settings").select("value").eq("key", becomeOrganizerPageSettingKey).maybeSingle();
  const { data: presentationRows } = await admin
    .from("become_facilitator_sections")
    .select("id,section_key,title,body,image_url,image_path,image_alt,sort_order,is_active")
    .order("sort_order", { ascending: true });

  return {
    content: parseBecomeOrganizerPageContent(setting?.value),
    presentationSections: mergeBecomeFacilitatorPresentationSections(presentationRows).filter((section) => section.isActive),
    supabase,
  };
}

function publicMediaUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null) {
  return path ? supabase.storage.from(siteContentBucketName).getPublicUrl(path).data.publicUrl : null;
}

function TextBody({ className = "", text }: { className?: string; text: string }) {
  if (!text) return null;

  return <div className={"space-y-4 whitespace-pre-line text-base leading-8 text-ink/72 " + className}>{text}</div>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  if (!children) return null;

  return <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">{children}</p>;
}

function CtaLink({ cta, tone = "primary" }: { cta: BecomeOrganizerCta; tone?: "primary" | "secondary" }) {
  if (!cta.label || !cta.href) return null;

  const href = cta.href === "/auth/signup" ? "/auth/login?role=facilitator" : cta.href;

  return (
    <Link
      className={
        tone === "primary"
          ? "inline-flex h-12 items-center justify-center gap-2 rounded-button bg-olive px-6 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-sage-700 hover:shadow-lift"
          : "inline-flex h-12 items-center justify-center gap-2 rounded-button border border-midnight/15 bg-white px-6 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
      }
      href={href}
    >
      {cta.label}
      {tone === "primary" ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
    </Link>
  );
}

function ImageBlock({
  image,
  supabase,
  title,
  variant = "wide",
}: {
  image: BecomeOrganizerImage;
  supabase: Awaited<ReturnType<typeof createClient>>;
  title: string;
  variant?: "square" | "wide";
}) {
  const imageUrl = publicMediaUrl(supabase, image.path);

  if (!imageUrl) {
    return (
      <div className="grid aspect-[16/11] place-items-center rounded-[24px] bg-sage-50 shadow-soft">
        <BrandLogo className="h-24 w-24" priority={false} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] bg-sage-50 shadow-soft">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={image.alt || title} className={(variant === "square" ? "aspect-square" : "aspect-[16/11]") + " w-full object-cover"} src={imageUrl} />
    </div>
  );
}

function videoEmbedUrl(url: string) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? "https://www.youtube.com/embed/" + encodeURIComponent(id) : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).at(-1);
      return id ? "https://www.youtube.com/embed/" + encodeURIComponent(id) : null;
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean).at(-1);
      return id ? "https://player.vimeo.com/video/" + encodeURIComponent(id) : null;
    }
  } catch {
    return null;
  }

  return null;
}

function HeroSection({ section, supabase }: { section: Extract<BecomeOrganizerSection, { type: "hero" }>; supabase: Awaited<ReturnType<typeof createClient>> }) {
  return (
    <section className="grid gap-8 rounded-[28px] bg-white p-6 shadow-soft sm:p-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
      <div>
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-olive transition hover:text-rose" href="/">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tilbage til forsiden
        </Link>
        <Eyebrow>{section.eyebrow}</Eyebrow>
        <h1 className="mt-3 text-4xl font-medium leading-tight text-olive sm:text-6xl">{section.title}</h1>
        <TextBody className="mt-4 max-w-[68ch]" text={section.text} />
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <CtaLink cta={section.primaryCta} />
          <CtaLink cta={section.secondaryCta} tone="secondary" />
        </div>
      </div>
      <ImageBlock image={section.image} supabase={supabase} title={section.title} variant="square" />
    </section>
  );
}

function TextSection({ section }: { section: Extract<BecomeOrganizerSection, { type: "text" }> }) {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-soft sm:p-8">
      <div className="max-w-[78ch]">
        <Eyebrow>{section.eyebrow}</Eyebrow>
        <h2 className="mt-3 text-3xl font-medium leading-tight text-olive sm:text-4xl">{section.title}</h2>
        <TextBody className="mt-4" text={section.text} />
      </div>
    </section>
  );
}

function ImageSection({ section, supabase }: { section: Extract<BecomeOrganizerSection, { type: "image" }>; supabase: Awaited<ReturnType<typeof createClient>> }) {
  return (
    <section className="grid gap-7 rounded-[28px] bg-white p-6 shadow-soft sm:p-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
      <div className={section.imagePosition === "left" ? "lg:order-2" : ""}>
        <Eyebrow>{section.eyebrow}</Eyebrow>
        <h2 className="mt-3 text-3xl font-medium leading-tight text-olive sm:text-4xl">{section.title}</h2>
        <TextBody className="mt-4 max-w-[64ch]" text={section.text} />
      </div>
      <div className={section.imagePosition === "left" ? "lg:order-1" : ""}>
        <ImageBlock image={section.image} supabase={supabase} title={section.title} />
      </div>
    </section>
  );
}

function BenefitsSection({ section }: { section: Extract<BecomeOrganizerSection, { type: "benefits" }> }) {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-soft sm:p-8">
      <div className="max-w-[76ch]">
        <Eyebrow>{section.eyebrow}</Eyebrow>
        <h2 className="mt-3 text-3xl font-medium leading-tight text-olive sm:text-4xl">{section.title}</h2>
        <TextBody className="mt-4" text={section.text} />
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        {section.items.map((item) => (
          <article className="rounded-[22px] border border-sage-700/12 bg-[#FAF6EF] p-5" key={item.title + item.text}>
            <h3 className="text-xl font-medium text-[#2F2633]">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/68">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function VideoSection({ section }: { section: Extract<BecomeOrganizerSection, { type: "video" }> }) {
  const embedUrl = videoEmbedUrl(section.videoUrl);

  return (
    <section className="rounded-[28px] bg-white p-6 shadow-soft sm:p-8">
      <div className="max-w-[76ch]">
        <Eyebrow>{section.eyebrow}</Eyebrow>
        <h2 className="mt-3 text-3xl font-medium leading-tight text-olive sm:text-4xl">{section.title}</h2>
        <TextBody className="mt-4" text={section.text} />
      </div>
      <div className="mt-7 overflow-hidden rounded-[24px] bg-[#2F2633] shadow-soft">
        {embedUrl ? (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="aspect-video w-full"
            loading="lazy"
            src={embedUrl}
            title={section.title}
          />
        ) : (
          <div className="grid aspect-video place-items-center text-white">
            <div className="grid place-items-center gap-3">
              <span className="grid size-14 place-items-center rounded-full bg-white/12">
                <Play className="size-6" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold">Indsæt et gyldigt YouTube- eller Vimeo-link i CMS</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FaqSection({ section }: { section: Extract<BecomeOrganizerSection, { type: "faq" }> }) {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-soft sm:p-8">
      <div className="max-w-[76ch]">
        <Eyebrow>{section.eyebrow}</Eyebrow>
        <h2 className="mt-3 text-3xl font-medium leading-tight text-olive sm:text-4xl">{section.title}</h2>
      </div>
      <div className="mt-7 grid gap-3">
        {section.items.map((item) => (
          <details className="group rounded-[18px] border border-sage-700/12 bg-[#FAF6EF] p-5" key={item.question + item.answer}>
            <summary className="cursor-pointer list-none text-base font-semibold text-[#2F2633] marker:hidden">{item.question}</summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink/70">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCtaSection({ section, supabase }: { section: Extract<BecomeOrganizerSection, { type: "cta" }>; supabase: Awaited<ReturnType<typeof createClient>> }) {
  const imageUrl = publicMediaUrl(supabase, section.image.path);

  return (
    <section className="overflow-hidden rounded-[28px] bg-[#EDE4F7] shadow-soft">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={section.image.alt || section.title} className="h-56 w-full object-cover sm:h-72" src={imageUrl} />
      ) : null}
      <div className="p-6 text-center sm:p-8">
        <Eyebrow>{section.eyebrow}</Eyebrow>
        <h2 className="mt-3 text-3xl font-medium text-[#2F2633] sm:text-4xl">{section.title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-ink/70">{section.text}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <CtaLink cta={section.primaryCta} />
          <CtaLink cta={section.secondaryCta} tone="secondary" />
        </div>
      </div>
    </section>
  );
}

function SectionRenderer({ section, supabase }: { section: BecomeOrganizerSection; supabase: Awaited<ReturnType<typeof createClient>> }) {
  if (!section.isEnabled) return null;

  switch (section.type) {
    case "hero":
      return <HeroSection section={section} supabase={supabase} />;
    case "text":
      return <TextSection section={section} />;
    case "image":
      return <ImageSection section={section} supabase={supabase} />;
    case "benefits":
      return <BenefitsSection section={section} />;
    case "video":
      return <VideoSection section={section} />;
    case "faq":
      return <FaqSection section={section} />;
    case "cta":
      return <FinalCtaSection section={section} supabase={supabase} />;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getContent();
  const homepageImageUrl = await getHomepageOgImageUrl();
  const heroSection = content.sections.find((section): section is Extract<BecomeOrganizerSection, { type: "hero" }> => section.type === "hero");

  return createPageMetadata({
    title: content.seoTitle,
    description: content.seoDescription,
    imageTitle: heroSection?.title || content.seoTitle,
    imageSubtitle: content.seoDescription,
    imageUrl: homepageImageUrl,
    path: "/bliv-arrangoer",
  });
}

export default async function BecomeOrganizerPage() {
  const { content, presentationSections, supabase } = await getContent();
  const faqSection = content.sections.find((section): section is Extract<BecomeOrganizerSection, { type: "faq" }> => section.type === "faq" && section.isEnabled);
  const presentationCards: PresentationCard[] = presentationSections
    .map((section) => ({
      title: section.title,
      description: section.body,
      imagePath: publicSectionImageUrl(supabase, section) ?? "",
      alt: section.imageAlt,
    }))
    .filter((section) => section.imagePath)
    .slice(0, 3);

  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <section className="mx-auto grid max-w-[1180px] gap-8 px-5 py-8 sm:px-8 sm:py-12">
        {content.sections.map((section) => (
          <SectionRenderer key={section.id} section={section} supabase={supabase} />
        ))}
        <OrganizerPresentationGallery presentations={presentationCards} />
      </section>

      {faqSection ? (
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqSection.items.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer,
                },
              })),
            }),
          }}
          type="application/ld+json"
        />
      ) : null}

      <section className="mx-auto max-w-[1180px] px-5 pb-10 sm:px-8">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-ink/56">
          <Sparkles className="size-4 text-[#7A4EAB]" aria-hidden="true" />
          SoulEvents for krop, sind og sjæl
        </div>
      </section>

      <SiteFooterLogin />
    </main>
  );
}
