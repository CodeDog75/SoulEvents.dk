import Link from "next/link";
import { ArrowLeft, CalendarPlus, HeartHandshake, MailCheck, MapPinned, Search, Sparkles, UserPlus } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooterLogin } from "@/components/site-footer-login";
import { aboutPageSettingKey, parseAboutPageContent, type AboutImageKey } from "@/lib/about-page-content";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function publicMediaUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null) {
  return path ? supabase.storage.from("media").getPublicUrl(path).data.publicUrl : null;
}

function TextBody({ className = "", text }: { className?: string; text: string }) {
  if (!text) return null;

  return (
    <div className={"space-y-4 whitespace-pre-line text-base leading-8 text-ink/70 " + className}>
      {text}
    </div>
  );
}

function StorySection({
  imageKey,
  imagePosition = "right",
  imageTone = "default",
  supabase,
  text,
  title,
  images,
}: {
  imageKey?: AboutImageKey;
  imagePosition?: "left" | "right";
  imageTone?: "default" | "prominent";
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
    <div className={imagePosition === "left" ? "lg:order-2" : ""}>
      <h2 className="text-3xl font-medium leading-tight text-olive sm:text-4xl">{title}</h2>
      <TextBody className="mt-4 max-w-[62ch]" text={text} />
    </div>
  );
  const imageBlock = imageUrl ? (
    <div className={(imagePosition === "left" ? "lg:order-1 " : "") + "overflow-hidden rounded-[24px] bg-sage-50 shadow-soft"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={image?.alt || title}
        className={(imageTone === "prominent" ? "aspect-[16/10]" : "aspect-[16/11]") + " w-full object-cover"}
        src={imageUrl}
      />
    </div>
  ) : null;

  return (
    <section
      className={
        "grid gap-7 rounded-[28px] bg-white p-6 shadow-soft sm:p-8 lg:items-center " +
        (imageTone === "prominent" ? "lg:grid-cols-[1fr_1.08fr]" : "lg:grid-cols-[1.08fr_0.92fr]")
      }
    >
      {textBlock}
      {imageBlock}
    </section>
  );
}

function HowItWorksSection({ text, title }: { text: string; title: string }) {
  if (!title && !text) return null;

  const steps = [
    { icon: UserPlus, title: "Opret gratis arrangørprofil" },
    { icon: CalendarPlus, title: "Del events og ydelser" },
    { icon: MailCheck, title: "Modtag tilmeldinger og e-mailbeskeder" },
    { icon: Search, title: "Bliv fundet via kort og søgning" },
  ];

  return (
    <section className="rounded-[28px] bg-white p-6 shadow-soft sm:p-8">
      <div className="grid gap-7 lg:grid-cols-[1.18fr_0.82fr] lg:items-start">
        <div>
          <h2 className="text-3xl font-medium leading-tight text-olive sm:text-4xl">{title}</h2>
          <TextBody className="mt-4 max-w-[72ch]" text={text} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div className="flex items-center gap-3 rounded-[18px] border border-sage-700/10 bg-[#FAF6EF] px-4 py-3" key={step.title}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#EDE4F7] text-[#7A4EAB]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold leading-5 text-[#2F2633]">{step.title}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ValuesSection({ text, title }: { text: string; title: string }) {
  if (!title && !text) return null;

  const values = [
    { title: "Tillid", text: "Trygge rammer for både deltagere og arrangører." },
    { title: "Gennemsigtighed", text: "Klare oplysninger, relevante annoncer og en sund drift af platformen." },
    { title: "Ro", text: "Et overskueligt univers med god luft og respekt for valget." },
    { title: "Respekt", text: "Plads til forskellige mennesker, praksisser og veje ind i fællesskabet." },
  ];

  return (
    <section className="rounded-[28px] bg-white p-6 shadow-soft sm:p-8">
      <div className="max-w-[78ch]">
        <h2 className="text-3xl font-medium leading-tight text-olive sm:text-4xl">{title}</h2>
        <TextBody className="mt-4" text={text} />
      </div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        {values.map((value) => (
          <div className="border-t border-sage-700/15 pt-4" key={value.title}>
            <h3 className="text-xl font-medium text-[#2F2633]">{value.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/68">{value.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EditorialSection() {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-soft sm:p-8">
      <div className="max-w-[78ch]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">SoulEvents Redaktion</p>
        <h2 className="mt-3 text-3xl font-medium leading-tight text-olive sm:text-4xl">Redaktionel hjælp og sparring</h2>
        <div className="mt-4 space-y-4 text-base leading-8 text-ink/70">
          <p>
            Hos SoulEvents tror vi på, at inspirerende beskrivelser, smukke billeder og et klart, nærværende sprog gør det lettere for mennesker at
            finde de events, fællesskaber og ydelser, der passer til dem.
          </p>
          <p>
            Derfor tilbyder vi gerne mindre redaktionelle forbedringer af arrangørprofiler, events og ydelser. Det kan eksempelvis være hjælp til
            sproglig finpudsning, struktur, billedbeskæring eller mindre designmæssige tilpasninger, så indholdet fremstår indbydende, professionelt
            og i harmoni med SoulEvents&apos; visuelle identitet.
          </p>
          <p>
            Vi foretager altid sådanne forbedringer med respekt for arrangørens budskab, faglighed og indhold og uden at ændre indholdets væsentlige
            betydning.
          </p>
          <p>Har du brug for sparring eller hjælp til at præsentere dine events eller ydelser bedst muligt, er du altid velkommen til at kontakte os.</p>
          <p>
            Mindre redaktionelle forbedringer er som udgangspunkt en del af servicen. Ønsker du derimod større designopgaver, omfattende
            tekstbearbejdning eller anden individuel opsætning, kan dette tilbydes mod et nærmere aftalt honorar. Eventuelle omkostninger aftales altid
            med dig på forhånd.
          </p>
        </div>
      </div>
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
      <section className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 sm:py-12">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-olive transition hover:text-rose" href="/">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tilbage til forsiden
        </Link>

        <div className="mt-8 grid gap-8 rounded-[28px] bg-white p-6 shadow-soft sm:p-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
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
            <TextBody className="mt-4 max-w-[68ch]" text={content.introduction} />
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
          <StorySection imageKey="story" imageTone="prominent" images={content.images} supabase={supabase} text={content.storyText} title={content.storyTitle} />
          <EditorialSection />
          <HowItWorksSection text={content.howText} title={content.howTitle} />
          <ValuesSection text={content.valuesText} title={content.valuesTitle} />
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
