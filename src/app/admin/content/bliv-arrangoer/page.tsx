import Link from "next/link";
import { ArrowLeft, FileText, ExternalLink } from "lucide-react";
import { updateBecomeOrganizerPageContentAction } from "@/app/admin/content/bliv-arrangoer/actions";
import { BecomeOrganizerImageFields } from "@/components/admin/become-organizer-image-fields";
import { BecomeOrganizerSubmitButton } from "@/components/admin/become-organizer-submit-button";
import { AuthMessage } from "@/components/auth/auth-message";
import {
  becomeOrganizerPageSettingKey,
  defaultBecomeOrganizerPageContent,
  getBecomeOrganizerSection,
  parseBecomeOrganizerPageContent,
  type BecomeOrganizerBenefit,
  type BecomeOrganizerFaqItem,
} from "@/lib/become-organizer-page-content";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminBecomeOrganizerPageProps = {
  searchParams: Promise<{ message?: string }>;
};

const inputClass = "h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700";
const textareaClass = "min-h-28 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700";

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink/72">
      {label}
      {children}
    </label>
  );
}

function SectionHeader({ checkboxName, title, defaultChecked }: { checkboxName: string; title: string; defaultChecked: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="font-semibold text-midnight">{title}</h2>
      <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink/72">
        <input name={checkboxName} type="hidden" value="0" />
        <input className="size-4 rounded border-midnight/20" defaultChecked={defaultChecked} name={checkboxName} type="checkbox" value="1" />
        Vis sektion
      </label>
    </div>
  );
}

function CtaFields({ labelPrefix, namePrefix, primaryLabel, primaryHref }: { labelPrefix: string; namePrefix: string; primaryLabel: string; primaryHref: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label={`${labelPrefix} tekst`}>
        <input className={inputClass} defaultValue={primaryLabel} name={`${namePrefix}Label`} />
      </Field>
      <Field label={`${labelPrefix} link`}>
        <input className={inputClass} defaultValue={primaryHref} name={`${namePrefix}Href`} />
      </Field>
    </div>
  );
}

function padBenefits(items: BecomeOrganizerBenefit[]) {
  return Array.from({ length: 8 }, (_, index) => items[index] ?? { title: "", text: "" });
}

function padFaq(items: BecomeOrganizerFaqItem[]) {
  return Array.from({ length: 8 }, (_, index) => items[index] ?? { question: "", answer: "" });
}

