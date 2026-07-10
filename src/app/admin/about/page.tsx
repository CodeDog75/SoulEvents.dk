import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { updateAboutPageContentAction } from "@/app/admin/about/actions";
import { AboutImageFields } from "@/components/admin/about-image-fields";
import { AboutSubmitButton } from "@/components/admin/about-submit-button";
import { AuthMessage } from "@/components/auth/auth-message";
import { aboutPageSettingKey, parseAboutPageContent } from "@/lib/about-page-content";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminAboutPageProps = {
  searchParams: Promise<{ message?: string }>;
};

const textSections = [
  { titleKey: "whyTitle", textKey: "whyText", label: "Hvorfor eksisterer SoulEvents?" },
  { titleKey: "visionTitle", textKey: "visionText", label: "Vores vision" },
  { titleKey: "storyTitle", textKey: "storyText", label: "Historien om os" },
  { titleKey: "howTitle", textKey: "howText", label: "Sådan fungerer SoulEvents" },
  { titleKey: "valuesTitle", textKey: "valuesText", label: "Vores værdier" },
] as const;

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink/72">
      {label}
      {children}
    </label>
  );
}

export default async function AdminAboutPage({ searchParams }: AdminAboutPageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = await createClient();
  const { data: setting } = await supabase.from("site_settings").select("value").eq("key", aboutPageSettingKey).maybeSingle();
  const content = parseAboutPageContent(setting?.value);

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <FileText className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Om SoulEvents</h1>
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
          Rediger den offentlige side “Om SoulEvents”. Hvis enkelte felter står tomme, bruger den offentlige side rolige
          standardtekster, så der ikke opstår tomme sektioner.
        </section>

        <form action={updateAboutPageContentAction} className="grid gap-6" encType="multipart/form-data">
          <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="font-semibold text-midnight">Topsektion</h2>
            <Field label="Sidens hovedoverskrift">
              <input
                className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                defaultValue={content.headline}
                name="headline"
              />
            </Field>
            <Field label="Introduktion">
              <textarea
                className="min-h-32 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700"
                defaultValue={content.introduction}
                name="introduction"
              />
            </Field>
          </section>

          <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="font-semibold text-midnight">Fortællende sektioner</h2>
            {textSections.map((section) => (
              <div className="grid gap-3 rounded-md border border-midnight/10 bg-[#fbfaf7] p-4" key={section.textKey}>
                <Field label={section.label + " · overskrift"}>
                  <input
                    className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                    defaultValue={content[section.titleKey]}
                    name={section.titleKey}
                  />
                </Field>
                <Field label={section.label + " · tekst"}>
                  <textarea
                    className="min-h-36 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700"
                    defaultValue={content[section.textKey]}
                    name={section.textKey}
                  />
                </Field>
              </div>
            ))}
          </section>

          <section className="grid gap-4 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="font-semibold text-midnight">CTA nederst</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="CTA-overskrift">
                <input
                  className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                  defaultValue={content.ctaTitle}
                  name="ctaTitle"
                />
              </Field>
              <Field label="CTA-knaptekst">
                <input
                  className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                  defaultValue={content.ctaButtonText}
                  name="ctaButtonText"
                />
              </Field>
            </div>
            <Field label="CTA-tekst">
              <textarea
                className="min-h-28 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700"
                defaultValue={content.ctaText}
                name="ctaText"
              />
            </Field>
            <Field label="CTA-link">
              <input
                className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
                defaultValue={content.ctaButtonLink}
                name="ctaButtonLink"
              />
            </Field>
          </section>

          <AboutImageFields images={content.images} />

          <div className="flex flex-col gap-3 rounded-card border border-midnight/10 bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink/64">Gemmer både tekster og billeder for den offentlige “Om SoulEvents”-side.</p>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex h-11 items-center justify-center rounded-button border border-midnight/15 bg-white px-5 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                href="/about"
                target="_blank"
              >
                Se offentlig side
              </Link>
              <AboutSubmitButton />
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
