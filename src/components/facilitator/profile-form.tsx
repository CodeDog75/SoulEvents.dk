"use client";

import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Camera,
  Circle,
  CreditCard,
  Dumbbell,
  ExternalLink,
  Flame,
  Flower2,
  Globe,
  HandHeart,
  Heart,
  HeartHandshake,
  ImagePlus,
  Info,
  Leaf,
  Link2,
  Moon,
  Music,
  PartyPopper,
  PencilLine,
  Sparkles,
  Sun,
  Upload,
  Video,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { resolveNameParts } from "@/lib/auth/names";
import {
  autosaveFacilitatorProfileAction,
  saveFacilitatorMoodImageAction,
  saveFacilitatorProfileImageAction,
  submitFacilitatorProfileForReviewAction,
} from "@/app/facilitator/profile/actions";
import { imageUploadAccept, prepareImageFileForUpload } from "@/lib/images/client-image-upload";
import { OnboardingShell as SharedOnboardingShell } from "@/components/onboarding/onboarding-shell";
import { SoulEventsIdTag } from "@/components/facilitator/soulevents-id-tag";
import type { BrandLogoSources } from "@/lib/brand-logo";
import {
  defaultFacilitatorHeroKey,
  facilitatorHeroOptions,
  isMoodHeroKey,
  normalizeFacilitatorHeroKey,
  resolveFacilitatorHero,
  type FacilitatorHeroKey,
} from "@/lib/facilitators/hero-collection";
import { facilitatorStoryMinLength, normalizeFacilitatorStory } from "@/lib/facilitators/profile-readiness";
import { facilitatorWorkAreas, sortFacilitatorWorkAreas } from "@/lib/facilitators/work-areas";
import { publicFacilitatorPath } from "@/lib/slug";
import { socialProfileLinkHelpText, socialProfileLinkPlaceholder, validateSocialProfileLink } from "@/lib/social-profile-links";

type Region = {
  id: string;
  name: string;
  slug: string;
};

type Category = {
  description?: string | null;
  id: string;
  name: string;
  slug?: string | null;
};

type FacilitatorProfile = {
  id?: string | null;
  slug?: string | null;
  status?: string | null;
  company_name: string | null;
  facilitator_hero_key?: string | null;
  host_reference_id?: string | null;
  profile_image_path: string | null;
  short_description: string | null;
  long_description: string | null;
  public_email?: string | null;
  public_phone?: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  youtube_url?: string | null;
  tiktok_url?: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  country?: string | null;
  is_online_facilitator?: boolean | null;
  region_id: string | null;
  payment_mobilepay_number?: string | null;
  payment_bank_registration_number?: string | null;
  payment_bank_account_number?: string | null;
  payment_bank_account_name?: string | null;
  payment_external_url?: string | null;
  payment_instructions?: string | null;
  payment_deadline_days?: number | null;
  offers_services?: boolean | null;
  service_description?: string | null;
  specialties?: string | null;
  show_in_local_service_results?: boolean | null;
};

type GalleryImage = {
  image_path: string;
  alt_text: string | null;
} | null;

type ProfileFormProps = {
  adminReturnTo?: string | null;
  adminTargetFacilitatorId?: string | null;
  autosaveEnabled?: boolean;
  backHref?: string;
  backLabel?: string;
  errorSection?: string | null;
  feedbackMessage?: string | null;
  logoSources?: BrandLogoSources;
  profile: {
    first_name?: string | null;
    full_name: string;
    last_name?: string | null;
    email: string;
    phone: string | null;
  };
  presentationMode?: "admin" | "editing" | "onboarding";
  showEmailConfirmedStep?: boolean;
  facilitatorProfile: FacilitatorProfile;
  regions: Region[];
  categories: Category[];
  selectedCategoryIds: string[];
  galleryImages: GalleryImage[];
  savedSection?: string | null;
  submitLabel?: string;
};

type PrototypeStep =
  | "welcome"
  | "account"
  | "person"
  | "profile-image"
  | "experiences"
  | "story"
  | "links"
  | "payment"
  | "services"
  | "review"
  | "approval"
  | "complete";

type MoodImage = {
  fileName: string;
  path: string;
  previewUrl: string;
};

type SlotStatus = {
  message: string;
  status: "error" | "idle" | "saving" | "success";
};

const moodImageMaxFileSize = 15 * 1024 * 1024;

function sortedByDanishName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "da-DK"));
}

function workAreaIconForName(name: string): LucideIcon {
  const normalized = name.toLowerCase();
  if (normalized.includes("yoga") || normalized.includes("krop")) return Dumbbell;
  if (normalized.includes("meditation") || normalized.includes("mindfulness")) return Moon;
  if (normalized.includes("healing") || normalized.includes("energi")) return Sparkles;
  if (normalized.includes("sauna") || normalized.includes("ild")) return Flame;
  if (normalized.includes("lyd") || normalized.includes("musik")) return Music;
  if (normalized.includes("natur") || normalized.includes("retreat")) return Leaf;
  if (normalized.includes("ceremoni") || normalized.includes("ritual")) return Flower2;
  if (normalized.includes("terapi") || normalized.includes("coaching")) return Brain;
  if (normalized.includes("åndedræt") || normalized.includes("breath")) return Waves;
  if (normalized.includes("hjerte") || normalized.includes("relation")) return Heart;
  if (normalized.includes("sol") || normalized.includes("lys")) return Sun;
  return HandHeart;
}

function workAreaDescriptionForCategory(category: Category) {
  if (category.description) return category.description;
  const workArea = facilitatorWorkAreas.find((area) => area.slug === category.slug);
  return workArea?.examples.join(", ") ?? null;
}

const steps: Array<{
  eyebrow: string;
  id: PrototypeStep;
  title: string;
  text: string;
}> = [
  {
    eyebrow: "Velkommen",
    id: "welcome",
    text: "Vi hjælper dig trin for trin med at skabe en profil, hvor deltagerne kan lære dig og dine begivenheder at kende.",
    title: "Lad os skabe din SoulEvents-profil",
  },
  {
    eyebrow: "Konto oprettet",
    id: "account",
    text: "Perfekt. Din konto er nu oprettet. Nu hjælper vi dig trin for trin med at opbygge din arrangørprofil. Det tager kun få minutter.",
    title: "Din e-mail er bekræftet.",
  },
  {
    eyebrow: "Navn",
    id: "person",
    text: "Dit rigtige navn er kun synligt for SoulEvents. Som udgangspunkt vises dit rigtige navn på din offentlige profil, men du kan vælge et andet profilnavn.",
    title: "Hvem står bag profilen?",
  },
  {
    eyebrow: "Billeder",
    id: "profile-image",
    text: "Tilføj et obligatorisk profilbillede og op til tre stemningsbilleder, der viser dig og det, du inviterer mennesker ind i.",
    title: "Gør din profil levende.",
  },
  {
    eyebrow: "Arbejdsområder",
    id: "experiences",
    text: "Vælg de områder, der bedst beskriver dit arbejde. Du kan også tilføje dit konkrete speciale.",
    title: "Hvilke områder arbejder du med?",
  },
  {
    eyebrow: "Din fortælling",
    id: "story",
    text: "Fortæl lidt mere om dig, din baggrund og det, du ønsker at skabe for dine deltagere. Din fortælling hjælper nye besøgende med at lære dig at kende og føle sig trygge ved at vælge dig. En personlig og fyldig tekst giver samtidig søgemaskiner og AI et bedre grundlag for at forstå din profil og kan derfor styrke din synlighed.",
    title: "Din fortælling · Obligatorisk",
  },
  {
    eyebrow: "Forbindelse",
    id: "links",
    text: "Se din loginmail, og vedligehold telefonnummer og de links, deltagere må bruge.",
    title: "Kontaktoplysninger",
  },
  {
    eyebrow: "Betaling",
    id: "payment",
    text: "Gem dine standardbetalingsoplysninger. De sendes først til deltageren, når du bekræfter en tilmelding.",
    title: "Standardbetaling for dine events",
  },
  {
    eyebrow: "Ydelser",
    id: "services",
    text: "Så kan du blive vist på SoulEvents under “Ydelser”, så deltagere også kan finde og kontakte dig uden for dine events.",
    title: "Tilbyder du også individuelle ydelser?",
  },
  {
    eyebrow: "Gennemse",
    id: "review",
    text: "Et første glimt af den profil, deltagerne skal møde.",
    title: "Se din profil tage form.",
  },
  {
    eyebrow: "Klar",
    id: "approval",
    text: "Du kan sende profilen til SoulEvents nu eller gemme den som kladde og fortsætte senere. Når du sender den, gennemgår vi profilen og giver dig besked, så snart den er klar.",
    title: "Er din profil klar til at blive vist offentligt på SoulEvents?",
  },
  {
    eyebrow: "Velkommen",
    id: "complete",
    text: "Din arrangørprofil er nu oprettet og sendt til gennemgang.",
    title: "Vi er glade for at byde dig velkommen til SoulEvents.",
  },
];

const onboardingStepIds: PrototypeStep[] = ["person", "profile-image", "experiences", "story", "links", "services", "review", "approval", "complete"];
const editingStepIds: PrototypeStep[] = ["review", "person", "profile-image", "experiences", "story", "links", "services"];
const onboardingDraftStepStorageKeyBase = "soulevents:onboarding:last-step";
const specialtyMaxLength = 180;

function value(input: string | null | undefined) {
  return input ?? "";
}

function normalizeSpecialtyText(input: string | null | undefined) {
  return value(input).replace(/\s+/g, " ").trim();
}

function publicImageUrl(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return supabaseUrl && path ? `${supabaseUrl}/storage/v1/object/public/media/${path}` : "";
}

function inputClass(extra = "") {
  return "min-h-14 w-full rounded-[18px] border border-midnight/10 bg-white px-5 text-lg text-midnight shadow-soft outline-none transition duration-200 placeholder:text-ink/35 focus:border-sage-700 focus:ring-4 focus:ring-sage-700/10 " + extra;
}