export default async function AdminBecomeOrganizerPage({ searchParams }: AdminBecomeOrganizerPageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = await createClient();
  const { data: setting } = await supabase.from("site_settings").select("value").eq("key", becomeOrganizerPageSettingKey).maybeSingle();
  const content = parseBecomeOrganizerPageContent(setting?.value);

  const hero = getBecomeOrganizerSection(content, "hero", "hero") ?? getBecomeOrganizerSection(defaultBecomeOrganizerPageContent, "hero", "hero");
  const introText =
    getBecomeOrganizerSection(content, "intro-text", "text") ?? getBecomeOrganizerSection(defaultBecomeOrganizerPageContent, "intro-text", "text");
  const introImage =
    getBecomeOrganizerSection(content, "intro-image", "image") ?? getBecomeOrganizerSection(defaultBecomeOrganizerPageContent, "intro-image", "image");
  const benefits =
    getBecomeOrganizerSection(content, "benefits", "benefits") ?? getBecomeOrganizerSection(defaultBecomeOrganizerPageContent, "benefits", "benefits");
  const video = getBecomeOrganizerSection(content, "video", "video") ?? getBecomeOrganizerSection(defaultBecomeOrganizerPageContent, "video", "video");
  const faq = getBecomeOrganizerSection(content, "faq", "faq") ?? getBecomeOrganizerSection(defaultBecomeOrganizerPageContent, "faq", "faq");
  const cta = getBecomeOrganizerSection(content, "final-cta", "cta") ?? getBecomeOrganizerSection(defaultBecomeOrganizerPageContent, "final-cta", "cta");

  if (!hero || !introText || !introImage || !benefits || !video || !faq || !cta) {
    throw new Error("Bliv arrangør-indholdet kunne ikke indlæses.");
  }

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <FileText className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator · Indhold</p>
              <h1 className="text-xl font-semibold text-midnight">Bliv arrangør</h1>
            </div>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href="/admin"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />

        <section className="rounded-card border border-sage-700/15 bg-sage-50 p-5 text-sm leading-6 text-ink/70">
          Rediger den permanente landingsside “Bliv arrangør”. Alt indhold hentes fra databasen og kan ændres her uden kodeændringer.
        </section>

        <form action={updateBecomeOrganizerPageContentAction} className="grid gap-6">
          <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="font-semibold text-midnight">SEO</h2>
            <Field label="SEO-titel">
              <input className={inputClass} defaultValue={content.seoTitle} name="seoTitle" />
            </Field>
            <Field label="SEO-beskrivelse">
              <textarea className={textareaClass} defaultValue={content.seoDescription} name="seoDescription" />
            </Field>
          </section>

          <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <SectionHeader checkboxName="heroIsEnabled" defaultChecked={hero.isEnabled} title="Hero" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Eyebrow">
                <input className={inputClass} defaultValue={hero.eyebrow} name="heroEyebrow" />
              </Field>
              <Field label="Overskrift">
                <input className={inputClass} defaultValue={hero.title} name="heroTitle" />
              </Field>
            </div>
            <Field label="Tekst">
              <textarea className={textareaClass} defaultValue={hero.text} name="heroText" />
            </Field>
            <CtaFields labelPrefix="Primær CTA" namePrefix="heroPrimaryCta" primaryHref={hero.primaryCta.href} primaryLabel={hero.primaryCta.label} />
            <CtaFields labelPrefix="Sekundær CTA" namePrefix="heroSecondaryCta" primaryHref={hero.secondaryCta.href} primaryLabel={hero.secondaryCta.label} />
          </section>

          <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <SectionHeader checkboxName="introTextIsEnabled" defaultChecked={introText.isEnabled} title="Tekstsektion" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Eyebrow">
                <input className={inputClass} defaultValue={introText.eyebrow} name="introTextEyebrow" />
              </Field>
              <Field label="Overskrift">
                <input className={inputClass} defaultValue={introText.title} name="introTextTitle" />
              </Field>
            </div>
            <Field label="Tekst">
              <textarea className={textareaClass} defaultValue={introText.text} name="introTextText" />
            </Field>
          </section>

          <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <SectionHeader checkboxName="introImageIsEnabled" defaultChecked={introImage.isEnabled} title="Billedsektion" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Eyebrow">
                <input className={inputClass} defaultValue={introImage.eyebrow} name="introImageEyebrow" />
              </Field>
              <Field label="Overskrift">
                <input className={inputClass} defaultValue={introImage.title} name="introImageTitle" />
              </Field>
            </div>
            <Field label="Tekst">
              <textarea className={textareaClass} defaultValue={introImage.text} name="introImageText" />
            </Field>
            <Field label="Billedplacering">
              <select className={inputClass} defaultValue={introImage.imagePosition} name="introImagePosition">
                <option value="right">Højre</option>
                <option value="left">Venstre</option>
              </select>
            </Field>
          </section>

          <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <SectionHeader checkboxName="benefitsIsEnabled" defaultChecked={benefits.isEnabled} title="Fordele" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Eyebrow">
                <input className={inputClass} defaultValue={benefits.eyebrow} name="benefitsEyebrow" />
              </Field>
              <Field label="Overskrift">
                <input className={inputClass} defaultValue={benefits.title} name="benefitsTitle" />
              </Field>
            </div>
            <Field label="Intro-tekst">
              <textarea className={textareaClass} defaultValue={benefits.text} name="benefitsText" />
            </Field>
            <div className="grid gap-3">
              {padBenefits(benefits.items).map((item, index) => (
                <div className="grid gap-3 rounded-md border border-midnight/10 bg-[#fbfaf7] p-4 md:grid-cols-[0.8fr_1.2fr]" key={index}>
                  <Field label={`Fordel ${index + 1} · titel`}>
                    <input className={inputClass} defaultValue={item.title} name={`benefit${index}Title`} />
                  </Field>
                  <Field label={`Fordel ${index + 1} · tekst`}>
                    <input className={inputClass} defaultValue={item.text} name={`benefit${index}Text`} />
                  </Field>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <SectionHeader checkboxName="videoIsEnabled" defaultChecked={video.isEnabled} title="Video" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Eyebrow">
                <input className={inputClass} defaultValue={video.eyebrow} name="videoEyebrow" />
              </Field>
              <Field label="Overskrift">
                <input className={inputClass} defaultValue={video.title} name="videoTitle" />
              </Field>
            </div>
            <Field label="Tekst">
              <textarea className={textareaClass} defaultValue={video.text} name="videoText" />
            </Field>
            <Field label="YouTube- eller Vimeo-link">
              <input className={inputClass} defaultValue={video.videoUrl} name="videoUrl" placeholder="https://www.youtube.com/watch?v=..." />
            </Field>
          </section>

          <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <SectionHeader checkboxName="faqIsEnabled" defaultChecked={faq.isEnabled} title="FAQ" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Eyebrow">
                <input className={inputClass} defaultValue={faq.eyebrow} name="faqEyebrow" />
              </Field>
              <Field label="Overskrift">
                <input className={inputClass} defaultValue={faq.title} name="faqTitle" />
              </Field>
            </div>
            <div className="grid gap-3">
              {padFaq(faq.items).map((item, index) => (
                <div className="grid gap-3 rounded-md border border-midnight/10 bg-[#fbfaf7] p-4" key={index}>
                  <Field label={`FAQ ${index + 1} · spørgsmål`}>
                    <input className={inputClass} defaultValue={item.question} name={`faq${index}Question`} />
                  </Field>
                  <Field label={`FAQ ${index + 1} · svar`}>
                    <textarea className={textareaClass} defaultValue={item.answer} name={`faq${index}Answer`} />
                  </Field>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <SectionHeader checkboxName="ctaIsEnabled" defaultChecked={cta.isEnabled} title="CTA nederst" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Eyebrow">
                <input className={inputClass} defaultValue={cta.eyebrow} name="ctaEyebrow" />
              </Field>
              <Field label="Overskrift">
                <input className={inputClass} defaultValue={cta.title} name="ctaTitle" />
              </Field>
            </div>
            <Field label="Tekst">
              <textarea className={textareaClass} defaultValue={cta.text} name="ctaText" />
            </Field>
            <CtaFields labelPrefix="Primær CTA" namePrefix="ctaPrimaryCta" primaryHref={cta.primaryCta.href} primaryLabel={cta.primaryCta.label} />
            <CtaFields labelPrefix="Sekundær CTA" namePrefix="ctaSecondaryCta" primaryHref={cta.secondaryCta.href} primaryLabel={cta.secondaryCta.label} />
          </section>

          <BecomeOrganizerImageFields content={content} />

          <div className="flex flex-col gap-3 rounded-card border border-midnight/10 bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink/64">Gemmer alle sektioner, FAQ, CTA’er, video og billeder for den offentlige landingsside.</p>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex h-11 items-center justify-center gap-2 rounded-button border border-midnight/15 bg-white px-5 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                href="/bliv-arrangoer"
                target="_blank"
              >
                Se offentlig side
                <ExternalLink className="size-4" aria-hidden="true" />
              </Link>
              <BecomeOrganizerSubmitButton />
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