function workAreaClass(selected: boolean, isLong = false) {
  return (
    "flex min-h-16 items-center justify-between gap-3 rounded-[22px] border px-3.5 py-3 text-left text-base font-semibold shadow-soft transition duration-200 hover:scale-[1.01] hover:border-sage-700 sm:px-4 " +
    (selected ? "border-sage-700/25 bg-sage-50 text-sage-700" : "border-midnight/10 bg-white text-midnight") +
    (isLong ? " md:col-span-2" : "")
  );
}

function SelectionCardContent({
  description,
  Icon,
  label,
  onInfoToggle,
  showInfo,
  selected,
}: {
  description?: string | null;
  Icon: LucideIcon;
  label: string;
  onInfoToggle?: () => void;
  showInfo?: boolean;
  selected: boolean;
}) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex min-w-0 items-center gap-3">
          <Icon
            aria-hidden="true"
            className={selected ? "size-5 shrink-0 text-sage-700" : "size-5 shrink-0 text-sage-700/55"}
          />
          <span className="min-w-0 whitespace-normal break-words text-left leading-snug">{label}</span>
          {description ? (
            <span
              aria-label={"Se eksempler for " + label}
              className="ml-auto grid size-8 shrink-0 place-items-center rounded-full text-sage-700/65 transition hover:bg-sage-50 hover:text-sage-700"
              onClick={(event) => {
                event.stopPropagation();
                onInfoToggle?.();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onInfoToggle?.();
                }
              }}
              role="button"
              tabIndex={0}
              title={description}
            >
              <Info className="size-4" aria-hidden="true" />
            </span>
          ) : null}
        </span>
        {description && showInfo ? (
          <span className="rounded-[14px] border border-sage-700/10 bg-white/80 px-3 py-2 text-left text-xs font-medium leading-5 text-ink/62">
            {description}
          </span>
        ) : null}
      </span>
      <Circle className={selected ? "ml-2 size-4 shrink-0 fill-sage-700/15 text-sage-700" : "ml-2 size-4 shrink-0 text-sage-700/45"} aria-hidden="true" />
    </>
  );
}

function ClearableInput({
  className = "",
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  className?: string;
  label?: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const input = (
    <div className="relative">
      <input
        className={inputClass("pr-12 " + className)}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {value ? (
        <button
          aria-label="Ryd felt"
          className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink/38 transition hover:bg-midnight/5 hover:text-midnight"
          onClick={() => onChange("")}
          type="button"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  if (!label) return input;

  return (
    <label className="grid gap-2 text-sm font-semibold text-ink/65">
      {label}
      {input}
    </label>
  );
}

function ClearableTextarea({
  className = "",
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  className?: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <div className="relative">
      <textarea
        className={inputClass("resize-none overflow-hidden py-4 pr-12 leading-7 " + className)}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        ref={textareaRef}
        rows={1}
        value={value}
      />
      {value ? (
        <button
          aria-label="Ryd felt"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-ink/38 transition hover:bg-midnight/5 hover:text-midnight"
          onClick={() => onChange("")}
          type="button"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function displayLink(input: string) {
  return input.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

function ReviewJump({
  children,
  className = "",
  label,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <section
      aria-label={label}
      className={
        "group relative block w-full min-w-0 cursor-pointer rounded-[24px] text-left transition hover:bg-white/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 " +
        className
      }
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <EditIndicator />
      {children}
    </section>
  );
}

function EditIndicator() {
  return (
    <span
      className="pointer-events-none absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full border border-white/70 bg-white/70 text-ink/55 opacity-80 shadow-soft backdrop-blur-md transition group-hover:bg-white/88 group-hover:text-midnight group-hover:opacity-100 group-focus-visible:bg-white group-focus-visible:text-midnight group-focus-visible:opacity-100 sm:size-10"
      aria-hidden="true"
    >
      <PencilLine className="size-4" />
    </span>
  );
}

function LinkRows({
  facebook,
  instagram,
  website,
  youtube,
}: {
  facebook: string;
  instagram: string;
  website: string;
  youtube: string;
}) {
  const websiteValue = website.trim();
  const facebookValue = facebook.trim();
  const instagramValue = instagram.trim();
  const youtubeValue = youtube.trim();
  const links = [
    websiteValue ? { icon: Globe, label: "Hjemmeside", text: displayLink(websiteValue) } : null,
    facebookValue ? { icon: Link2, label: "Facebook", text: displayLink(facebookValue) } : null,
    instagramValue ? { icon: Camera, label: "Instagram", text: displayLink(instagramValue) } : null,
    youtubeValue ? { icon: Video, label: "YouTube", text: displayLink(youtubeValue) } : null,
  ].filter((item): item is { icon: typeof Globe; label: string; text: string } => Boolean(item));

  if (links.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[24px] bg-white/65">
      {links.map((item, index) => {
        const Icon = item.icon;
        return (
          <div
            className={
              "grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 text-sm font-semibold text-midnight transition hover:bg-white " +
              (index > 0 ? "border-t border-midnight/10" : "")
            }
            key={item.label}
          >
            <Icon className="size-4 text-sage-700" aria-hidden="true" />
            <span className="min-w-0 break-words">{item.text}</span>
            <ExternalLink className="size-4 text-ink/35" aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );
}

function OnboardingShell({
  backHref,
  backLabel,
  children,
  currentIndex,
  hideBackNavigation = false,
  hidePrimaryAction = false,
  isBusy,
  logoSources,
  onBack,
  onContinue,
  presentationMode = "editing",
  canContinue = true,
  ctaLabel,
  ctaHelper,
  footerLeading,
  onSaveDraft,
}: {
  backHref: string;
  backLabel: string;
  canContinue?: boolean;
  children: React.ReactNode;
  currentIndex: number;
  ctaLabel?: string;
  ctaHelper?: string;
  footerLeading?: React.ReactNode;
  hideBackNavigation?: boolean;
  hidePrimaryAction?: boolean;
  isBusy: boolean;
  logoSources?: BrandLogoSources;
  onBack: () => void;
  onContinue: () => void;
  onSaveDraft?: () => void;
  presentationMode?: "admin" | "editing" | "onboarding";
}) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    shellRef.current?.scrollTo({ top: 0, behavior: "auto" });
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [currentIndex]);

  const footer = hidePrimaryAction ? null : (
    <button
      className="inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-[999px] bg-midnight px-6 text-lg font-semibold text-white shadow-soft transition duration-200 hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-45 lg:min-h-12 lg:text-base xl:min-h-14"
      disabled={isBusy || !canContinue}
      onClick={onContinue}
      type="button"
    >
      {isBusy ? "Gemmer automatisk..." : ctaLabel ?? (isFirst ? "Kom i gang" : isLast ? "Opret profil" : "Fortsæt")}
      {!isBusy && <ArrowRight className="size-5" aria-hidden="true" />}
    </button>
  );

  const backNavigation = hideBackNavigation ? null : isFirst ? (
    <Link className="text-sm font-semibold text-ink/55 underline-offset-4 hover:text-sage-700 hover:underline" href={backHref}>
      {backLabel}
    </Link>
  ) : (
    <button className="inline-flex items-center gap-2 text-sm font-semibold text-ink/55 transition hover:text-sage-700" onClick={onBack} type="button">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Tilbage
    </button>
  );

  if (presentationMode === "onboarding") {
    return (
      <SharedOnboardingShell
        backNavigation={backNavigation}
        footer={
          footer ? (
            <>
              {footerLeading}
              {footer}
              {ctaHelper ? <p className="mt-3 text-left text-sm font-medium text-ink/55">{ctaHelper}</p> : null}
              {onSaveDraft ? (
                <button
                  className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-midnight/10 bg-white px-5 text-sm font-semibold text-sage-700 shadow-soft transition hover:border-sage-700/35 hover:bg-sage-50 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isBusy}
                  onClick={onSaveDraft}
                  type="button"
                >
                  Gem kladde og fortsæt senere
                </button>
              ) : null}
            </>
          ) : null
        }
        mode="profile"
        scrollKey={currentIndex}
        visualPanel={{
          logoSources,
          text: "En rolig vej ind til din profil, dine begivenheder og dit fællesskab.",
        }}
      >
        {children}
      </SharedOnboardingShell>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-[#fbfaf7] px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 lg:overflow-hidden lg:bg-[#E7DDE7] lg:px-8 lg:py-6 xl:py-8"
      ref={shellRef}
    >
      <div className="mx-auto grid min-h-[calc(100svh-3rem)] w-full max-w-[620px] content-between gap-8 lg:h-[calc(100dvh-48px)] lg:min-h-0 lg:max-w-[1040px] lg:grid-cols-[42%_58%] lg:content-stretch lg:gap-0 lg:overflow-hidden lg:rounded-[34px] lg:bg-[#fbfaf7] lg:shadow-[0_24px_70px_rgba(47,36,55,0.16)] xl:h-[calc(100dvh-64px)] xl:max-w-[1120px]">
        <div className="relative hidden h-full overflow-hidden bg-sage-700 lg:block" aria-hidden="true">
          <Image
            alt=""
            className="object-cover"
            fill
            priority
            sizes="(min-width: 1024px) 520px, 0px"
            src="/facilitator/onboarding-nature.png"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(47,36,55,0.18),rgba(47,36,55,0.38)),linear-gradient(90deg,rgba(151,161,132,0.16),rgba(231,221,231,0.12))]" />
        </div>

        <div className="grid min-h-[calc(100svh-3rem)] content-between gap-8 lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-5 lg:overflow-hidden lg:px-6 lg:py-6 xl:px-8 xl:py-7">
          <div className="grid gap-8 lg:min-h-0 lg:gap-5 lg:overflow-y-auto lg:pr-1" ref={contentScrollRef}>
            <div className="min-h-8">
              {hideBackNavigation ? null : isFirst ? (
                <Link className="text-sm font-semibold text-ink/55 underline-offset-4 hover:text-sage-700 hover:underline" href={backHref}>
                  {backLabel}
                </Link>
              ) : (
                <button className="inline-flex items-center gap-2 text-sm font-semibold text-ink/55 transition hover:text-sage-700" onClick={onBack} type="button">
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Tilbage
                </button>
              )}
            </div>

            <div className="rounded-[30px] bg-white px-5 py-8 shadow-soft transition-all duration-200 sm:px-8 sm:py-10 lg:rounded-none lg:bg-transparent lg:px-4 lg:py-5 lg:shadow-none xl:px-5 xl:py-6">
              {children}
            </div>
          </div>

          {hidePrimaryAction ? null : (
            <div className="pb-2">
              {footerLeading}
              {footer}
              {ctaHelper ? <p className="mt-3 text-left text-sm font-medium text-ink/55">{ctaHelper}</p> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIntro({ eyebrow, text, title }: { eyebrow: string; text: string; title: string }) {
  return (
    <div className="mb-8 grid gap-3 lg:mb-5 lg:gap-2">
      <p className="text-sm font-semibold uppercase tracking-wide text-sage-700 lg:text-xs">{eyebrow}</p>
      <h2 className="text-4xl font-semibold leading-tight text-midnight sm:text-5xl lg:text-3xl xl:text-4xl">{title}</h2>
      <p className="text-base leading-7 text-ink/64 lg:text-sm lg:leading-6">{text}</p>
    </div>
  );
}

function UploadTile({
  className = "",
  createPreview = true,
  imageUrl,
  helperText,
  label,
  maxFileSizeBytes,
  onError,
  onSelect,
}: {
  className?: string;
  createPreview?: boolean;
  helperText?: string;
  imageUrl: string;
  label: string;
  maxFileSizeBytes?: number;
  onError?: (message: string) => void;
  onSelect: (file: File, previewUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const prepared = await prepareImageFileForUpload(file, { maxFileSizeBytes });
      onSelect(prepared, createPreview ? URL.createObjectURL(prepared) : "");
    } catch (error) {
      event.target.value = "";
      onError?.(error instanceof Error ? error.message : "Billedet kunne ikke læses. Prøv et andet billede.");
    }
  }

  return (
    <button
      className={
        "group grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-[26px] border border-midnight/10 bg-sage-50 text-center shadow-soft transition duration-200 hover:border-sage-700 " +
        className
      }
      onClick={() => inputRef.current?.click()}
      type="button"
    >
      {imageUrl ? (
        <img alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" src={imageUrl} />
      ) : (
        <span className="grid justify-items-center gap-4 px-6">
          <span className="grid size-16 place-items-center rounded-full bg-white text-sage-700 shadow-soft">
            <Upload className="size-7" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold text-midnight">{label}</span>
          {helperText ? <span className="whitespace-pre-line text-sm font-medium leading-5 text-ink/55">{helperText}</span> : null}
        </span>
      )}
      <input accept={imageUploadAccept} className="sr-only" onChange={handleChange} ref={inputRef} type="file" />
    </button>
  );
}

function MissingCard({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className="w-full rounded-[22px] bg-[#FFF7DE] p-4 text-left text-sm font-semibold leading-6 text-[#715C21] transition hover:bg-[#FFF1C2]"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function isSvgSrc(src: string) {
  return src.split("?")[0]?.toLowerCase().endsWith(".svg") ?? false;
}

function InlineBrandLogo({ className, src }: { className: string; src: string }) {
  if (isSvgSrc(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="SoulEvents" className={className + " object-contain"} height={240} src={src} width={520} />;
  }

  return <Image alt="SoulEvents" className={className + " object-contain"} height={240} src={src} width={520} />;
}

export function ProfileForm({
  adminTargetFacilitatorId,
  adminReturnTo,
  autosaveEnabled = true,
  backHref = "/facilitator",
  backLabel = "Tilbage",
  presentationMode = "onboarding",
  showEmailConfirmedStep = false,
  profile,
  facilitatorProfile,
  categories,
  selectedCategoryIds,
  galleryImages,
  logoSources,
}: ProfileFormProps) {
  const router = useRouter();
  const names = resolveNameParts({
    firstName: profile.first_name,
    fullName: profile.full_name,
    lastName: profile.last_name,
  });
  const activeSteps =
    presentationMode === "onboarding"
      ? (showEmailConfirmedStep ? ["account", ...onboardingStepIds] : onboardingStepIds)
          .map((stepId) => steps.find((step) => step.id === stepId))
          .filter((step): step is (typeof steps)[number] => Boolean(step))
      : editingStepIds.map((stepId) => steps.find((step) => step.id === stepId)).filter((step): step is (typeof steps)[number] => Boolean(step));
  const activeStepIds = activeSteps.map((step) => step.id);
  const activeStepIdsKey = activeStepIds.join("|");
  const onboardingDraftStepStorageKey = `${onboardingDraftStepStorageKeyBase}:${facilitatorProfile.id ?? profile.email}`;
  const [stepIndex, setStepIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
  const [profileImageSubmissionError, setProfileImageSubmissionError] = useState(false);
  const [storySubmissionError, setStorySubmissionError] = useState(false);
  const continueInProgressRef = useRef(false);
  const continueTimeoutRef = useRef<number | null>(null);
  const restoredOnboardingStepRef = useRef(false);
  const [, startImageTransition] = useTransition();
  const [firstName, setFirstName] = useState(names.firstName);
  const [lastName, setLastName] = useState(names.lastName);
  const fullPublicName = [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" ");
  const initialProfileName = value(facilitatorProfile.company_name);
  const [useCustomProfileName, setUseCustomProfileName] = useState(() => Boolean(initialProfileName && initialProfileName !== fullPublicName));
  const [profileName, setProfileName] = useState(initialProfileName);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState(facilitatorProfile.profile_image_path ? publicImageUrl(facilitatorProfile.profile_image_path) : "");
  const [moodImages, setMoodImages] = useState<MoodImage[]>(
    Array.from({ length: 3 }, (_, index) => ({
      fileName: "",
      path: galleryImages[index]?.image_path ?? "",
      previewUrl: galleryImages[index]?.image_path ? publicImageUrl(galleryImages[index].image_path) : "",
    })),
  );
  const initialHeroKey = normalizeFacilitatorHeroKey(facilitatorProfile.facilitator_hero_key);
  const initialHeroHasMoodImage = galleryImages.some((image) => Boolean(image?.image_path));
  const [selectedHeroKey, setSelectedHeroKey] = useState<FacilitatorHeroKey>(
    initialHeroKey ?? (initialHeroHasMoodImage ? "mood_1" : defaultFacilitatorHeroKey),
  );
  const [moodImageStatuses, setMoodImageStatuses] = useState<SlotStatus[]>(
    Array.from({ length: 3 }, () => ({ message: "", status: "idle" })),
  );
  const visibleCategoryIds = new Set(categories.map((category) => category.id));
  const initialSelectedCategoryIds = selectedCategoryIds.filter((categoryId) => visibleCategoryIds.has(categoryId));
  const [selectedExperiences, setSelectedExperiences] = useState(initialSelectedCategoryIds);
  const [story, setStory] = useState(value(facilitatorProfile.long_description || facilitatorProfile.short_description));
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [website, setWebsite] = useState(value(facilitatorProfile.website_url));
  const [facebook, setFacebook] = useState(value(facilitatorProfile.facebook_url));
  const [instagram, setInstagram] = useState(value(facilitatorProfile.instagram_url));
  const [youtube, setYoutube] = useState(value(facilitatorProfile.youtube_url));
  const [paymentMobilepayNumber, setPaymentMobilepayNumber] = useState(value(facilitatorProfile.payment_mobilepay_number));
  const [paymentBankRegistrationNumber, setPaymentBankRegistrationNumber] = useState(value(facilitatorProfile.payment_bank_registration_number));
  const [paymentBankAccountNumber, setPaymentBankAccountNumber] = useState(value(facilitatorProfile.payment_bank_account_number));
  const [paymentBankAccountName, setPaymentBankAccountName] = useState(value(facilitatorProfile.payment_bank_account_name));
  const [paymentExternalUrl, setPaymentExternalUrl] = useState(value(facilitatorProfile.payment_external_url));
  const [paymentInstructions, setPaymentInstructions] = useState(value(facilitatorProfile.payment_instructions));
  const [paymentDeadlineDays, setPaymentDeadlineDays] = useState(String(facilitatorProfile.payment_deadline_days ?? 14));
  const [offersIndividualServices, setOffersIndividualServices] = useState(Boolean(facilitatorProfile.offers_services));
  const [serviceDescription, setServiceDescription] = useState(value(facilitatorProfile.service_description));
  const [specialties, setSpecialties] = useState(value(facilitatorProfile.specialties));
  const [openAreaInfoId, setOpenAreaInfoId] = useState<string | null>(null);
  const [stepSaveStatus, setStepSaveStatus] = useState<SlotStatus>({ message: "", status: "idle" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const currentStep = activeSteps[stepIndex] ?? activeSteps[0] ?? steps[0];
  const shellBackHref = presentationMode === "onboarding" ? "/auth/login" : backHref;
  const activeDesktopLogoSrc = logoSources?.desktop ?? "/brand/soulevents-logo.png";
  const displayedStep =
    presentationMode !== "onboarding" && currentStep.id === "review"
      ? {
          ...currentStep,
          eyebrow: "Rediger profil",
          text: "Tryk på det afsnit, du vil ændre. Dine eksisterende oplysninger er udfyldt.",
          title: "Rediger profil",
        }
      : currentStep;
  const publicProfileName = useCustomProfileName ? profileName.trim() : fullPublicName;
  const hasWorkArea = selectedExperiences.length > 0;
  const specialtyText = normalizeSpecialtyText(specialties);
  const hasIndividualServicesDescription = offersIndividualServices && serviceDescription.trim().length > 0;
  const hasPaymentDefaults = Boolean(
    paymentMobilepayNumber.trim() ||
      paymentBankRegistrationNumber.trim() ||
      paymentBankAccountNumber.trim() ||
      paymentExternalUrl.trim() ||
      paymentInstructions.trim(),
  );
  const facebookValidation = validateSocialProfileLink(facebook, "facebook");
  const instagramValidation = validateSocialProfileLink(instagram, "instagram");
  const facebookError = facebook.trim() && !facebookValidation.ok ? facebookValidation.message : null;
  const instagramError = instagram.trim() && !instagramValidation.ok ? instagramValidation.message : null;
  const hasLinks = Boolean(website.trim() || facebook.trim() || instagram.trim() || youtube.trim());
  const normalizedStory = normalizeFacilitatorStory(story);
  const storyMeetsMinimum = normalizedStory.length >= facilitatorStoryMinLength;
  const storyMissingMessage = "Skriv gerne lidt mere om dig selv, før profilen sendes til SoulEvents.";
  const missingRequired = [
    !firstName.trim() || !lastName.trim() ? { label: "Dit navn", step: "person" as PrototypeStep } : null,
    !publicProfileName ? { label: "Profilnavn", step: "person" as PrototypeStep } : null,
    !profileImageUrl ? { label: "Tilføj profilbillede", step: "profile-image" as PrototypeStep } : null,
    moodImages.every((image) => !image.previewUrl) ? { label: "Tilføj mindst ét stemningsbillede", step: "profile-image" as PrototypeStep } : null,
    !hasWorkArea ? { label: "Vælg mindst ét arbejdsområde", step: "experiences" as PrototypeStep } : null,
    !storyMeetsMinimum ? { label: "Gå til fortælling", step: "story" as PrototypeStep } : null,
  ].filter((item): item is { label: string; step: PrototypeStep } => Boolean(item));

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("confirmed");
    url.searchParams.set("prototypeStep", currentStep.id);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (presentationMode === "onboarding" && currentStep.id !== "complete") {
      window.localStorage.setItem(onboardingDraftStepStorageKey, currentStep.id);
    }
  }, [currentStep.id, onboardingDraftStepStorageKey, presentationMode]);

  useEffect(() => {
    if (presentationMode !== "onboarding" || restoredOnboardingStepRef.current) {
      return;
    }

    restoredOnboardingStepRef.current = true;
    const url = new URL(window.location.href);
    const requestedStep = url.searchParams.get("prototypeStep");
    const storedStep = window.localStorage.getItem(onboardingDraftStepStorageKey);
    const candidate = requestedStep || storedStep;
    const availableStepIds = activeStepIdsKey.split("|") as PrototypeStep[];
    const nextIndex = candidate ? availableStepIds.indexOf(candidate as PrototypeStep) : -1;

    if (nextIndex >= 0 && availableStepIds[nextIndex] !== "complete") {
      const frame = window.requestAnimationFrame(() => setStepIndex(nextIndex));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [activeStepIdsKey, onboardingDraftStepStorageKey, presentationMode]);

  useEffect(() => {
    return () => {
      if (continueTimeoutRef.current) {
        window.clearTimeout(continueTimeoutRef.current);
      }
    };
  }, []);

  const contactValues = {
    company_name: publicProfileName,
    first_name: firstName,
    full_name: fullPublicName,
    last_name: lastName,
    long_description: story,
    phone,
    short_description: story.trim().slice(0, 300),
  };

  async function saveCurrentStep({ submitForReview = true }: { submitForReview?: boolean } = {}) {
    const shouldPersistAdminCategories = presentationMode === "admin" && currentStep.id === "experiences";
    const shouldPersistAdminImages = presentationMode === "admin" && currentStep.id === "profile-image";
    const shouldPersistAdminLinks = presentationMode === "admin" && currentStep.id === "links";

    if ((!autosaveEnabled || presentationMode === "admin") && !shouldPersistAdminCategories && !shouldPersistAdminImages && !shouldPersistAdminLinks) {
      return { message: "Gemt", ok: true };
    }

    setStepSaveStatus({ message: "Gemmer...", status: "saving" });

    if (currentStep.id === "person") {
      const result = await autosaveFacilitatorProfileAction({
        section: "contact",
        values: contactValues,
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "profile-image") {
      if (profileImageFile) {
        const formData = new FormData();
        formData.set("image_file", profileImageFile);
        const result = await saveFacilitatorProfileImageAction(formData);

        if (result.status === "error") {
          return { message: result.message, ok: false };
        }

        setProfileImageFile(null);
        setProfileImageUrl(publicImageUrl(result.path));
      }

      const result = await autosaveFacilitatorProfileAction({
        adminTargetFacilitatorId: adminTargetFacilitatorId ?? null,
        section: "images",
        values: { facilitator_hero_key: selectedHeroKey },
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "experiences") {
      if (shouldPersistAdminCategories && !adminTargetFacilitatorId) {
        return { message: "Arrangørprofilen kunne ikke genkendes.", ok: false };
      }

      const result = await autosaveFacilitatorProfileAction({
        adminTargetFacilitatorId: shouldPersistAdminCategories ? (adminTargetFacilitatorId ?? null) : null,
        section: "categories",
        values: { category_ids: selectedExperiences, specialties },
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "story") {
      const result = await autosaveFacilitatorProfileAction({
        section: "contact",
        values: contactValues,
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "links") {
      if (!facebookValidation.ok) return { message: facebookValidation.message, ok: false };
      if (!instagramValidation.ok) return { message: instagramValidation.message, ok: false };

      const contactResult = await autosaveFacilitatorProfileAction({
        adminTargetFacilitatorId: shouldPersistAdminLinks ? (adminTargetFacilitatorId ?? null) : null,
        section: "contact",
        values: contactValues,
      });

      if (!contactResult.ok) return contactResult;

      const result = await autosaveFacilitatorProfileAction({
        adminTargetFacilitatorId: shouldPersistAdminLinks ? (adminTargetFacilitatorId ?? null) : null,
        section: "social",
        values: {
          facebook_url: facebook,
          instagram_url: instagram,
          public_email: facilitatorProfile.public_email ?? "",
          public_phone: facilitatorProfile.public_phone ?? "",
          tiktok_url: facilitatorProfile.tiktok_url ?? "",
          website_url: website,
          youtube_url: youtube,
        },
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "payment") {
      const result = await autosaveFacilitatorProfileAction({
        section: "payment",
        values: {
          payment_bank_account_name: paymentBankAccountName,
          payment_bank_account_number: paymentBankAccountNumber,
          payment_bank_registration_number: paymentBankRegistrationNumber,
          payment_deadline_days: paymentDeadlineDays,
          payment_external_url: paymentExternalUrl,
          payment_instructions: paymentInstructions,
          payment_mobilepay_number: paymentMobilepayNumber,
        },
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "services") {
      const result = await autosaveFacilitatorProfileAction({
        section: "services",
        values: {
          offers_services: offersIndividualServices,
          service_description: serviceDescription,
          show_in_local_service_results: offersIndividualServices,
        },
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "approval") {
      if (!submitForReview) {
        return { message: "Din profilkladde er gemt.", ok: true };
      }

      const result = await submitFacilitatorProfileForReviewAction({ acceptedTerms });

      if (!result.ok) return result;
      return result;
    }

    return { message: "Gemt", ok: true };
  }

  async function continueFlow() {
    if (continueInProgressRef.current) {
      return;
    }

    continueInProgressRef.current = true;
    setIsBusy(true);
    setStepSaveStatus({ message: "", status: "idle" });

    const saveResult = await saveCurrentStep();
    if (!saveResult.ok) {
      continueInProgressRef.current = false;
      setIsBusy(false);
      setStepSaveStatus({ message: saveResult.message, status: "error" });
      return;
    }

    if (presentationMode === "onboarding" && currentStep.id === "approval") {
      window.localStorage.removeItem(onboardingDraftStepStorageKey);
      router.push("/facilitator/profile/submitted");
      return;
    }

    setStepSaveStatus({ message: saveResult.message, status: "success" });

    continueTimeoutRef.current = window.setTimeout(() => {
      continueInProgressRef.current = false;
      setIsBusy(false);
      if (presentationMode !== "onboarding" && currentStep.id === "review") {
        router.push(backHref);
        return;
      }

      if (returnToReview && currentStep.id !== "review") {
        setReturnToReview(false);
        goToStep("review");
        return;
      }

      setStepSaveStatus({ message: "", status: "idle" });
      setStepIndex((current) => Math.min(current + 1, activeSteps.length - 1));
    }, 180);
  }

  async function saveDraftAndExit() {
    if (continueInProgressRef.current) {
      return;
    }

    continueInProgressRef.current = true;
    setIsBusy(true);
    setStepSaveStatus({ message: "", status: "idle" });

    const saveResult = await saveCurrentStep({ submitForReview: false });
    if (!saveResult.ok) {
      continueInProgressRef.current = false;
      setIsBusy(false);
      setStepSaveStatus({ message: saveResult.message, status: "error" });
      return;
    }

    window.localStorage.setItem(onboardingDraftStepStorageKey, currentStep.id);
    router.push("/facilitator?message=" + encodeURIComponent("Din profilkladde er gemt. Du kan fortsætte senere."));
  }

  function goBack() {
    continueInProgressRef.current = false;
    if (continueTimeoutRef.current) {
      window.clearTimeout(continueTimeoutRef.current);
      continueTimeoutRef.current = null;
    }
    setStepSaveStatus({ message: "", status: "idle" });

    if (returnToReview && currentStep.id !== "review") {
      setReturnToReview(false);
      goToStep("review");
      return;
    }

    setReturnToReview(false);
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  function goToStep(step: PrototypeStep) {
    continueInProgressRef.current = false;
    if (continueTimeoutRef.current) {
      window.clearTimeout(continueTimeoutRef.current);
      continueTimeoutRef.current = null;
    }
    const nextIndex = activeSteps.findIndex((item) => item.id === step);
    if (nextIndex >= 0) {
      setStepSaveStatus({ message: "", status: "idle" });
      setStepIndex(nextIndex);
    }
  }

  function editFromReview(step: PrototypeStep) {
    setReturnToReview(true);
    goToStep(step);
  }

  function goToMissingItem(item: { label: string; step: PrototypeStep }) {
    if (item.step === "profile-image" && item.label.includes("profilbillede")) {
      setProfileImageSubmissionError(true);
    }
    if (item.step === "story") {
      setStorySubmissionError(true);
    }
    goToStep(item.step);
  }

  function toggleExperience(categoryId: string) {
    setSelectedExperiences((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId],
    );
  }

  function applyMoodImagePaths(paths: string[]) {
    setMoodImages(
      Array.from({ length: 3 }, (_, index) => {
        const path = paths[index] ?? "";
        return {
          fileName: "",
          path,
          previewUrl: path ? publicImageUrl(path) : "",
        };
      }),
    );
  }

  function setMoodImageStatus(index: number, status: SlotStatus) {
    setMoodImageStatuses((current) => current.map((item, itemIndex) => (itemIndex === index ? status : item)));
  }

  function saveMoodImage(index: number, file: File) {
    if (file.size > moodImageMaxFileSize) {
      setMoodImageStatus(index, { message: "Billedet er for stort. Vælg et billede på højst 15 MB.", status: "error" });
      return;
    }

    setMoodImageStatus(index, { message: "Uploader og gemmer billedet...", status: "saving" });
    startImageTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("slot_index", String(index));
        formData.set("image_file", file);
        if (adminTargetFacilitatorId) {
          formData.set("admin_target_facilitator_id", adminTargetFacilitatorId);
        }
        const result = await saveFacilitatorMoodImageAction(formData);

        if (result.status === "success") {
          applyMoodImagePaths(result.paths);
          setMoodImageStatus(index, { message: "Billedet er gemt.", status: "success" });
          return;
        }

        setMoodImageStatus(index, { message: result.message, status: "error" });
      } catch {
        setMoodImageStatus(index, { message: "Billedet kunne ikke gemmes. Prøv igen.", status: "error" });
      }
    });
  }

  function removeMoodImage(index: number) {
    setMoodImageStatus(index, { message: "Fjerner billedet...", status: "saving" });
    startImageTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("slot_index", String(index));
        formData.set("remove", "yes");
        if (adminTargetFacilitatorId) {
          formData.set("admin_target_facilitator_id", adminTargetFacilitatorId);
        }
        const result = await saveFacilitatorMoodImageAction(formData);

        if (result.status === "success") {
          applyMoodImagePaths(result.paths);
          setMoodImageStatus(index, { message: "Billedet er fjernet.", status: "success" });
          return;
        }

        setMoodImageStatus(index, { message: result.message, status: "error" });
      } catch {
        setMoodImageStatus(index, { message: "Billedet kunne ikke fjernes. Prøv igen.", status: "error" });
      }
    });
  }

  const profileImageTile = (
    <UploadTile
      className="lg:max-w-[240px] xl:max-w-[260px]"
      imageUrl={profileImageUrl}
      label="Vælg profilbillede"
      onSelect={(file, previewUrl) => {
        setProfileImageSubmissionError(false);
        setProfileImageFile(file);
        setProfileImageUrl(previewUrl);
      }}
    />
  );
  const profileImageAdded = Boolean(profileImageUrl);

  const heroPreview = resolveFacilitatorHero({
    heroKey: selectedHeroKey,
    moodImages: moodImages.map((image, index) => ({
      imagePath: image.path,
      sortOrder: index + 1,
      url: image.previewUrl,
    })),
    preferCustomWhenUnset: false,
  });
  const reviewCategories = categories
    .filter((category) => selectedExperiences.includes(category.id))
    .map((category) => ({ name: category.name }));
  const reviewPlace = facilitatorProfile.is_online_facilitator
    ? "Online arrangør"
    : [facilitatorProfile.city, facilitatorProfile.country].filter(Boolean).join(", ") || null;
  const fullProfileHref = facilitatorProfile.id
    ? publicFacilitatorPath(facilitatorProfile.slug || facilitatorProfile.id) +
      (adminReturnTo
        ? "?admin_return=" + encodeURIComponent(adminReturnTo)
        : presentationMode === "admin"
          ? "?admin_return=" + encodeURIComponent(backHref)
          : "?facilitator_return=/facilitator")
    : null;
  type HeroPickerOption = {
    altText: string;
    description: string;
    disabled?: boolean;
    imagePath: string;
    key: FacilitatorHeroKey;
    label: string;
    objectPositionDesktop: string;
    objectPositionMobile: string;
  };
  const souleventsHeroOptions: HeroPickerOption[] = [
    ...facilitatorHeroOptions,
  ];
  const moodHeroOptions: HeroPickerOption[] = moodImages.reduce<HeroPickerOption[]>((options, image, index) => {
      const key = `mood_${index + 1}` as FacilitatorHeroKey;
      const hasImage = Boolean(image.previewUrl);

      if (!hasImage && selectedHeroKey !== key) return options;

      options.push({
        altText: `Stemningsbillede ${index + 1}`,
        description: hasImage ? "Brug dette billede som banner." : "Ikke uploadet endnu",
        disabled: !hasImage,
        imagePath: hasImage ? image.previewUrl : facilitatorHeroOptions[0].imagePath,
        key,
        label: `Stemningsbillede ${index + 1}`,
        objectPositionDesktop: "center center",
        objectPositionMobile: "center center",
      });

      return options;
    }, []);

  function renderHeroOption(option: HeroPickerOption) {
    const selected = selectedHeroKey === option.key;

    return (
      <button
        aria-disabled={option.disabled}
        aria-pressed={selected}
        className={
          "grid min-h-[118px] grid-cols-[96px_1fr] overflow-hidden rounded-[20px] border text-left shadow-soft transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 " +
          (selected ? "border-sage-700/45 bg-sage-50" : "border-midnight/10 bg-white hover:border-sage-700/30") +
          (option.disabled ? " cursor-not-allowed opacity-72" : " hover:-translate-y-0.5")
        }
        key={option.key}
        onClick={() => {
          if (!option.disabled) {
            setSelectedHeroKey(option.key);
          }
        }}
        type="button"
      >
        <span className="relative h-full w-full">
          <Image alt="" className="object-cover" fill sizes="96px" src={option.imagePath} unoptimized />
        </span>
        <span className="grid content-center gap-1 p-3">
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-midnight">{option.label}</span>
            <Circle className={selected ? "size-4 shrink-0 fill-sage-700/15 text-sage-700" : "size-4 shrink-0 text-sage-700/45"} aria-hidden="true" />
          </span>
          <span className="text-xs leading-5 text-ink/55">{option.description}</span>
        </span>
      </button>
    );
  }

  const heroPicker = (
    <section className="grid gap-4">
      <div>
        <p className="text-sm font-semibold text-midnight">Vælg banner til din offentlige profil</p>
        <p className="mt-1 text-sm leading-6 text-ink/55">
          Vælg et SoulEvents-naturbanner eller et af dine egne stemningsbilleder. Naturbannerne er tilpasset profilens brede format.
        </p>
      </div>

      <div className="overflow-hidden rounded-[24px] bg-midnight shadow-soft">
        <div className="relative aspect-[16/7] min-h-[180px]">
          <Image
            alt={heroPreview.altText}
            className="object-cover"
            fill
            sizes="(min-width: 768px) 640px, 100vw"
            src={heroPreview.url}
            unoptimized
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(44,51,35,0.78)_0%,rgba(69,56,82,0.38)_54%,rgba(69,56,82,0.08)_100%)]" />
          <div className="relative z-10 flex h-full max-w-sm flex-col justify-end p-5 text-white sm:p-6">
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/78">Sådan vises banneret på din profil</span>
            <p className="mt-2 font-serif text-3xl font-semibold leading-tight">{heroPreview.label}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">SoulEvents naturbannere</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {souleventsHeroOptions.map(renderHeroOption)}
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">Dine stemningsbilleder</p>
        {moodHeroOptions.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {moodHeroOptions.map(renderHeroOption)}
          </div>
        ) : (
          <p className="rounded-[18px] bg-white/70 px-4 py-3 text-sm leading-6 text-ink/55">
            Upload stemningsbilleder ovenfor, hvis du vil bruge et af dine egne billeder som banner.
          </p>
        )}
      </div>

      {isMoodHeroKey(selectedHeroKey) && !moodImages[Number(selectedHeroKey.replace("mood_", "")) - 1]?.previewUrl ? (
        <p className="rounded-[18px] bg-[#FFF7DE] px-4 py-3 text-sm font-semibold leading-6 text-[#715C21]">
          Det valgte stemningsbillede findes ikke længere. Vælg et nyt banner, før du gemmer.
        </p>
      ) : null}
    </section>
  );

  const moodImageTiles = (
    <>
      {moodImages.map((image, index) => (
        <div className="grid gap-2" key={`mood-slot-${index + 1}`}>
          <div className="relative">
            <UploadTile
              className="lg:max-w-[180px] xl:max-w-[200px]"
              createPreview={false}
              helperText={"JPG, PNG eller WebP\nMaks. 15 MB"}
              imageUrl={image.previewUrl}
              label={moodImageStatuses[index]?.status === "saving" ? "Gemmer billede..." : `Vælg stemningsbillede ${index + 1}`}
              maxFileSizeBytes={moodImageMaxFileSize}
              onError={(message) => setMoodImageStatus(index, { message, status: "error" })}
              onSelect={(file) => saveMoodImage(index, file)}
            />
            {image.path ? (
              <button
                aria-label={`Fjern stemningsbillede ${index + 1}`}
                className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/85 text-ink/55 shadow-soft transition hover:bg-white hover:text-midnight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
                onClick={() => removeMoodImage(index)}
                type="button"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {moodImageStatuses[index]?.message ? (
            <p
              className={
                "text-sm font-semibold " +
                (moodImageStatuses[index]?.status === "error"
                  ? "text-rose"
                  : moodImageStatuses[index]?.status === "success"
                    ? "text-sage-700"
                    : "text-ink/55")
              }
            >
              {moodImageStatuses[index]?.message}
            </p>
          ) : null}
        </div>
      ))}
    </>
  );

  const imageOverview = (
    <div className="grid gap-6">
      <section className="grid gap-5 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:items-center">
        {profileImageTile}
        <div className="rounded-[24px] bg-sage-50 p-5 text-sm leading-6 text-ink/65">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-midnight">Profilbillede · Obligatorisk</p>
            <span
              className={
                "rounded-full px-3 py-1 text-xs font-bold " +
                (profileImageAdded ? "bg-white text-sage-700" : "bg-white text-[#7A4EAB]")
              }
            >
              {profileImageAdded ? "Profilbillede tilføjet" : "Tilføj et profilbillede"}
            </span>
          </div>
          <p className="mt-2">
            Tilføj et billede af dig selv eller et billede, der tydeligt viser det, du tilbyder. Profilbilledet vises
            på din offentlige arrangørprofil og skal tilføjes, før profilen kan sendes til SoulEvents.
          </p>
          <p className="mt-2 text-ink/55">
            Det må gerne være et portræt, logo eller et billede af en behandling, aktivitet eller stemning, der tydeligt
            repræsenterer dit virke.
          </p>
          {profileImageSubmissionError && !profileImageAdded ? (
            <p className="mt-3 rounded-[18px] border border-[#E3B6B6] bg-[#FFF7F7] px-4 py-3 font-semibold text-[#A51D1D]">
              Du skal tilføje et profilbillede, før profilen kan sendes til SoulEvents.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3">
        <p className="text-sm font-semibold text-midnight">Stemningsbilleder (1-3)</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {moodImageTiles}
        </div>
      </section>

      {heroPicker}
    </div>
  );

  return (
    <OnboardingShell
      backHref={shellBackHref}
      backLabel={backLabel}
      canContinue={currentStep.id !== "approval" || (acceptedTerms && missingRequired.length === 0)}
      currentIndex={stepIndex}
      ctaLabel={
        presentationMode === "onboarding"
          ? currentStep.id === "approval"
            ? "Send profil til SoulEvents"
            : stepIndex === 0
              ? "Fortsæt"
              : undefined
          : currentStep.id === "review"
            ? "Gem ændringer"
            : returnToReview
              ? "Tilbage til gennemse"
              : undefined
      }
      ctaHelper={
        presentationMode === "onboarding" && currentStep.id === "approval"
          ? "Din profil sendes til gennemgang og bliver ikke offentlig, før den er godkendt."
          : undefined
      }
      footerLeading={
        currentStep.id === "review" && fullProfileHref ? (
          <div className="mb-3 grid gap-2 text-center">
            <p className="text-sm font-medium text-ink/55">Se hvordan hele profilen vises for gæster</p>
            <Link
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-sage-700/20 bg-white px-5 text-sm font-semibold text-sage-700 shadow-soft transition hover:border-sage-700/40 hover:bg-sage-50"
              href={fullProfileHref}
              rel="noreferrer"
              target="_blank"
            >
              Se fuld profilvisning
              <ExternalLink className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : null
      }
      hideBackNavigation={presentationMode === "onboarding" && currentStep.id === "complete"}
      hidePrimaryAction={presentationMode === "onboarding" && currentStep.id === "complete"}
      isBusy={isBusy}
      logoSources={logoSources}
      onBack={goBack}
      onContinue={continueFlow}
      onSaveDraft={presentationMode === "onboarding" && currentStep.id !== "complete" ? saveDraftAndExit : undefined}
      presentationMode={presentationMode}
    >
      {currentStep.id === "welcome" ? (
        <div className="mb-6 flex justify-center">
          <InlineBrandLogo className="h-20 w-auto" src={activeDesktopLogoSrc} />
        </div>
      ) : null}

      <StepIntro eyebrow={displayedStep.eyebrow} text={displayedStep.text} title={displayedStep.title} />
      {stepSaveStatus.message ? (
        <p
          className={
            "mb-5 rounded-2xl px-4 py-3 text-sm font-semibold leading-6 " +
            (stepSaveStatus.status === "error"
              ? "border border-rose/20 bg-rose/10 text-rose"
              : stepSaveStatus.status === "success"
                ? "border border-sage-700/20 bg-sage-50 text-sage-700"
                : "border border-midnight/10 bg-white text-ink/60")
          }
        >
          {stepSaveStatus.message}
        </p>
      ) : null}

      {currentStep.id === "person" && (
        <div className="grid gap-5">
          <div className="grid gap-4">
            <ClearableInput label="Dit fornavn" onChange={setFirstName} placeholder="Dit fornavn" value={firstName} />
            <ClearableInput label="Dit efternavn" onChange={setLastName} placeholder="Dit efternavn" value={lastName} />
          </div>

          <button
            aria-pressed={useCustomProfileName}
            className="flex min-h-20 items-center justify-between gap-4 rounded-[24px] border border-midnight/10 bg-white px-4 text-left shadow-soft transition hover:border-sage-700"
            onClick={() => setUseCustomProfileName((current) => !current)}
            type="button"
          >
            <span className="text-sm font-semibold leading-6 text-midnight">
              Mit profilnavn skal være et andet end mit rigtige navn på SoulEvents.
            </span>
            <span className={useCustomProfileName ? "flex h-10 w-[4.5rem] shrink-0 items-center justify-end rounded-full bg-sage-700 p-1" : "flex h-10 w-[4.5rem] shrink-0 items-center justify-start rounded-full bg-midnight/15 p-1"}>
              <span className="size-8 rounded-full bg-white shadow-soft" />
            </span>
          </button>

          {useCustomProfileName ? (
            <label className="grid gap-2 text-sm font-semibold text-ink/65">
              Profilnavn
              <ClearableInput
                className="text-xl font-semibold"
                onChange={setProfileName}
                placeholder="Skriv et kaldenavn eller virksomhedsnavn"
                value={profileName}
              />
              <span className="text-sm font-normal leading-6 text-ink/55">
                Det kan eksempelvis være dit kunstnernavn, virksomhedsnavn, studionavn eller et andet navn, deltagerne kender dig under.
              </span>
            </label>
          ) : (
            <div className="rounded-[22px] bg-sage-50 p-4">
              <p className="text-sm font-semibold text-sage-700">Din profil vises som:</p>
              <p className="mt-1 text-2xl font-semibold text-midnight">{fullPublicName || "Dit navn"}</p>
            </div>
          )}
        </div>
      )}

      {currentStep.id === "profile-image" && (
        imageOverview
      )}

      {currentStep.id === "experiences" && (
        <div className="grid gap-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {sortFacilitatorWorkAreas(categories).map((category) => {
              const selected = selectedExperiences.includes(category.id);
              const isLong = category.name.length > 17;
              const WorkAreaIcon = workAreaIconForName(category.name);
              const description = workAreaDescriptionForCategory(category);
              return (
                <button
                  className={workAreaClass(selected, isLong)}
                  key={category.id}
                  onClick={() => toggleExperience(category.id)}
                  type="button"
                >
                  <SelectionCardContent
                    description={description}
                    Icon={WorkAreaIcon}
                    label={category.name}
                    onInfoToggle={() => setOpenAreaInfoId((current) => (current === category.id ? null : category.id))}
                    selected={selected}
                    showInfo={openAreaInfoId === category.id}
                  />
                </button>
              );
            })}
          </div>
          <div className="rounded-[24px] bg-[#FBF5E9] p-4">
            <p className="text-sm font-semibold leading-6 text-[#695A3C]">
              Beskriv dit speciale
            </p>
            <p className="mt-2 text-xs leading-5 text-ink/55">
              Uddyb kort dit speciale, og skriv gerne siden hvornår du har arbejdet med området. Eksempel: &quot;Traumeterapeut med speciale i børn – siden 2018&quot;. Maks. 180 tegn.
            </p>
            <div className="mt-3">
              <ClearableTextarea
                className="bg-white text-base"
                maxLength={specialtyMaxLength}
                onChange={setSpecialties}
                placeholder="Beskriv kort dit speciale eller det, du brænder for"
                value={specialties}
              />
              <p className="mt-2 text-right text-xs font-semibold text-ink/50">
                {specialties.length} / {specialtyMaxLength} tegn
              </p>
            </div>
          </div>
        </div>
      )}

      {currentStep.id === "story" && (
        <div className="grid gap-5">
          <div className="flex items-center gap-2 border-b border-midnight/10 pb-3">
            <PencilLine className="size-4 text-sage-700" aria-hidden="true" />
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">Mit univers</p>
          </div>
          <div className="rounded-[22px] bg-[#FBF5E9] p-4 text-sm leading-6 text-ink/65">
            <p className="font-semibold text-midnight">Din fortælling hjælper deltagere med at mærke, hvem du er.</p>
            <p className="mt-1">
              Kladder må gerne være tomme eller korte. Den behøver først være klar, når profilen sendes til SoulEvents.
            </p>
          </div>
          <div className="relative">
            <textarea
              className="min-h-64 w-full rounded-[24px] border border-midnight/10 bg-white p-5 pr-12 text-lg leading-8 text-midnight shadow-soft outline-none transition duration-200 placeholder:text-ink/35 focus:border-sage-700 focus:ring-4 focus:ring-sage-700/10"
              onChange={(event) => {
                setStory(event.target.value);
                if (normalizeFacilitatorStory(event.target.value).length >= facilitatorStoryMinLength) {
                  setStorySubmissionError(false);
                }
              }}
              placeholder="Fortæl om din tilgang, stemningen i dine begivenheder, og hvad deltagerne kan glæde sig til."
              value={story}
            />
            {story ? (
              <button
                aria-label="Ryd felt"
                className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-ink/38 transition hover:bg-midnight/5 hover:text-midnight"
                onClick={() => setStory("")}
                type="button"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
            {storyMeetsMinimum ? (
              <span className="rounded-full bg-sage-50 px-3 py-1.5 text-sage-700">✓ Din fortælling er klar</span>
            ) : (
              <span className="rounded-full bg-white px-3 py-1.5 text-ink/55 shadow-soft">
                {storyMissingMessage}
              </span>
            )}
          </div>
          {storySubmissionError && !storyMeetsMinimum ? (
            <p className="rounded-[18px] border border-[#E6B4B4] bg-[#FFF1F1] px-4 py-3 text-sm font-semibold leading-6 text-[#A51D1D]">
              {storyMissingMessage}
            </p>
          ) : null}
        </div>
      )}

      {currentStep.id === "links" && (
        <div className="grid gap-4">
          <section className="rounded-[22px] border border-midnight/10 bg-white/75 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">Mailadresse</p>
            <p className="mt-2 break-all text-base font-semibold text-midnight">{profile.email}</p>
            <p className="mt-2 text-sm leading-6 text-ink/55">Mailadressen bruges til login og vigtige beskeder.</p>
            <Link className="mt-3 inline-flex text-sm font-semibold text-[#7A4EAB] hover:text-sage-700" href="/facilitator?messages=open#beskeder-admin">
              Skift mailadresse under Login og sikkerhed
            </Link>
          </section>
          <ClearableInput onChange={setPhone} placeholder="Telefonnummer" value={phone} />
          <ClearableInput onChange={setWebsite} placeholder="Website" value={website} />
          <div className="grid gap-2">
            <ClearableInput onChange={setFacebook} placeholder={socialProfileLinkPlaceholder("facebook")} value={facebook} />
            {facebookError ? <p className="text-sm font-semibold leading-5 text-[#A51D1D]">{facebookError}</p> : null}
          </div>
          <div className="grid gap-2">
            <ClearableInput onChange={setInstagram} placeholder={socialProfileLinkPlaceholder("instagram")} value={instagram} />
            {instagramError ? <p className="text-sm font-semibold leading-5 text-[#A51D1D]">{instagramError}</p> : null}
          </div>
          <p className="text-sm leading-6 text-ink/55">{socialProfileLinkHelpText}</p>
          <ClearableInput onChange={setYoutube} placeholder="YouTube" value={youtube} />
        </div>
      )}

      {currentStep.id === "payment" && (
        <div className="grid gap-5">
          <section className="rounded-[24px] border border-[#E5D4F7] bg-[#F5EFFB] p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-[#7A4EAB] shadow-soft">
                <CreditCard className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#7A4EAB]">Privat betalingsinfo</p>
                <p className="mt-2 text-sm leading-6 text-ink/65">
                  Betalingsoplysningerne vises ikke offentligt. De sendes først til deltageren, når du bekræfter en tilmelding.
                  SoulEvents modtager eller behandler ikke betalingen.
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <ClearableInput label="MobilePay" maxLength={40} onChange={setPaymentMobilepayNumber} placeholder="Nummer eller MobilePay Box" value={paymentMobilepayNumber} />
            <ClearableInput label="Betalingslink" maxLength={300} onChange={setPaymentExternalUrl} placeholder="https://..." value={paymentExternalUrl} />
            <ClearableInput
              label="Bank reg.nr."
              maxLength={20}
              onChange={setPaymentBankRegistrationNumber}
              placeholder="F.eks. 1234"
              value={paymentBankRegistrationNumber}
            />
            <ClearableInput
              label="Bank kontonr."
              maxLength={40}
              onChange={setPaymentBankAccountNumber}
              placeholder="Kontonummer"
              value={paymentBankAccountNumber}
            />
            <ClearableInput
              className="md:col-span-2"
              label="Kontonavn"
              maxLength={120}
              onChange={setPaymentBankAccountName}
              placeholder="Navn på modtager"
              value={paymentBankAccountName}
            />
          </div>

          <label className="grid gap-2 text-sm font-semibold text-ink/65">
            Standard betalingsfrist
            <input
              className={inputClass("max-w-44")}
              max={60}
              min={0}
              onChange={(event) => setPaymentDeadlineDays(event.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="14"
              type="number"
              value={paymentDeadlineDays}
            />
            <span className="text-xs leading-5 text-ink/55">
              Antal dage efter bekræftet tilmelding. Fristen bliver aldrig sat efter eventets startdato.
            </span>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-ink/65">
            Betalingsinstruktioner
            <ClearableTextarea
              maxLength={800}
              onChange={setPaymentInstructions}
              placeholder="F.eks. skriv eventnavn og betalingsreference i beskedfeltet ved betaling."
              value={paymentInstructions}
            />
            <span className="text-xs leading-5 text-ink/55">
              Brug feltet til praktiske detaljer, som deltageren skal kende efter bekræftelse.
            </span>
          </label>
        </div>
      )}

      {currentStep.id === "services" && (
        <div className="grid gap-5">
          <p className="text-base leading-7 text-ink/65">
            Så kan du blive vist på SoulEvents under “Ydelser”, så deltagere også kan finde og kontakte dig uden for dine events.
          </p>

          <div className="grid gap-3" role="radiogroup" aria-label="Individuelle ydelser">
            {[
              { label: "Nej, jeg afholder kun events", value: false },
              { label: "Ja, jeg tilbyder også individuelle ydelser", value: true },
            ].map((option) => {
              const selected = offersIndividualServices === option.value;
              return (
                <button
                  aria-checked={selected}
                  className={
                    "flex min-h-16 items-center justify-between gap-4 rounded-[22px] border px-4 text-left text-base font-semibold shadow-soft transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 " +
                    (selected ? "border-sage-700/25 bg-sage-50 text-sage-700" : "border-midnight/10 bg-white text-midnight hover:border-sage-700")
                  }
                  key={String(option.value)}
                  onClick={() => {
                    setOffersIndividualServices(option.value);
                  }}
                  role="radio"
                  type="button"
                >
                  {option.label}
                  <Circle className={selected ? "size-4 fill-sage-700/15 text-sage-700" : "size-4 text-sage-700/45"} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          {offersIndividualServices ? (
            <div className="rounded-[24px] bg-[#FBF5E9] p-4">
              <div className="rounded-[24px] bg-white p-4 shadow-soft">
                <p className="text-sm font-semibold leading-6 text-midnight">
                  Hvad tilbyder du?
                </p>
                <p className="mt-3 text-xs leading-5 text-ink/55">
                  Beskriv kort, hvad man kan booke hos dig individuelt.
                </p>
                <div className="relative mt-3">
                  <textarea
                    className="min-h-36 w-full rounded-[20px] border border-midnight/10 bg-white p-4 pr-12 text-base leading-7 text-midnight shadow-soft outline-none transition duration-200 placeholder:text-ink/35 focus:border-sage-700 focus:ring-4 focus:ring-sage-700/10"
                    maxLength={500}
                    onChange={(event) => setServiceDescription(event.target.value)}
                    placeholder="F.eks. individuelle samtaleforløb, healing, massage eller kraniosakral behandling"
                    value={serviceDescription}
                  />
                  {serviceDescription ? (
                    <button
                      aria-label="Ryd felt"
                      className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-ink/38 transition hover:bg-midnight/5 hover:text-midnight"
                      onClick={() => setServiceDescription("")}
                      type="button"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {currentStep.id === "review" && (
        <div className="rounded-[34px] border border-midnight/5 bg-[#F4F0E9] p-4 shadow-soft sm:p-6">
          <div className="grid gap-5 [&>*+*]:border-t [&>*+*]:border-midnight/10 [&>*+*]:pt-5">
            <ReviewJump
              label="Rediger profilbanner"
              onClick={() => editFromReview("profile-image")}
              className="rounded-[26px] bg-white/70 p-4 pr-14 sm:p-5 sm:pr-14"
            >
              <section className="grid gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">Dit valgte profilbanner</p>
                  <p className="mt-1 text-sm leading-6 text-ink/60">
                    Banneret bruges øverst på din offentlige profil. Hele profilvisningen åbnes separat.
                  </p>
                </div>

                <div className="overflow-hidden rounded-[28px] bg-midnight shadow-soft transition group-hover:shadow-lift">
                  <div className="relative aspect-[16/7] max-h-[220px] min-h-[160px] sm:min-h-[190px] lg:max-h-[240px]">
                    <Image
                      alt={heroPreview.altText}
                      className="object-cover"
                      fill
                      sizes="(min-width: 1024px) 560px, 100vw"
                      src={heroPreview.url}
                      style={{ objectPosition: heroPreview.objectPositionDesktop ?? "center center" }}
                      unoptimized
                    />
                  </div>
                </div>

                <p className="text-sm font-semibold text-ink/60">Valgt banner: {heroPreview.label}</p>
              </section>
            </ReviewJump>

            <section className="grid gap-3 rounded-[26px] bg-white/70 p-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:p-5">
              <ReviewJump label="Rediger profilbillede" onClick={() => editFromReview("profile-image")}>
                <div className="aspect-square overflow-hidden rounded-[24px] bg-sage-50 text-sage-700 transition group-hover:ring-2 group-hover:ring-sage-700/25">
                  {profileImageUrl ? (
                    <img alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" src={profileImageUrl} />
                  ) : (
                    <span className="grid h-full place-items-center">
                      <Camera className="size-8" aria-hidden="true" />
                    </span>
                  )}
                </div>
              </ReviewJump>
              <ReviewJump label="Rediger profilnavn og lokation" onClick={() => editFromReview("person")} className="p-2 pr-14">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">Profilnavn</span>
                <span className="mt-2 block break-words font-serif text-3xl font-semibold leading-tight text-midnight">{publicProfileName || "Profilnavn mangler"}</span>
                {reviewPlace ? <span className="mt-2 block text-sm font-semibold text-ink/55">{reviewPlace}</span> : null}
                <SoulEventsIdTag className="mt-3" hostReferenceId={facilitatorProfile.host_reference_id} />
              </ReviewJump>
            </section>

            <ReviewJump
              label="Rediger arbejdsområder og speciale"
              onClick={() => editFromReview("experiences")}
              className="rounded-[26px] bg-white/70 p-4 pr-14 sm:p-5 sm:pr-14"
            >
              <div className="grid gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">Arbejdsområder</p>
                  {reviewCategories.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {reviewCategories.map((category) => (
                        <span className="rounded-full bg-[#EDF3EA] px-3 py-1.5 text-xs font-semibold text-[#4F6849]" key={category.name}>
                          {category.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 rounded-[18px] bg-[#FFF7DE] px-4 py-3 text-sm font-semibold leading-6 text-[#715C21]">
                      Vælg mindst ét arbejdsområde.
                    </p>
                  )}
                </div>
                {specialtyText ? (
                  <div className="grid gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">Beskrivelse af speciale</p>
                    <p className="rounded-[18px] bg-[#F1EAF5] px-4 py-3 text-sm font-semibold leading-6 text-[#2F2437] [overflow-wrap:anywhere]">
                      {specialtyText}
                    </p>
                  </div>
                ) : null}
              </div>
            </ReviewJump>

            <ReviewJump
              label="Rediger stemningsbilleder"
              onClick={() => editFromReview("profile-image")}
              className="rounded-[26px] bg-white/70 p-4 pr-14 sm:p-5 sm:pr-14"
            >
              <div className="grid gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">Stemningsbilleder</p>
                <div className="grid grid-cols-3 gap-2">
                {moodImages.map((image, index) => (
                  <div
                    className="aspect-square overflow-hidden rounded-[18px] bg-white/45 text-sage-700/45"
                    key={`review-mood-slot-${index + 1}`}
                  >
                    {image.previewUrl ? (
                      <img alt="" className="h-full w-full object-cover" src={image.previewUrl} />
                    ) : (
                      <span className="grid h-full place-items-center">
                        <ImagePlus className="size-5" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                ))}
                </div>
              </div>
            </ReviewJump>

            <ReviewJump
              label="Rediger om mig"
              onClick={() => editFromReview("story")}
              className="rounded-[26px] bg-white/70 p-4 pr-14 sm:p-5 sm:pr-14"
            >
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-sage-700">Mit univers</p>
              {normalizedStory ? (
                <p className="min-w-0 whitespace-pre-line text-base leading-8 text-ink/72">{story}</p>
              ) : (
                <div className="rounded-[22px] bg-[#FFF7DE] p-4 text-sm font-semibold leading-6 text-[#715C21]">
                  Fortæl lidt om dig og de begivenheder, du skaber.
                </div>
              )}
            </ReviewJump>

            {offersIndividualServices || presentationMode !== "onboarding" ? (
              <ReviewJump
                label="Rediger individuelle ydelser"
                onClick={() => editFromReview("services")}
                className="rounded-[26px] bg-white/70 p-4 pr-14 sm:p-5 sm:pr-14"
              >
                <div className="grid gap-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Tilbyder du også individuelle ydelser?</p>
                  {hasIndividualServicesDescription ? (
                    <p className="whitespace-pre-line text-base leading-7 text-ink/72">{serviceDescription}</p>
                  ) : offersIndividualServices ? (
                    <p className="text-sm leading-6 text-ink/55">
                      Så kan du blive vist på SoulEvents under “Ydelser”, så deltagere også kan finde og kontakte dig uden for dine events.
                    </p>
                  ) : (
                    <div className="rounded-[22px] bg-[#FBF5E9] p-4">
                      <p className="text-sm font-semibold leading-6 text-midnight">Tilbyder du også individuelle ydelser?</p>
                      <p className="mt-1 text-sm leading-6 text-ink/60">
                        Så kan du blive vist på SoulEvents under “Ydelser”, så deltagere også kan finde og kontakte dig uden for dine events.
                      </p>
                      <span className="mt-3 inline-flex h-10 w-fit items-center rounded-full bg-sage-700 px-4 text-sm font-semibold text-white shadow-soft">
                        Tilføj ydelse
                      </span>
                    </div>
                  )}
                </div>
              </ReviewJump>
            ) : null}

            {presentationMode !== "onboarding" ? (
              <Link
                aria-label="Gå til betaling under Hjælp og profilindstillinger"
                className="relative block rounded-[26px] bg-white/70 p-4 pr-14 text-left shadow-soft transition hover:-translate-y-0.5 hover:bg-white sm:p-5 sm:pr-14"
                href="/facilitator?messages=open#betaling"
              >
                <div className="grid gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">Standardbetaling</p>
                  {hasPaymentDefaults ? (
                    <div className="flex flex-wrap gap-2 text-sm font-semibold text-sage-700">
                      {paymentMobilepayNumber.trim() ? <span className="rounded-full bg-sage-50 px-3 py-1">MobilePay</span> : null}
                      {paymentBankRegistrationNumber.trim() || paymentBankAccountNumber.trim() ? (
                        <span className="rounded-full bg-sage-50 px-3 py-1">Bankoverførsel</span>
                      ) : null}
                      {paymentExternalUrl.trim() ? <span className="rounded-full bg-sage-50 px-3 py-1">Betalingslink</span> : null}
                      {paymentInstructions.trim() ? <span className="rounded-full bg-sage-50 px-3 py-1">Instruktioner</span> : null}
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-ink/55">
                      Ikke angivet endnu. Du kan stadig skrive betalingsoplysninger direkte på et event.
                    </p>
                  )}
                  <p className="text-xs leading-5 text-ink/55">
                    Sendes først til deltageren, når du bekræfter en betalt tilmelding.
                  </p>
                </div>
                <ArrowRight className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-sage-700" aria-hidden="true" />
              </Link>
            ) : null}

            <ReviewJump
              label="Rediger kontaktoplysninger"
              onClick={() => editFromReview("links")}
              className="rounded-[26px] bg-white/70 p-4 pr-14 sm:p-5 sm:pr-14"
            >
              <div className="grid gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">Kontaktoplysninger</p>
                  <div className="mt-3 grid gap-3 text-sm leading-6 text-midnight">
                    <div className="border-b border-midnight/10 pb-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/45">Mailadresse</p>
                      <p className="mt-1 break-all font-semibold">{profile.email}</p>
                      <p className="mt-1 text-ink/55">Mailadressen bruges til login og vigtige beskeder.</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/45">Telefonnummer</p>
                      <p className="mt-1 font-semibold">{phone.trim() || "Ikke angivet"}</p>
                    </div>
                    <Link
                      className="w-fit font-semibold text-[#7A4EAB] hover:text-sage-700"
                      href="/facilitator?messages=open#beskeder-admin"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Skift mailadresse under Login og sikkerhed
                    </Link>
                  </div>
                </div>
                {hasLinks ? <LinkRows facebook={facebook} instagram={instagram} website={website} youtube={youtube} /> : null}
              </div>
              </ReviewJump>

            {missingRequired.length > 0 ? (
              <div className="rounded-[24px] bg-[#FFF7DE] p-5">
                <p className="text-sm font-semibold text-[#715C21]">Du mangler stadig nogle oplysninger</p>
                {!storyMeetsMinimum ? (
                  <p className="mt-2 text-sm leading-6 text-[#715C21]">
                    {storyMissingMessage}
                  </p>
                ) : null}
                <div className="mt-3 grid gap-2">
                  {missingRequired.map((item) => (
                    <button
                      className="inline-flex min-h-10 items-center justify-between rounded-full bg-white px-4 text-sm font-semibold text-midnight shadow-soft"
                      key={item.label}
                      onClick={() => goToMissingItem(item)}
                      type="button"
                    >
                      {item.label}
                      <ArrowRight className="size-4 text-sage-700" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {currentStep.id === "approval" && (
        <div className="grid gap-6 text-left">
          <div className="grid gap-4 rounded-[30px] bg-[#F4F0E9] p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Dig + SoulEvents</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="grid min-h-[220px] grid-rows-[1fr_auto] justify-items-center gap-3 rounded-[24px] bg-white p-4 text-center shadow-soft">
                <div className="grid aspect-square w-full max-w-[150px] place-items-center overflow-hidden rounded-[24px] bg-sage-50 text-sage-700">
                  {profileImageUrl ? <img alt="" className="h-full w-full object-cover" src={profileImageUrl} /> : <Camera className="size-9" aria-hidden="true" />}
                </div>
                <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-midnight">{publicProfileName || "Din profil"}</p>
              </div>
              <div className="grid size-11 place-items-center rounded-full bg-white text-rose shadow-soft">
                <HeartHandshake className="size-5" aria-hidden="true" />
              </div>
              <div className="grid min-h-[220px] grid-rows-[1fr_auto] justify-items-center gap-3 rounded-[24px] bg-white p-4 text-center shadow-soft">
                <div className="grid aspect-square w-full max-w-[150px] place-items-center rounded-[24px] bg-sage-50 p-4">
                  <InlineBrandLogo className="h-full w-full" src={activeDesktopLogoSrc} />
                </div>
                <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-midnight">SoulEvents</p>
              </div>
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-[24px] border border-midnight/10 bg-white p-5 text-left shadow-soft">
            <input
              checked={acceptedTerms}
              className="mt-1 size-5 rounded border-midnight/20 accent-sage-700"
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              type="checkbox"
            />
            <span className="text-sm font-semibold leading-6 text-midnight">
              Jeg har læst og accepterer SoulEvents&apos;{" "}
              <Link className="text-sage-700 underline underline-offset-4" href="/legal/arrangoervilkaar">
                arrangørvilkår
              </Link>
              ,{" "}
              <Link className="text-sage-700 underline underline-offset-4" href="/legal/platformens-retningslinjer">
                retningslinjer
              </Link>{" "}
              og{" "}
              <Link className="text-sage-700 underline underline-offset-4" href="/legal/privatlivspolitik">
                privatlivspolitik
              </Link>
              .
            </span>
          </label>
          {missingRequired.length > 0 ? (
            <div className="rounded-[24px] bg-[#FFF7DE] p-5 text-left">
              <p className="text-sm font-semibold text-[#715C21]">Der mangler lige et par oplysninger, før profilen kan sendes til godkendelse.</p>
              {!storyMeetsMinimum ? (
                <p className="mt-2 text-sm leading-6 text-[#715C21]">
                  {storyMissingMessage}
                </p>
              ) : null}
              <div className="mt-3 grid gap-2">
                {missingRequired.map((item) => (
                  <button
                    className="inline-flex min-h-10 items-center justify-between rounded-full bg-white px-4 text-sm font-semibold text-midnight shadow-soft"
                    key={item.label}
                    onClick={() => goToMissingItem(item)}
                    type="button"
                  >
                    {item.label}
                    <ArrowRight className="size-4 text-sage-700" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {currentStep.id === "complete" && (
        <div className="grid gap-8 text-left">
          <div className="grid justify-items-start gap-5">
            <span className="grid size-14 place-items-center rounded-full bg-sage-50 text-sage-700 shadow-soft">
              <PartyPopper className="size-7" aria-hidden="true" />
            </span>
            <div className="grid gap-4 text-base leading-7 text-ink/65">
              <p>
                Vi gennemgår alle nye profiler manuelt for at sikre en tryg og troværdig platform. Du modtager en e-mail,
                så snart din profil er godkendt.
              </p>
              <p>
                Du kan allerede nu begynde at oprette dit første event. Eventet gemmes som en kladde og bliver først
                synligt, når din arrangørprofil er godkendt.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <Link
              className="inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-[999px] bg-midnight px-6 text-lg font-semibold text-white shadow-soft transition duration-200 hover:bg-sage-700 lg:min-h-12 lg:text-base xl:min-h-14"
              href="/facilitator/events"
            >
              Opret dit første event
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            <Link
              className="justify-self-center text-sm font-semibold text-sage-700 underline underline-offset-4 transition hover:text-midnight"
              href="/facilitator"
            >
              Gå til mit dashboard
            </Link>
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}
