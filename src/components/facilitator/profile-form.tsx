"use client";

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Circle,
  CreditCard,
  Eye,
  ExternalLink,
  Globe,
  HeartHandshake,
  ImagePlus,
  Info,
  Link2,
  Mail,
  MapPin,
  MapPinned,
  PartyPopper,
  PencilLine,
  Phone,
  Sparkles,
  Upload,
  User,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { resolveNameParts } from "@/lib/auth/names";
import {
  autosaveFacilitatorProfileAction,
  createSignedFacilitatorBannerUploadAction,
  saveFacilitatorBannerImageAction,
  saveFacilitatorBannerImagePathAction,
  saveFacilitatorMoodImageAction,
  saveFacilitatorProfileImageAction,
  submitFacilitatorProfileForReviewAction,
} from "@/app/facilitator/profile/actions";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  imageUploadAccept,
  prepareImageFileForUpload,
} from "@/lib/images/client-image-upload";
import {
  fetchDanishPostalCity,
  getLocalDanishPostalCity,
  normalizeDanishPostalCode,
  splitDanishPostalCity,
} from "@/lib/locations/danish-postal-codes";
import {
  danishPhoneValidationMessage,
  normalizeDanishPhoneNumber,
} from "@/lib/danish-phone";
import {
  isDanishProfileCountry,
  inferProfileCountryCode,
  isOtherProfileCountry,
  normalizeInternationalPostalCode,
  normalizeProfileCountryCode,
  profileCountryName,
  supportedProfileCountries,
} from "@/lib/locations/countries";
import { OnboardingShell as SharedOnboardingShell } from "@/components/onboarding/onboarding-shell";
import { ProfileIdentityHeader } from "@/components/facilitator/profile-identity-header";
import { PublicFacilitatorGallery } from "@/components/facilitator/public-facilitator-gallery";
import type { BrandLogoSources } from "@/lib/brand-logo";
import { resolveFacilitatorBanner } from "@/lib/facilitators/hero-collection";
import {
  facilitatorStoryMinLength,
  normalizeFacilitatorStory,
} from "@/lib/facilitators/profile-readiness";
import { getProfileLocationSaveValidation } from "@/lib/facilitators/profile-location-save-validation";
import {
  facilitatorWorkAreas,
  sortFacilitatorWorkAreas,
} from "@/lib/facilitators/work-areas";
import { inferRegionSlug } from "@/lib/regions/infer-region";
import { publicFacilitatorPath } from "@/lib/slug";
import {
  socialProfileLinkHelpText,
  socialProfileLinkPlaceholder,
  validateSocialProfileLink,
} from "@/lib/social-profile-links";

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
  facilitator_banner_image_path?: string | null;
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
  country_name?: string | null;
  is_online_facilitator?: boolean | null;
  region_id: string | null;
  region_text?: string | null;
  show_public_location?: boolean | null;
  payment_mobilepay_number?: string | null;
  payment_bank_registration_number?: string | null;
  payment_bank_account_number?: string | null;
  payment_bank_account_name?: string | null;
  payment_external_url?: string | null;
  payment_instructions?: string | null;
  payment_deadline_days?: number | null;
  individual_service_other_title?: string | null;
  individual_service_types?: string[] | null;
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
  | "profile"
  | "person"
  | "location"
  | "profile-image"
  | "experiences"
  | "story"
  | "links"
  | "payment"
  | "services"
  | "review"
  | "approval"
  | "complete";

type ImageSectionTarget = "profile" | "mood" | "banner";

type MissingFocusTarget =
  | "experiences"
  | "location"
  | "mood-image"
  | "person"
  | "profile-image"
  | "story";

type ApprovalIssueTarget = "missing-requirements" | "terms";

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

function workAreaDescriptionForCategory(category: Category) {
  if (category.description) return category.description;
  const workArea = facilitatorWorkAreas.find(
    (area) => area.slug === category.slug,
  );
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
    eyebrow: "Din profil",
    id: "profile",
    text: "Udfyld de samme profiloplysninger, som du senere kan redigere under Profilindstillinger. Du kan gemme som kladde og fortsætte senere.",
    title: "Fortæl deltagerne, hvem de møder.",
  },
  {
    eyebrow: "Navn",
    id: "person",
    text: "Dit rigtige navn er kun synligt for SoulEvents. Som udgangspunkt vises dit rigtige navn på din offentlige profil, men du kan vælge et andet profilnavn.",
    title: "Hvem står bag profilen?",
  },
  {
    eyebrow: "Lokation",
    id: "location",
    text: "Skriv dit postnummer, så finder SoulEvents automatisk byen og placerer din profil i det rigtige område.",
    title: "Hvor holder du til?",
  },
  {
    eyebrow: "Billeder",
    id: "profile-image",
    text: "Tilføj profilbillede, bannerbillede og op til tre stemningsbilleder, der viser dig og det, du inviterer mennesker ind i.",
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
    text: "Fortæl kort om dig, din baggrund og det, du ønsker at skabe for dine deltagere. En personlig fortælling hjælper nye besøgende med at lære dig at kende og føle sig trygge ved at vælge dig.",
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
    text: "Gem dine standardbetalingsoplysninger. De sendes automatisk til deltageren ved SoulEvents-tilmelding.",
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
    text: "Gennemgå dine oplysninger en sidste gang, før din profil oprettes.",
    title: "Gennemgå din profil",
  },
  {
    eyebrow: "Velkommen",
    id: "complete",
    text: "Din arrangørprofil er nu oprettet og sendt til gennemgang.",
    title: "Vi er glade for at byde dig velkommen til SoulEvents.",
  },
];

const onboardingStepIds: PrototypeStep[] = [
  "welcome",
  "profile",
  "approval",
  "complete",
];
const editingStepIds: PrototypeStep[] = [
  "review",
  "person",
  "location",
  "profile-image",
  "experiences",
  "story",
  "links",
  "services",
];
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
  return supabaseUrl && path
    ? `${supabaseUrl}/storage/v1/object/public/media/${path}`
    : "";
}

function resolveInitialStepIndex({
  activeStepIds,
  presentationMode,
  storageKey,
}: {
  activeStepIds: PrototypeStep[];
  presentationMode: ProfileFormProps["presentationMode"];
  storageKey: string;
}) {
  if (presentationMode !== "onboarding" || typeof window === "undefined") {
    return 0;
  }

  const storedStep = window.localStorage.getItem(storageKey);
  const nextIndex = storedStep
    ? activeStepIds.indexOf(storedStep as PrototypeStep)
    : -1;

  return nextIndex >= 0 && activeStepIds[nextIndex] !== "complete"
    ? nextIndex
    : 0;
}

function inputClass(extra = "") {
  return (
    "min-h-14 w-full rounded-[18px] border border-[#D8D0C1] bg-white px-5 text-lg text-midnight shadow-[0_8px_22px_rgba(47,36,55,0.045)] outline-none transition duration-200 placeholder:text-ink/48 focus:border-sage-700 focus:ring-4 focus:ring-sage-700/12 " +
    extra
  );
}

function workAreaClass(selected: boolean, _isLong = false) {
  return (
    "flex min-h-16 items-center justify-between gap-3 rounded-[22px] border px-3.5 py-3 text-left text-base font-semibold shadow-soft transition duration-200 hover:scale-[1.01] hover:border-sage-700 sm:px-4 " +
    (selected
      ? "border-sage-700/25 bg-sage-50 text-sage-700"
      : "border-midnight/10 bg-white text-midnight")
  );
}

function SelectionCardContent({
  description,
  label,
  onInfoToggle,
  showInfo,
  selected,
}: {
  description?: string | null;
  label: string;
  onInfoToggle?: () => void;
  showInfo?: boolean;
  selected: boolean;
}) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 whitespace-normal break-words text-left leading-snug">
            {label}
          </span>
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
      <Circle
        className={
          selected
            ? "ml-2 size-4 shrink-0 fill-sage-700/15 text-sage-700"
            : "ml-2 size-4 shrink-0 text-sage-700/45"
        }
        aria-hidden="true"
      />
    </>
  );
}

function ClearableInput({
  className = "",
  error,
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  className?: string;
  error?: string;
  label?: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const input = (
    <div className="relative">
      <input
        aria-invalid={Boolean(error)}
        className={inputClass(
          "pr-12 " + className + (error ? " border-[#D97A7A] bg-[#FFF8F8]" : ""),
        )}
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

  if (!label && !error) return input;

  return (
    <label className="grid gap-2 text-sm font-semibold text-midnight/82">
      {label ? label : null}
      {input}
      {error ? (
        <span className="text-sm font-semibold leading-5 text-[#A51D1D]">
          {error}
        </span>
      ) : null}
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
        className={inputClass(
          "resize-none overflow-hidden py-4 pr-12 leading-7 " + className,
        )}
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
  return input
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

function ProfilePreviewEditButton({
  className = "",
  label,
  onClick,
}: {
  className?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={
        "inline-grid size-11 place-items-center rounded-full border border-white/75 bg-white/90 text-[#6E5285] shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:text-[#2F2437] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A4EAB] " +
        className
      }
      onClick={onClick}
      type="button"
    >
      <PencilLine className="size-4" aria-hidden="true" />
    </button>
  );
}

function EditablePublicSection({
  actions,
  children,
  className = "",
  label,
  onClick,
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <section
      aria-label={label}
      className={
        "group relative cursor-pointer rounded-[32px] border border-[#E8DEC9] bg-[#FFFDF8] p-7 shadow-[0_18px_45px_rgba(47,36,55,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(47,36,55,0.1)] focus-within:shadow-[0_24px_54px_rgba(47,36,55,0.1)] sm:p-10 " +
        className
      }
      onClick={onClick}
    >
      <div className="absolute right-4 top-4 z-10">
        {actions ?? (
          <ProfilePreviewEditButton label={label} onClick={onClick} />
        )}
      </div>
      {children}
    </section>
  );
}

function ProfilePreviewSectionTitle({
  eyebrow,
  title,
}: {
  eyebrow?: string;
  title: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7A5D91]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-[#2F2437] sm:text-4xl">
        {title}
      </h2>
    </div>
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
    websiteValue
      ? { icon: Globe, label: "Hjemmeside", text: displayLink(websiteValue) }
      : null,
    facebookValue
      ? { icon: Link2, label: "Facebook", text: displayLink(facebookValue) }
      : null,
    instagramValue
      ? { icon: Camera, label: "Instagram", text: displayLink(instagramValue) }
      : null,
    youtubeValue
      ? { icon: Video, label: "YouTube", text: displayLink(youtubeValue) }
      : null,
  ].filter(
    (item): item is { icon: typeof Globe; label: string; text: string } =>
      Boolean(item),
  );

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
  isWidePreview = false,
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
  isWidePreview?: boolean;
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
      className="inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-[999px] bg-midnight px-6 text-lg font-semibold text-white shadow-soft transition duration-200 hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-45 lg:min-h-12 lg:w-auto lg:min-w-56 lg:text-base xl:min-h-14"
      aria-disabled={isBusy || !canContinue}
      disabled={isBusy || !canContinue}
      onClick={onContinue}
      type="button"
    >
      {isBusy
        ? "Gemmer..."
        : (ctaLabel ??
          (isFirst ? "Kom i gang" : isLast ? "Opret profil" : "Fortsæt"))}
      {!isBusy && <ArrowRight className="size-5" aria-hidden="true" />}
    </button>
  );

  const backNavigation = hideBackNavigation ? null : isFirst ? (
    <Link
      className="text-sm font-semibold text-ink/55 underline-offset-4 hover:text-sage-700 hover:underline"
      href={backHref}
    >
      {backLabel}
    </Link>
  ) : (
    <button
      className="inline-flex items-center gap-2 text-sm font-semibold text-ink/55 transition hover:text-sage-700"
      onClick={onBack}
      type="button"
    >
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
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-3">
                {onSaveDraft ? (
                  <button
                    className="order-2 mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-midnight/10 bg-white px-5 text-sm font-semibold text-sage-700 shadow-soft transition hover:border-sage-700/35 hover:bg-sage-50 disabled:cursor-not-allowed disabled:opacity-45 lg:order-1 lg:mt-0 lg:w-auto lg:min-w-56"
                    disabled={isBusy}
                    onClick={onSaveDraft}
                    type="button"
                  >
                    Gem kladde og fortsæt senere
                  </button>
                ) : null}
                <div className="order-1 lg:order-2 lg:ml-auto">{footer}</div>
              </div>
              {ctaHelper ? (
                <p className="mt-3 text-left text-sm font-medium text-ink/55">
                  {ctaHelper}
                </p>
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

  const editingBackNavigation = hideBackNavigation ? null : isFirst ? (
    <Link
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-midnight/10 bg-white px-4 text-sm font-semibold text-sage-700 shadow-soft transition hover:border-sage-700/35 hover:bg-sage-50"
      href={backHref}
    >
      {backLabel}
    </Link>
  ) : (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-midnight/10 bg-white px-4 text-sm font-semibold text-sage-700 shadow-soft transition hover:border-sage-700/35 hover:bg-sage-50"
      onClick={onBack}
      type="button"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Tilbage
    </button>
  );
  const editingContentClass =
    "mx-auto w-full rounded-[30px] bg-white px-5 py-8 shadow-soft transition-all duration-200 sm:px-8 sm:py-10 lg:px-10 lg:py-9 xl:px-12 xl:py-10 " +
    (isWidePreview ? "lg:max-w-[1180px]" : "lg:max-w-[820px]");
  const editingFooterClass =
    "sticky bottom-0 rounded-t-[28px] bg-[#fbfaf7]/92 pb-2 pt-3 backdrop-blur lg:static lg:mx-auto lg:w-full lg:rounded-[28px] lg:bg-white/85 lg:p-4 lg:shadow-soft " +
    (isWidePreview ? "lg:max-w-[1180px]" : "lg:max-w-[820px]");

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-[#fbfaf7] px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 lg:bg-[#F4F0E9] lg:px-8 lg:py-6 xl:py-8"
      ref={shellRef}
    >
      <div className="mx-auto grid min-h-[calc(100svh-3rem)] w-full max-w-[680px] content-between gap-6 lg:min-h-[calc(100dvh-48px)] lg:max-w-[1180px] xl:min-h-[calc(100dvh-64px)] xl:max-w-[1320px]">
        <div className="grid gap-5 lg:min-h-0">
          <div className="flex min-h-11 items-center justify-between gap-4">
            {presentationMode === "editing" ? (
              <span className="hidden rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sage-700 shadow-soft sm:inline-flex">
                Rediger profil
              </span>
            ) : (
              <span aria-hidden="true" />
            )}
            <div className="ml-auto">{editingBackNavigation}</div>
          </div>

          <div
            className={editingContentClass}
            ref={contentScrollRef}
          >
            <div className="min-w-0">{children}</div>
          </div>
        </div>

        {hidePrimaryAction ? null : (
          <div className={editingFooterClass}>
            {footerLeading}
            <div className="lg:flex lg:flex-wrap lg:items-center lg:gap-3">
              {footer}
            </div>
            {ctaHelper ? (
              <p className="mt-3 text-left text-sm font-medium text-ink/55">
                {ctaHelper}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function StepIntro({
  eyebrow,
  text,
  title,
}: {
  eyebrow: string;
  text: string;
  title: string;
}) {
  return (
    <div className="mb-8 grid gap-3 lg:mb-5 lg:gap-2">
      <p className="text-sm font-semibold uppercase tracking-wide text-sage-700 lg:text-xs">
        {eyebrow}
      </p>
      <h2 className="text-4xl font-semibold leading-tight text-midnight sm:text-5xl lg:text-3xl xl:text-4xl">
        {title}
      </h2>
      <p className="text-base leading-7 text-ink/64 lg:text-sm lg:leading-6">
        {text}
      </p>
    </div>
  );
}

function SectionHeading({
  description,
  Icon,
  title,
}: {
  description?: string;
  Icon: LucideIcon;
  title: string;
}) {
  return (
    <div>
      <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-sage-700">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {title}
      </p>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-ink/64">{description}</p>
      ) : null}
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
      const prepared = await prepareImageFileForUpload(file, {
        maxFileSizeBytes,
      });
      onSelect(prepared, createPreview ? URL.createObjectURL(prepared) : "");
    } catch (error) {
      event.target.value = "";
      onError?.(
        error instanceof Error
          ? error.message
          : "Billedet kunne ikke læses. Prøv et andet billede.",
      );
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
        <img
          alt=""
          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
          src={imageUrl}
        />
      ) : (
        <span className="grid justify-items-center gap-4 px-6">
          <span className="grid size-16 place-items-center rounded-full bg-white text-sage-700 shadow-soft">
            <Upload className="size-7" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold text-midnight">{label}</span>
          {helperText ? (
            <span className="whitespace-pre-line text-sm font-medium leading-5 text-ink/55">
              {helperText}
            </span>
          ) : null}
        </span>
      )}
      <input
        accept={imageUploadAccept}
        className="sr-only"
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
    </button>
  );
}

function MissingCard({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
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

function InlineBrandLogo({
  className,
  src,
}: {
  className: string;
  src: string;
}) {
  if (isSvgSrc(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        alt="SoulEvents"
        className={className + " object-contain"}
        height={240}
        src={src}
        width={520}
      />
    );
  }

  return (
    <Image
      alt="SoulEvents"
      className={className + " object-contain"}
      height={240}
      src={src}
      width={520}
    />
  );
}

export function ProfileForm({
  adminTargetFacilitatorId,
  adminReturnTo,
  autosaveEnabled = true,
  backHref = "/facilitator",
  backLabel = "Tilbage",
  presentationMode = "onboarding",
  profile,
  facilitatorProfile,
  categories,
  regions,
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
      ? onboardingStepIds
          .map((stepId) => steps.find((step) => step.id === stepId))
          .filter((step): step is (typeof steps)[number] => Boolean(step))
      : editingStepIds
          .map((stepId) => steps.find((step) => step.id === stepId))
          .filter((step): step is (typeof steps)[number] => Boolean(step));
  const activeStepIds = activeSteps.map((step) => step.id);
  const activeStepIdsKey = activeStepIds.join("|");
  const onboardingDraftStepStorageKey = `${onboardingDraftStepStorageKeyBase}:${facilitatorProfile.id ?? profile.email}`;
  const [stepIndex, setStepIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
  const [profileImageSubmissionError, setProfileImageSubmissionError] =
    useState(false);
  const [storySubmissionError, setStorySubmissionError] = useState(false);
  const continueInProgressRef = useRef(false);
  const hasResolvedInitialOnboardingStepRef = useRef(
    presentationMode !== "onboarding",
  );
  const latestPostalCodeLookupRef = useRef("");
  const pendingImageSectionTargetRef = useRef<ImageSectionTarget | null>(null);
  const pendingMissingFocusTargetRef = useRef<MissingFocusTarget | null>(null);
  const locationSectionRef = useRef<HTMLDivElement | null>(null);
  const countryNameInputRef = useRef<HTMLInputElement | null>(null);
  const postalCodeInputRef = useRef<HTMLInputElement | null>(null);
  const cityInputRef = useRef<HTMLInputElement | null>(null);
  const profileImageSectionRef = useRef<HTMLElement | null>(null);
  const moodImageSectionRef = useRef<HTMLElement | null>(null);
  const bannerImageSectionRef = useRef<HTMLElement | null>(null);
  const bannerImageInputRef = useRef<HTMLInputElement | null>(null);
  const experiencesSectionRef = useRef<HTMLDivElement | null>(null);
  const storySectionRef = useRef<HTMLDivElement | null>(null);
  const storyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const approvalMissingRequirementsRef = useRef<HTMLDivElement | null>(null);
  const approvalTermsRef = useRef<HTMLDivElement | null>(null);
  const [, startImageTransition] = useTransition();
  const [firstName, setFirstName] = useState(names.firstName);
  const [lastName, setLastName] = useState(names.lastName);
  const fullPublicName = [firstName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  const initialProfileName = value(facilitatorProfile.company_name);
  const [useCustomProfileName, setUseCustomProfileName] = useState(() =>
    Boolean(initialProfileName && initialProfileName !== fullPublicName),
  );
  const [profileName, setProfileName] = useState(initialProfileName);
  const [addressLine, setAddressLine] = useState(
    value(facilitatorProfile.address_line),
  );
  const initialPostalLocation = splitDanishPostalCity(
    facilitatorProfile.postal_code,
  );
  const initialCityLocation = splitDanishPostalCity(facilitatorProfile.city);
  const initialPostalCode =
    initialPostalLocation.postalCode || initialCityLocation.postalCode;
  const initialCity =
    initialCityLocation.city ||
    (initialCityLocation.postalCode ? "" : value(facilitatorProfile.city)) ||
    initialPostalLocation.city ||
    value(getLocalDanishPostalCity(initialPostalCode));
  const initialCountryCode = inferProfileCountryCode({
    city: facilitatorProfile.city,
    country: facilitatorProfile.country,
    postalCode: facilitatorProfile.postal_code,
  });
  const initialCustomCountryName =
    initialCountryCode === "OTHER"
      ? value(facilitatorProfile.country_name || facilitatorProfile.country)
      : value(facilitatorProfile.country_name);
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [city, setCity] = useState(initialCity);
  const [postalCodeMessage, setPostalCodeMessage] = useState(
    initialPostalCode && !initialCity
      ? "Indtast postnummer, så finder vi automatisk byen."
      : "",
  );
  const [country, setCountry] = useState(initialCountryCode);
  const [countryName, setCountryName] = useState(initialCustomCountryName);
  const [regionText, setRegionText] = useState(
    value(facilitatorProfile.region_text),
  );
  const [locationSubmissionError, setLocationSubmissionError] = useState(false);
  const [highlightedMissingTarget, setHighlightedMissingTarget] =
    useState<MissingFocusTarget | null>(null);
  const [highlightedApprovalIssue, setHighlightedApprovalIssue] =
    useState<ApprovalIssueTarget | null>(null);
  const [isOnlineFacilitator, setIsOnlineFacilitator] = useState(
    Boolean(facilitatorProfile.is_online_facilitator),
  );
  const [showPublicLocation, setShowPublicLocation] = useState(
    facilitatorProfile.show_public_location !== false,
  );
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState(
    facilitatorProfile.profile_image_path
      ? publicImageUrl(facilitatorProfile.profile_image_path)
      : "",
  );
  const [moodImages, setMoodImages] = useState<MoodImage[]>(
    Array.from({ length: 3 }, (_, index) => ({
      fileName: "",
      path: galleryImages[index]?.image_path ?? "",
      previewUrl: galleryImages[index]?.image_path
        ? publicImageUrl(galleryImages[index].image_path)
        : "",
    })),
  );
  const [bannerImagePath, setBannerImagePath] = useState(
    facilitatorProfile.facilitator_banner_image_path ?? "",
  );
  const [bannerImageUrl, setBannerImageUrl] = useState(
    facilitatorProfile.facilitator_banner_image_path
      ? publicImageUrl(facilitatorProfile.facilitator_banner_image_path)
      : "",
  );
  const [bannerImageStatus, setBannerImageStatus] = useState<SlotStatus>({
    message: "",
    status: "idle",
  });
  const [moodImageStatuses, setMoodImageStatuses] = useState<SlotStatus[]>(
    Array.from({ length: 3 }, () => ({ message: "", status: "idle" })),
  );
  const visibleCategoryIds = new Set(categories.map((category) => category.id));
  const initialSelectedCategoryIds = selectedCategoryIds.filter((categoryId) =>
    visibleCategoryIds.has(categoryId),
  );
  const [selectedExperiences, setSelectedExperiences] = useState(
    initialSelectedCategoryIds,
  );
  const [story, setStory] = useState(
    value(
      facilitatorProfile.long_description ||
        facilitatorProfile.short_description,
    ),
  );
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [website, setWebsite] = useState(value(facilitatorProfile.website_url));
  const [facebook, setFacebook] = useState(
    value(facilitatorProfile.facebook_url),
  );
  const [instagram, setInstagram] = useState(
    value(facilitatorProfile.instagram_url),
  );
  const [youtube, setYoutube] = useState(value(facilitatorProfile.youtube_url));
  const [paymentMobilepayNumber, setPaymentMobilepayNumber] = useState(
    value(facilitatorProfile.payment_mobilepay_number),
  );
  const [paymentBankRegistrationNumber, setPaymentBankRegistrationNumber] =
    useState(value(facilitatorProfile.payment_bank_registration_number));
  const [paymentBankAccountNumber, setPaymentBankAccountNumber] = useState(
    value(facilitatorProfile.payment_bank_account_number),
  );
  const [paymentBankAccountName, setPaymentBankAccountName] = useState(
    value(facilitatorProfile.payment_bank_account_name),
  );
  const [paymentExternalUrl, setPaymentExternalUrl] = useState(
    value(facilitatorProfile.payment_external_url),
  );
  const [paymentCashEnabled, setPaymentCashEnabled] = useState(
    Boolean(value(facilitatorProfile.payment_instructions)),
  );
  const [offersIndividualServices, setOffersIndividualServices] = useState<boolean | null>(
    typeof facilitatorProfile.offers_services === "boolean"
      ? facilitatorProfile.offers_services
      : null,
  );
  const [serviceDescription, setServiceDescription] = useState(
    value(facilitatorProfile.service_description),
  );
  const [specialties, setSpecialties] = useState(
    value(facilitatorProfile.specialties),
  );
  const [openAreaInfoId, setOpenAreaInfoId] = useState<string | null>(null);
  const [stepSaveStatus, setStepSaveStatus] = useState<SlotStatus>({
    message: "",
    status: "idle",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const currentStep = activeSteps[stepIndex] ?? activeSteps[0] ?? steps[0];
  const isProfileOverviewStep = currentStep.id === "profile";
  const isApprovalStep = currentStep.id === "approval";
  const shellBackHref = backHref;
  const activeDesktopLogoSrc =
    logoSources?.desktop ?? "/brand/soulevents-logo.png";
  const displayedStep =
    presentationMode !== "onboarding" && currentStep.id === "review"
      ? {
          ...currentStep,
          eyebrow: "Rediger profil",
          text: "Tryk på det afsnit, du vil ændre. Dine eksisterende oplysninger er udfyldt.",
          title: "Rediger profil",
        }
      : currentStep;
  const publicProfileName = useCustomProfileName
    ? profileName.trim()
    : fullPublicName;
  const hasWorkArea = selectedExperiences.length > 0;
  const specialtyText = normalizeSpecialtyText(specialties);
  const hasIndividualServicesDescription =
    offersIndividualServices && serviceDescription.trim().length > 0;
  const servicesChoiceError =
    offersIndividualServices === null
      ? "Vælg, om du også tilbyder individuelle ydelser."
      : null;
  const facebookValidation = validateSocialProfileLink(facebook, "facebook");
  const instagramValidation = validateSocialProfileLink(instagram, "instagram");
  const facebookError =
    facebook.trim() && !facebookValidation.ok
      ? facebookValidation.message
      : null;
  const instagramError =
    instagram.trim() && !instagramValidation.ok
      ? instagramValidation.message
      : null;
  const normalizedPhoneValue = normalizeDanishPhoneNumber(phone);
  const phoneError =
    phone.trim() && normalizedPhoneValue === null
      ? danishPhoneValidationMessage
      : null;
  const hasLinks = Boolean(
    website.trim() || facebook.trim() || instagram.trim() || youtube.trim(),
  );
  const normalizedStory = normalizeFacilitatorStory(story);
  const storyMeetsMinimum = normalizedStory.length >= facilitatorStoryMinLength;
  const storyMissingMessage =
    "Skriv gerne lidt mere om dig selv, før profilen sendes til SoulEvents.";
  const isDanishLocation = isDanishProfileCountry(country);
  const isOtherCountry = isOtherProfileCountry(country);
  const normalizedLocationPostalCode = postalCode.trim();
  const normalizedLocationCity = city.trim();
  const normalizedCountryName = countryName.trim();
  const locationCountryNameMissing = isOtherCountry && !normalizedCountryName;
  const locationPostalCodeMissingOrInvalid =
    !locationCountryNameMissing &&
    (!normalizedLocationPostalCode ||
      (isDanishLocation && !/^\d{4}$/.test(normalizedLocationPostalCode)));
  const locationCityMissing =
    !locationCountryNameMissing &&
    Boolean(normalizedLocationPostalCode) &&
    !normalizedLocationCity;
  const locationIsComplete = isDanishLocation
    ? /^\d{4}$/.test(normalizedLocationPostalCode) &&
      Boolean(normalizedLocationCity)
    : Boolean(normalizedLocationPostalCode) &&
      Boolean(normalizedLocationCity) &&
      (!isOtherCountry || Boolean(normalizedCountryName));
  const locationValidationMessage = isDanishLocation
    ? !normalizedLocationPostalCode
      ? "Indtast postnummer, så finder vi automatisk byen."
      : !/^\d{4}$/.test(normalizedLocationPostalCode)
        ? "Dansk postnummer skal bestå af fire cifre."
        : !normalizedLocationCity
          ? "Vi kunne ikke finde en by til dette postnummer."
          : ""
    : locationCountryNameMissing
      ? "Skriv landets navn."
      : !normalizedLocationPostalCode || !normalizedLocationCity
        ? "Postnummer og by skal udfyldes."
        : "";
  const missingRequired = [
    !firstName.trim() || !lastName.trim()
      ? { label: "Dit navn", step: "person" as PrototypeStep }
      : null,
    !publicProfileName
      ? { label: "Profilnavn", step: "person" as PrototypeStep }
      : null,
    !locationIsComplete
      ? {
          label: locationCountryNameMissing
            ? "Skriv landets navn"
            : "Udfyld postnummer og by",
          step: "location" as PrototypeStep,
        }
      : null,
    !profileImageUrl
      ? {
          label: "Tilføj profilbillede",
          step: "profile-image" as PrototypeStep,
        }
      : null,
    moodImages.every((image) => !image.previewUrl)
      ? {
          label: "Tilføj mindst ét stemningsbillede",
          step: "profile-image" as PrototypeStep,
        }
      : null,
    !hasWorkArea
      ? {
          label: "Vælg mindst ét arbejdsområde",
          step: "experiences" as PrototypeStep,
        }
      : null,
    !storyMeetsMinimum
      ? { label: "Gå til fortælling", step: "story" as PrototypeStep }
      : null,
  ].filter((item): item is { label: string; step: PrototypeStep } =>
    Boolean(item),
  );
  const missingStepIds = new Set(missingRequired.map((item) => item.step));
  const shouldShowApprovalPersonEditor =
    isApprovalStep && missingStepIds.has("person");
  const shouldShowApprovalImageEditor =
    isApprovalStep && missingStepIds.has("profile-image");
  const shouldShowApprovalExperiencesEditor =
    isApprovalStep && missingStepIds.has("experiences");
  const shouldShowApprovalStoryEditor =
    isApprovalStep && missingStepIds.has("story");
  const shouldUseEmbeddedProfileSection =
    isProfileOverviewStep || isApprovalStep;
  const profileIsReadyForSubmission = missingRequired.length === 0;
  const approvalReadyForSubmit = profileIsReadyForSubmission && acceptedTerms;
  const approvalCtaLabel = "Opret profil";
  const approvalHelper = approvalReadyForSubmit
    ? "Din profil er klar til indsendelse."
    : "Udfyld de markerede oplysninger og acceptér vilkårene, før profilen kan sendes.";

  async function lookupPostalCodeCity(nextPostalCode: string) {
    latestPostalCodeLookupRef.current = nextPostalCode;
    setPostalCodeMessage("Finder by ud fra postnummer...");

    const result = await fetchDanishPostalCity(nextPostalCode);

    if (latestPostalCodeLookupRef.current !== nextPostalCode) return;

    if (result.ok) {
      setCity(result.city);
      setPostalCodeMessage(`${result.city} blev fundet automatisk.`);
      return;
    }

    setCity("");
    setPostalCodeMessage("Vi kunne ikke finde en by til dette postnummer.");
  }

  function handlePostalCodeChange(nextValue: string) {
    if (!isDanishLocation) {
      const normalizedPostalCode = normalizeInternationalPostalCode(nextValue);
      setPostalCode(normalizedPostalCode);
      setPostalCodeMessage("");
      return;
    }

    const normalizedPostalCode = normalizeDanishPostalCode(nextValue);
    setPostalCode(normalizedPostalCode);

    if (!normalizedPostalCode) {
      latestPostalCodeLookupRef.current = "";
      setCity("");
      setPostalCodeMessage("Indtast postnummer, så finder vi automatisk byen.");
      return;
    }

    if (normalizedPostalCode.length < 4) {
      latestPostalCodeLookupRef.current = normalizedPostalCode;
      setCity("");
      setPostalCodeMessage("");
      return;
    }

    const localCity = getLocalDanishPostalCity(normalizedPostalCode);

    if (localCity) {
      latestPostalCodeLookupRef.current = normalizedPostalCode;
      setCity(localCity);
      setPostalCodeMessage(`${localCity} blev fundet automatisk.`);
      return;
    }

    setCity("");
    void lookupPostalCodeCity(normalizedPostalCode);
  }

  function handleCountryChange(nextCountry: string) {
    const nextCountryCode = normalizeProfileCountryCode(nextCountry);
    const nextIsDanishLocation = isDanishProfileCountry(nextCountryCode);
    const currentIsDanishLocation = isDanishProfileCountry(country);

    setCountry(nextCountryCode);
    setLocationSubmissionError(false);

    if (!isOtherProfileCountry(nextCountryCode)) {
      setCountryName("");
    }

    if (!nextIsDanishLocation && currentIsDanishLocation) {
      latestPostalCodeLookupRef.current = "";
      setCity("");
      setRegionText("");
      setPostalCodeMessage("");
      return;
    }

    if (nextIsDanishLocation && !currentIsDanishLocation) {
      const normalizedPostalCode = normalizeDanishPostalCode(postalCode);
      setPostalCode(normalizedPostalCode);
      setCity("");
      setRegionText("");

      if (!normalizedPostalCode) {
        setPostalCodeMessage(
          "Indtast postnummer, så finder vi automatisk byen.",
        );
        return;
      }

      if (normalizedPostalCode.length < 4) {
        setPostalCodeMessage("");
        return;
      }

      const localCity = getLocalDanishPostalCity(normalizedPostalCode);

      if (localCity) {
        latestPostalCodeLookupRef.current = normalizedPostalCode;
        setCity(localCity);
        setRegionText("");
        setPostalCodeMessage(`${localCity} blev fundet automatisk.`);
        return;
      }

      void lookupPostalCodeCity(normalizedPostalCode);
    }
  }

  useEffect(() => {
    if (!isDanishLocation || postalCode.length !== 4 || city) return;

    let cancelled = false;
    latestPostalCodeLookupRef.current = postalCode;

    fetchDanishPostalCity(postalCode).then((result) => {
      if (cancelled || latestPostalCodeLookupRef.current !== postalCode) return;

      if (result.ok) {
        setCity(result.city);
        setRegionText("");
        setPostalCodeMessage(`${result.city} blev fundet automatisk.`);
        return;
      }

      setCity("");
      setPostalCodeMessage("Vi kunne ikke finde en by til dette postnummer.");
    });

    return () => {
      cancelled = true;
    };
  }, [city, isDanishLocation, postalCode]);

  useEffect(() => {
    if (presentationMode !== "onboarding") {
      hasResolvedInitialOnboardingStepRef.current = true;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const resolvedStepIndex = resolveInitialStepIndex({
        activeStepIds: activeStepIdsKey.split("|") as PrototypeStep[],
        presentationMode,
        storageKey: onboardingDraftStepStorageKey,
      });

      hasResolvedInitialOnboardingStepRef.current = true;
      setStepIndex(resolvedStepIndex);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeStepIdsKey, onboardingDraftStepStorageKey, presentationMode]);

  useEffect(() => {
    if (
      presentationMode === "onboarding" &&
      !hasResolvedInitialOnboardingStepRef.current
    )
      return;

    const url = new URL(window.location.href);
    url.searchParams.delete("confirmed");
    url.searchParams.set("prototypeStep", currentStep.id);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (presentationMode === "onboarding" && currentStep.id !== "complete") {
      window.localStorage.setItem(
        onboardingDraftStepStorageKey,
        currentStep.id,
      );
    }
  }, [currentStep.id, onboardingDraftStepStorageKey, presentationMode]);

  const scrollToLocationError = useCallback(() => {
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    locationSectionRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });

    window.requestAnimationFrame(() => {
      if (isOtherCountry && !normalizedCountryName) {
        countryNameInputRef.current?.focus();
        return;
      }

      if (
        !normalizedLocationPostalCode ||
        (isDanishLocation && !/^\d{4}$/.test(normalizedLocationPostalCode))
      ) {
        postalCodeInputRef.current?.focus();
        return;
      }

      cityInputRef.current?.focus();
    });
  }, [
    isDanishLocation,
    isOtherCountry,
    normalizedCountryName,
    normalizedLocationPostalCode,
  ]);

  const focusMissingTarget = useCallback(
    (target: MissingFocusTarget) => {
      const targetElement =
        target === "profile-image"
          ? profileImageSectionRef.current
          : target === "mood-image"
            ? moodImageSectionRef.current
            : target === "experiences"
              ? experiencesSectionRef.current
              : target === "story"
                ? storySectionRef.current
                : target === "location"
                  ? locationSectionRef.current
                  : null;

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      targetElement?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });

      setHighlightedMissingTarget(target);

      window.setTimeout(() => {
        if (target === "story") {
          storyTextareaRef.current?.focus();
          return;
        }

        if (target === "location") {
          if (isOtherCountry && !normalizedCountryName) {
            countryNameInputRef.current?.focus();
            return;
          }
          if (
            !normalizedLocationPostalCode ||
            (isDanishLocation && !/^\d{4}$/.test(normalizedLocationPostalCode))
          ) {
            postalCodeInputRef.current?.focus();
            return;
          }
          cityInputRef.current?.focus();
          return;
        }

        targetElement?.focus({ preventScroll: true });
      }, reducedMotion ? 0 : 260);

      window.setTimeout(() => {
        setHighlightedMissingTarget((current) =>
          current === target ? null : current,
        );
      }, 1800);
    },
    [
      isDanishLocation,
      isOtherCountry,
      normalizedCountryName,
      normalizedLocationPostalCode,
    ],
  );

  function missingItemTarget(item: {
    label: string;
    step: PrototypeStep;
  }): MissingFocusTarget | null {
    if (item.step === "profile-image") {
      return item.label.includes("stemningsbillede")
        ? "mood-image"
        : "profile-image";
    }
    if (item.step === "experiences") return "experiences";
    if (item.step === "story") return "story";
    if (item.step === "location") return "location";
    if (item.step === "person") return "person";
    return null;
  }

  function missingTargetStep(target: MissingFocusTarget): PrototypeStep {
    if (target === "profile-image" || target === "mood-image") {
      return "profile-image";
    }
    return target;
  }

  function highlightClass(target: MissingFocusTarget) {
    return highlightedMissingTarget === target
      ? " ring-4 ring-[#B56F8A]/30 ring-offset-2 ring-offset-white"
      : "";
  }

  const focusApprovalIssue = useCallback(
    (target: ApprovalIssueTarget) => {
      const targetElement =
        target === "missing-requirements"
          ? approvalMissingRequirementsRef.current
          : approvalTermsRef.current;

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      targetElement?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
      });

      setHighlightedApprovalIssue(target);

      window.setTimeout(() => {
        targetElement?.focus({ preventScroll: true });
      }, reducedMotion ? 0 : 260);

      window.setTimeout(() => {
        setHighlightedApprovalIssue((current) =>
          current === target ? null : current,
        );
      }, 1800);
    },
    [],
  );

  function approvalHighlightClass(target: ApprovalIssueTarget) {
    return highlightedApprovalIssue === target
      ? " ring-4 ring-[#B56F8A]/30 ring-offset-2 ring-offset-white"
      : "";
  }

  useEffect(() => {
    if (currentStep.id !== "profile-image") return;

    const target = pendingImageSectionTargetRef.current;
    if (!target) return;

    pendingImageSectionTargetRef.current = null;
    const targetElement =
      target === "profile"
        ? profileImageSectionRef.current
        : target === "mood"
          ? moodImageSectionRef.current
          : bannerImageSectionRef.current;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    targetElement?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [currentStep.id]);

  useEffect(() => {
    const target = pendingMissingFocusTargetRef.current;
    if (!target) return;
    if (missingTargetStep(target) !== currentStep.id) return;

    pendingMissingFocusTargetRef.current = null;
    const frame = window.requestAnimationFrame(() => focusMissingTarget(target));

    return () => window.cancelAnimationFrame(frame);
  }, [currentStep.id, focusMissingTarget]);

  useEffect(() => {
    if (
      !locationSubmissionError ||
      (currentStep.id !== "profile" && currentStep.id !== "location")
    )
      return;
    scrollToLocationError();
  }, [currentStep.id, locationSubmissionError, scrollToLocationError]);

  async function getCurrentLocationPayload({
    requireComplete = true,
  }: { requireComplete?: boolean } = {}) {
    const nextCountry = normalizeProfileCountryCode(country);
    const nextIsDanishLocation = isDanishProfileCountry(nextCountry);
    const nextIsOtherCountry = isOtherProfileCountry(nextCountry);
    const nextPostalCode = nextIsDanishLocation
      ? normalizeDanishPostalCode(postalCode)
      : normalizeInternationalPostalCode(postalCode).trim();
    let nextCity = city.trim();
    const nextCountryName = nextIsOtherCountry
      ? countryName.trim().slice(0, 80)
      : "";
    const nextRegionText = nextIsDanishLocation
      ? ""
      : regionText.trim().slice(0, 80);

    if (nextIsDanishLocation && nextPostalCode.length === 4) {
      const localCity = getLocalDanishPostalCity(nextPostalCode);

      if (localCity) {
        nextCity = localCity;
      } else if (!nextCity) {
        const lookupResult = await fetchDanishPostalCity(nextPostalCode);
        nextCity = lookupResult.ok ? lookupResult.city : "";
      }
    }

    if (nextPostalCode !== postalCode) {
      setPostalCode(nextPostalCode);
    }

    if (nextCity !== city) {
      setCity(nextCity);
    }

    if (nextCountry !== country) {
      setCountry(nextCountry);
    }

    if (nextCountryName !== countryName) {
      setCountryName(nextCountryName);
    }

    if (nextRegionText !== regionText) {
      setRegionText(nextRegionText);
    }

    if (nextIsDanishLocation && nextPostalCode.length === 4) {
      setPostalCodeMessage(
        nextCity
          ? `${nextCity} blev fundet automatisk.`
          : "Vi kunne ikke finde en by til dette postnummer.",
      );
    }

    const locationValidation = getProfileLocationSaveValidation({
      city: nextCity,
      countryName: nextCountryName,
      isDanishLocation: nextIsDanishLocation,
      isOtherCountry: nextIsOtherCountry,
      postalCode: nextPostalCode,
      requireComplete,
    });

    return {
      canSave: locationValidation.canSave,
      isComplete: locationValidation.isComplete,
      validationMessage: locationValidation.validationMessage,
      values: {
        address_line: addressLine,
        city: nextCity,
        country: nextCountry,
        country_name: nextCountryName,
        is_online_facilitator:
          presentationMode === "onboarding"
            ? Boolean(facilitatorProfile.is_online_facilitator)
            : isOnlineFacilitator,
        postal_code: nextPostalCode,
        region_text: nextRegionText,
        show_public_location: showPublicLocation,
      },
    };
  }

  const contactValues = {
    company_name: publicProfileName,
    first_name: firstName,
    full_name: fullPublicName,
    last_name: lastName,
    long_description: story,
    phone,
    short_description: story.trim().slice(0, 300),
  };

  async function saveProfileOverviewStep({
    requireLocation = true,
  }: { requireLocation?: boolean } = {}) {
    if (phoneError) {
      return { message: phoneError, ok: false };
    }

    const locationPayload = await getCurrentLocationPayload({
      requireComplete: requireLocation,
    });

    if (
      !locationPayload.canSave ||
      (requireLocation && !locationPayload.isComplete)
    ) {
      setLocationSubmissionError(true);
      scrollToLocationError();
      return {
        message:
          locationPayload.validationMessage ||
          "Postnummer og by skal udfyldes.",
        ok: false,
      };
    }

    const contactResult = await autosaveFacilitatorProfileAction({
      section: "contact",
      values: contactValues,
    });

    if (!contactResult.ok) return contactResult;

    const locationResult = await autosaveFacilitatorProfileAction({
      section: "location",
      values: locationPayload.values,
    });

    if (!locationResult.ok) return locationResult;

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

    if (selectedExperiences.length > 0) {
      const categoryResult = await autosaveFacilitatorProfileAction({
        adminTargetFacilitatorId: adminTargetFacilitatorId ?? null,
        section: "categories",
        values: { category_ids: selectedExperiences, specialties },
      });

      if (!categoryResult.ok) return categoryResult;
    }

    if (!facebookValidation.ok)
      return { message: facebookValidation.message, ok: false };
    if (!instagramValidation.ok)
      return { message: instagramValidation.message, ok: false };

    const socialResult = await autosaveFacilitatorProfileAction({
      adminTargetFacilitatorId: adminTargetFacilitatorId ?? null,
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

    if (!socialResult.ok) return socialResult;

    const servicesResult = await autosaveFacilitatorProfileAction({
      section: "services",
      values: {
        offers_services: offersIndividualServices,
        individual_service_other_title: "",
        individual_service_types: [],
        service_description: serviceDescription,
        show_in_local_service_results: offersIndividualServices,
      },
    });

    if (!servicesResult.ok) return servicesResult;

    return { message: "Din profil er gemt.", ok: true };
  }

  async function saveCurrentStep({
    submitForReview = true,
  }: { submitForReview?: boolean } = {}) {
    const shouldPersistAdminCategories =
      presentationMode === "admin" && currentStep.id === "experiences";
    const shouldPersistAdminImages =
      presentationMode === "admin" && currentStep.id === "profile-image";
    const shouldPersistAdminLinks =
      presentationMode === "admin" && currentStep.id === "links";

    if (
      (!autosaveEnabled || presentationMode === "admin") &&
      !shouldPersistAdminCategories &&
      !shouldPersistAdminImages &&
      !shouldPersistAdminLinks
    ) {
      return { message: "Gemt", ok: true };
    }

    setStepSaveStatus({ message: "Gemmer...", status: "saving" });

    if (currentStep.id === "profile") {
      return saveProfileOverviewStep({ requireLocation: submitForReview });
    }

    if (currentStep.id === "person") {
      if (phoneError) return { message: phoneError, ok: false };

      const result = await autosaveFacilitatorProfileAction({
        section: "contact",
        values: contactValues,
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "location") {
      const result = await autosaveFacilitatorProfileAction({
        section: "location",
        values: {
          address_line: addressLine,
          city,
          country,
          country_name: countryName,
          is_online_facilitator: isOnlineFacilitator,
          postal_code: postalCode,
          region_text: regionText,
          show_public_location: showPublicLocation,
        },
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
        values: {},
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "experiences") {
      if (shouldPersistAdminCategories && !adminTargetFacilitatorId) {
        return { message: "Arrangørprofilen kunne ikke genkendes.", ok: false };
      }

      const result = await autosaveFacilitatorProfileAction({
        adminTargetFacilitatorId: shouldPersistAdminCategories
          ? (adminTargetFacilitatorId ?? null)
          : null,
        section: "categories",
        values: { category_ids: selectedExperiences, specialties },
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "story") {
      if (phoneError) return { message: phoneError, ok: false };

      const result = await autosaveFacilitatorProfileAction({
        section: "contact",
        values: contactValues,
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "links") {
      if (phoneError) return { message: phoneError, ok: false };
      if (!facebookValidation.ok)
        return { message: facebookValidation.message, ok: false };
      if (!instagramValidation.ok)
        return { message: instagramValidation.message, ok: false };

      const contactResult = await autosaveFacilitatorProfileAction({
        adminTargetFacilitatorId: shouldPersistAdminLinks
          ? (adminTargetFacilitatorId ?? null)
          : null,
        section: "contact",
        values: contactValues,
      });

      if (!contactResult.ok) return contactResult;

      const result = await autosaveFacilitatorProfileAction({
        adminTargetFacilitatorId: shouldPersistAdminLinks
          ? (adminTargetFacilitatorId ?? null)
          : null,
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
          payment_deadline_days: String(facilitatorProfile.payment_deadline_days ?? 14),
          payment_external_url: paymentExternalUrl,
          payment_instructions: paymentCashEnabled ? "Kontant betaling tilbydes." : "",
          payment_mobilepay_number: paymentMobilepayNumber,
        },
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "services") {
      if (servicesChoiceError) return { message: servicesChoiceError, ok: false };

      const result = await autosaveFacilitatorProfileAction({
        section: "services",
        values: {
          offers_services: offersIndividualServices,
          individual_service_other_title: "",
          individual_service_types: [],
          service_description: serviceDescription,
          show_in_local_service_results: offersIndividualServices,
        },
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "approval") {
      if (submitForReview && missingRequired.length > 0) {
        return {
          message:
            "Udfyld de markerede oplysninger, før profilen kan sendes til SoulEvents.",
          ok: false,
        };
      }

      if (submitForReview && !acceptedTerms) {
        return {
          message:
            "Du skal acceptere vilkårene, før profilen kan sendes til SoulEvents.",
          ok: false,
        };
      }

      const saveResult = await saveProfileOverviewStep({
        requireLocation: submitForReview,
      });

      if (!saveResult.ok) return saveResult;

      if (!submitForReview) {
        return { message: "Din profilkladde er gemt.", ok: true };
      }

      const result = await submitFacilitatorProfileForReviewAction({
        acceptedTerms,
      });

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
      if (presentationMode === "onboarding" && currentStep.id === "approval") {
        window.requestAnimationFrame(() => {
          focusApprovalIssue(
            missingRequired.length > 0 ? "missing-requirements" : "terms",
          );
        });
      }
      return;
    }

    if (presentationMode === "onboarding" && currentStep.id === "approval") {
      window.localStorage.removeItem(onboardingDraftStepStorageKey);
      router.push("/facilitator/profile/submitted");
      return;
    }

    setStepSaveStatus({ message: saveResult.message, status: "success" });
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

    if (
      presentationMode !== "onboarding" &&
      currentStep.id !== "review" &&
      stepIndex >= activeSteps.length - 1
    ) {
      goToStep("review");
      return;
    }

    setStepSaveStatus({ message: "", status: "idle" });
    setStepIndex((current) => Math.min(current + 1, activeSteps.length - 1));
  }

  async function saveDraftAndExit() {
    if (continueInProgressRef.current) {
      return;
    }

    continueInProgressRef.current = true;
    setIsBusy(true);
    setStepSaveStatus({ message: "", status: "idle" });

    const saveResult = await saveCurrentStep({ submitForReview: false });

    window.localStorage.setItem(onboardingDraftStepStorageKey, currentStep.id);
    continueInProgressRef.current = false;
    setIsBusy(false);
    if (!saveResult.ok) {
      router.replace(backHref);
      return;
    }
    router.replace(backHref);
  }

  function goBack() {
    continueInProgressRef.current = false;
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

  function editImagesFromReview(target: ImageSectionTarget) {
    pendingImageSectionTargetRef.current = target;
    editFromReview("profile-image");
  }

  function goToMissingItem(item: { label: string; step: PrototypeStep }) {
    const target = missingItemTarget(item);

    if (item.step === "location") {
      setLocationSubmissionError(true);
    }
    if (item.step === "profile-image" && item.label.includes("profilbillede")) {
      setProfileImageSubmissionError(true);
    }
    if (item.step === "story") {
      setStorySubmissionError(true);
    }

    if (target) {
      const targetStep = missingTargetStep(target);
      pendingMissingFocusTargetRef.current = target;

      if (currentStep.id === targetStep) {
        window.requestAnimationFrame(() => focusMissingTarget(target));
        return;
      }

      goToStep(targetStep);
      return;
    }

    goToStep(item.step);
  }

  function toggleExperience(categoryId: string) {
    setSelectedExperiences((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
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
    setMoodImageStatuses((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? status : item)),
    );
  }

  function saveMoodImage(index: number, file: File) {
    if (file.size > moodImageMaxFileSize) {
      setMoodImageStatus(index, {
        message: "Billedet er for stort. Vælg et billede på højst 15 MB.",
        status: "error",
      });
      return;
    }

    setMoodImageStatus(index, {
      message: "Uploader og gemmer billedet...",
      status: "saving",
    });
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
          setMoodImageStatus(index, {
            message: "Billedet er gemt.",
            status: "success",
          });
          return;
        }

        setMoodImageStatus(index, { message: result.message, status: "error" });
      } catch {
        setMoodImageStatus(index, {
          message: "Billedet kunne ikke gemmes. Prøv igen.",
          status: "error",
        });
      }
    });
  }

  function removeMoodImage(index: number) {
    setMoodImageStatus(index, {
      message: "Fjerner billedet...",
      status: "saving",
    });
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
          setMoodImageStatus(index, {
            message: "Billedet er fjernet.",
            status: "success",
          });
          return;
        }

        setMoodImageStatus(index, { message: result.message, status: "error" });
      } catch {
        setMoodImageStatus(index, {
          message: "Billedet kunne ikke fjernes. Prøv igen.",
          status: "error",
        });
      }
    });
  }

  function saveBannerImage(file: File) {
    setBannerImageStatus({
      message: "Starter bannerupload...",
      status: "saving",
    });
    startImageTransition(async () => {
      try {
        const signedUpload = await createSignedFacilitatorBannerUploadAction({
          adminTargetFacilitatorId,
          contentType: file.type,
          fileName: file.name,
          size: file.size,
        });

        if (signedUpload.error || !signedUpload.path || !signedUpload.token) {
          setBannerImageStatus({
            message:
              signedUpload.error ??
              "Banneruploaden kunne ikke startes. Prøv igen.",
            status: "error",
          });
          return;
        }

        setBannerImageStatus({
          message: "Uploader bannerbilledet til medielageret...",
          status: "saving",
        });
        const supabase = createBrowserSupabaseClient();
        const { error: uploadError } = await supabase.storage
          .from("media")
          .uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
            cacheControl: "31536000",
            contentType: signedUpload.contentType ?? file.type,
          });

        if (uploadError) {
          setBannerImageStatus({
            message: "Upload til medielager fejlede: " + uploadError.message,
            status: "error",
          });
          return;
        }

        const formData = new FormData();
        formData.set("uploaded_path", signedUpload.path);
        if (adminTargetFacilitatorId) {
          formData.set("admin_target_facilitator_id", adminTargetFacilitatorId);
        }
        const result = await saveFacilitatorBannerImagePathAction(formData);

        if (result.status === "success") {
          setBannerImagePath(result.path ?? "");
          setBannerImageUrl(result.path ? publicImageUrl(result.path) : "");
          setBannerImageStatus({
            message: "Bannerbilledet er gemt.",
            status: "success",
          });
          return;
        }

        setBannerImageStatus({ message: result.message, status: "error" });
      } catch (error) {
        setBannerImageStatus({
          message:
            error instanceof Error
              ? error.message
              : "Bannerbilledet kunne ikke uploades. Kontrollér forbindelsen og prøv igen.",
          status: "error",
        });
      }
    });
  }

  async function handleBannerImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const prepared = await prepareImageFileForUpload(file, {
        maxFileSizeBytes: 10 * 1024 * 1024,
      });
      saveBannerImage(prepared);
      event.target.value = "";
    } catch (error) {
      event.target.value = "";
      setBannerImageStatus({
        message:
          error instanceof Error
            ? error.message
            : "Bannerbilledet kunne ikke læses. Prøv et andet billede.",
        status: "error",
      });
    }
  }

  function removeBannerImage() {
    if (!bannerImagePath) return;

    setBannerImageStatus({
      message: "Fjerner bannerbilledet...",
      status: "saving",
    });
    startImageTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("remove", "yes");
        if (adminTargetFacilitatorId) {
          formData.set("admin_target_facilitator_id", adminTargetFacilitatorId);
        }
        const result = await saveFacilitatorBannerImageAction(formData);

        if (result.status === "success") {
          setBannerImagePath("");
          setBannerImageUrl("");
          setBannerImageStatus({
            message: "Bannerbilledet er fjernet. Standardbanneret vises nu.",
            status: "success",
          });
          return;
        }

        setBannerImageStatus({ message: result.message, status: "error" });
      } catch {
        setBannerImageStatus({
          message: "Bannerbilledet kunne ikke fjernes. Prøv igen.",
          status: "error",
        });
      }
    });
  }

  const profileImageAdded = Boolean(profileImageUrl);
  const profileImageTile = (
    <UploadTile
      className="lg:max-w-none"
      imageUrl={profileImageUrl}
      label={profileImageAdded ? "Udskift profilbillede" : "Vælg profilbillede"}
      onSelect={(file, previewUrl) => {
        setProfileImageSubmissionError(false);
        setProfileImageFile(file);
        setProfileImageUrl(previewUrl);
      }}
    />
  );

  const bannerPreview = resolveFacilitatorBanner({
    bannerImagePath,
    bannerImageUrl,
    fallbackAltText: "Bannerbillede for arrangørprofil",
  });
  const reviewCategories = categories
    .filter((category) => selectedExperiences.includes(category.id))
    .map((category) => ({ name: category.name }));
  const inferredRegionSlug = isDanishLocation
    ? inferRegionSlug({ city, postalCode })
    : null;
  const inferredRegionName = inferredRegionSlug
    ? regions.find((region) => region.slug === inferredRegionSlug)?.name
    : null;
  const reviewPlace = isOnlineFacilitator
    ? "Online arrangør"
    : [city, profileCountryName(country, countryName)]
        .filter(Boolean)
        .join(", ") || null;
  const previewGalleryImages = moodImages
    .filter((image) => Boolean(image.previewUrl))
    .map((image, index) => ({
      altText: `Stemningsbillede ${index + 1}`,
      imagePath: image.path || `preview-mood-${index + 1}`,
      url: image.previewUrl,
    }));
  const previewContactLinks = [
    website.trim() ? { href: website.trim(), label: "Hjemmeside" } : null,
    facebook.trim() ? { href: facebook.trim(), label: "Facebook" } : null,
    instagram.trim() ? { href: instagram.trim(), label: "Instagram" } : null,
    youtube.trim() ? { href: youtube.trim(), label: "YouTube" } : null,
  ].filter((link): link is { href: string; label: string } => Boolean(link));
  const hasPreviewContact = Boolean(
    reviewPlace ||
    profile.email ||
    phone.trim() ||
    previewContactLinks.length > 0,
  );
  const fullProfileHref = facilitatorProfile.id
    ? publicFacilitatorPath(facilitatorProfile.slug || facilitatorProfile.id) +
      (adminReturnTo
        ? "?admin_return=" + encodeURIComponent(adminReturnTo)
        : presentationMode === "admin"
          ? "?admin_return=" + encodeURIComponent(backHref)
          : "?facilitator_return=/facilitator")
    : null;
  const bannerSection = (
    <section
      className="grid scroll-mt-24 gap-5 rounded-[28px] border border-[#E5DCCB] bg-[#FFFDF8] p-5 shadow-[0_14px_34px_rgba(47,36,55,0.045)] sm:p-6"
      id="profile-banner-section"
      ref={bannerImageSectionRef}
    >
      <div>
        <SectionHeading Icon={ImagePlus} title="Bannerbillede" />
        <p className="mt-2 text-lg font-semibold text-midnight">
          Upload et bredt billede, der præsenterer dig og dit univers. Hvis du
          ikke vælger et billede, viser vi SoulEvents’ standardbanner.
        </p>
        <p className="mt-1 text-sm leading-6 text-ink/55">
          Anbefalet format: bredt liggende billede, ca. 16:7. Billedet beskæres
          let, så det passer til banneret.
        </p>
      </div>

      <div className="grid gap-3">
        <button
          aria-label={bannerImagePath ? "Udskift bannerbillede" : "Upload bannerbillede"}
          className="group relative aspect-[16/7] min-h-[180px] overflow-hidden rounded-[24px] bg-midnight text-left shadow-soft transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
          onClick={() => bannerImageInputRef.current?.click()}
          type="button"
        >
          <Image
            alt={bannerPreview.altText}
            className="object-cover transition duration-200 group-hover:scale-[1.015]"
            fill
            sizes="(min-width: 768px) 760px, 100vw"
            src={bannerPreview.url}
            unoptimized
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(44,51,35,0.66)_0%,rgba(69,56,82,0.34)_55%,rgba(69,56,82,0.18)_100%)]" />
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-midnight shadow-soft">
            <Upload className="size-4" aria-hidden="true" />
            {bannerImagePath ? "Udskift banner" : "Upload banner"}
          </span>
        </button>
        <input
          accept={imageUploadAccept}
          className="sr-only"
          onChange={handleBannerImageChange}
          ref={bannerImageInputRef}
          type="file"
        />
        <div className="flex flex-wrap items-center gap-3">
          {bannerImagePath ? (
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#E3B6B6] bg-white px-4 py-2 text-sm font-semibold text-[#A51D1D] transition hover:bg-[#FFF7F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A51D1D]"
              onClick={removeBannerImage}
              type="button"
            >
              <X className="size-4" aria-hidden="true" />
              Fjern bannerbillede
            </button>
          ) : (
            <p className="text-sm font-semibold text-ink/55">
              SoulEvents’ standardbanner vises, indtil du uploader dit eget.
            </p>
          )}
          {bannerImageStatus.message ? (
            <p
              className={
                "text-sm font-semibold " +
                (bannerImageStatus.status === "error"
                  ? "text-rose"
                  : bannerImageStatus.status === "success"
                    ? "text-sage-700"
                    : "text-ink/55")
              }
            >
              {bannerImageStatus.message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );

  const moodImageTiles = (
    <>
      {moodImages.map((image, index) => {
        return (
          <div
            className="grid min-w-[82%] snap-start gap-2 sm:min-w-0"
            key={`mood-slot-${index + 1}`}
          >
            <p className="text-sm font-semibold text-midnight">
              Stemningsbillede {index + 1}
            </p>
            <div className="relative">
              <UploadTile
                createPreview={false}
                helperText={"JPG, PNG eller WebP\nMaks. 15 MB"}
                imageUrl={image.previewUrl}
                label={
                  moodImageStatuses[index]?.status === "saving"
                    ? "Gemmer billede..."
                    : `Vælg stemningsbillede ${index + 1}`
                }
                maxFileSizeBytes={moodImageMaxFileSize}
                onError={(message) =>
                  setMoodImageStatus(index, { message, status: "error" })
                }
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
        );
      })}
    </>
  );

  const imageOverview = (
    <div className="grid gap-6">
      <section
        className={
          "grid scroll-mt-24 gap-4 rounded-[28px] border border-[#E5DCCB] bg-[#FFFDF8] p-5 shadow-[0_14px_34px_rgba(47,36,55,0.045)] transition sm:p-6" +
          highlightClass("profile-image")
        }
        id="profile-image-section"
        ref={profileImageSectionRef}
        tabIndex={-1}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <SectionHeading Icon={Camera} title="1. Profilbillede" />
            <span
              className={
                "rounded-full px-3 py-1 text-xs font-bold shadow-soft " +
                (profileImageAdded
                  ? "bg-white text-sage-700"
                  : "bg-white text-[#7A4EAB]")
              }
            >
              {profileImageAdded ? "Profilbillede tilføjet" : "Obligatorisk"}
            </span>
          </div>
          <p className="mt-2 text-lg font-semibold text-midnight">
            Vælg et profilbillede, der tydeligt repræsenterer dig
          </p>
          <p className="mt-1 text-sm leading-6 text-ink/55">
            Dit profilbillede vises tydeligt på din offentlige profil og hjælper
            gæsterne med at lære dig at kende.
          </p>
          <p className="mt-1 text-sm leading-6 text-ink/55">
            Det kan være et portræt, et logo eller et billede af en behandling,
            aktivitet eller stemning, der repræsenterer dit virke.
          </p>
          {profileImageSubmissionError && !profileImageAdded ? (
            <p className="mt-3 rounded-[18px] border border-[#E3B6B6] bg-[#FFF7F7] px-4 py-3 font-semibold text-[#A51D1D]">
              Du skal tilføje et profilbillede, før profilen kan sendes til
              SoulEvents.
            </p>
          ) : null}
        </div>
        <div className="grid max-w-[420px] gap-3">
          <div className="relative">
            {profileImageTile}
            {profileImageAdded ? (
              <span className="absolute inset-x-3 bottom-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-midnight/78 px-4 py-2 text-sm font-bold text-white shadow-soft backdrop-blur transition group-hover:bg-midnight/86">
                <Camera className="size-4" aria-hidden="true" />
                Udskift profilbillede
              </span>
            ) : null}
          </div>
          {profileImageAdded ? (
            <p className="text-center text-xs font-semibold text-ink/45">
              Klik på billedet for at udskifte det.
            </p>
          ) : null}
        </div>
      </section>

      <section
        className={
          "grid scroll-mt-24 gap-4 rounded-[28px] border border-[#E5DCCB] bg-[#FFFDF8] p-5 shadow-[0_14px_34px_rgba(47,36,55,0.045)] transition sm:p-6" +
          highlightClass("mood-image")
        }
        id="profile-mood-images-section"
        ref={moodImageSectionRef}
        tabIndex={-1}
      >
        <div>
          <SectionHeading Icon={ImagePlus} title="Dine stemningsbilleder" />
          <p className="mt-2 text-lg font-semibold text-midnight">
            Tilføj op til tre billeder, der viser dit univers
          </p>
          <p className="mt-1 text-sm leading-6 text-ink/55">
            Tilføj op til tre billeder, der viser stemningen i det, du tilbyder.
          </p>
        </div>
        <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
          {moodImageTiles}
        </div>
      </section>

      {bannerSection}
    </div>
  );

  function renderMissingShortcut(item: { label: string; step: PrototypeStep }) {
    return (
      <button
        className="group inline-flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-full bg-white px-4 py-2 text-left text-sm font-semibold text-midnight shadow-soft transition hover:bg-[#FBF7FF] hover:text-[#6E5285] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
        key={item.label}
        onClick={() => goToMissingItem(item)}
        type="button"
      >
        <span>{item.label}</span>
        <ArrowRight
          className="size-4 shrink-0 text-sage-700 transition group-hover:translate-x-0.5 group-hover:text-[#6E5285]"
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <OnboardingShell
      backHref={shellBackHref}
      backLabel={backLabel}
      canContinue={true}
      currentIndex={stepIndex}
      ctaLabel={
        presentationMode === "onboarding"
          ? currentStep.id === "approval"
            ? approvalCtaLabel
            : currentStep.id === "welcome"
              ? "Kom i gang"
              : currentStep.id === "profile"
                ? "Gennemgå din profil"
                : undefined
          : currentStep.id === "review"
            ? "Gem ændringer"
            : returnToReview
              ? "Gem ændringer"
              : undefined
      }
      ctaHelper={
        presentationMode === "onboarding" && currentStep.id === "approval"
          ? approvalHelper
          : undefined
      }
      footerLeading={
        currentStep.id === "review" && fullProfileHref ? (
          <div className="mb-3 grid gap-2 text-center">
            <p className="text-sm font-medium text-ink/55">
              Klik på den del af profilen, du vil ændre.
            </p>
            <Link
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-sage-700/20 bg-white px-5 text-sm font-semibold text-sage-700 shadow-soft transition hover:border-sage-700/40 hover:bg-sage-50"
              href={fullProfileHref}
              rel="noreferrer"
              target="_blank"
            >
              Se som gæst
              <ExternalLink className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : null
      }
      hideBackNavigation={
        presentationMode === "onboarding" && currentStep.id === "complete"
      }
      hidePrimaryAction={
        presentationMode === "onboarding" && currentStep.id === "complete"
      }
      isBusy={isBusy}
      isWidePreview={
        presentationMode !== "onboarding" && currentStep.id === "review"
      }
      logoSources={logoSources}
      onBack={goBack}
      onContinue={continueFlow}
      onSaveDraft={
        presentationMode === "onboarding" &&
        currentStep.id !== "welcome" &&
        currentStep.id !== "complete"
          ? saveDraftAndExit
          : undefined
      }
      presentationMode={presentationMode}
    >
      {currentStep.id === "welcome" ? (
        <div className="mb-6 flex justify-center">
          <InlineBrandLogo className="h-20 w-auto" src={activeDesktopLogoSrc} />
        </div>
      ) : null}

      <StepIntro
        eyebrow={displayedStep.eyebrow}
        text={displayedStep.text}
        title={displayedStep.title}
      />
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

      {(currentStep.id === "person" ||
        isProfileOverviewStep ||
        shouldShowApprovalPersonEditor) && (
        <div
          className={
            (shouldUseEmbeddedProfileSection
              ? "mb-6 grid scroll-mt-24 gap-5 rounded-[28px] border border-[#E5DCCB] bg-[#FFFDF8] p-5 shadow-[0_14px_34px_rgba(47,36,55,0.045)] transition sm:p-6"
              : "grid scroll-mt-24 gap-5 transition") +
            highlightClass("experiences")
          }
          id="profile-experiences-section"
          ref={experiencesSectionRef}
          tabIndex={-1}
        >
          {shouldUseEmbeddedProfileSection ? (
            <SectionHeading
              description="Dit navn og det profilnavn, deltagerne møder på SoulEvents."
              Icon={User}
              title="Grundoplysninger"
            />
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <ClearableInput
              label="Dit fornavn"
              onChange={setFirstName}
              placeholder="Dit fornavn"
              value={firstName}
            />
            <ClearableInput
              label="Dit efternavn"
              onChange={setLastName}
              placeholder="Dit efternavn"
              value={lastName}
            />
          </div>

          <button
            aria-pressed={useCustomProfileName}
            className="flex min-h-20 items-center justify-between gap-4 rounded-[24px] border border-[#D8D0C1] bg-white px-4 text-left shadow-[0_8px_22px_rgba(47,36,55,0.045)] transition hover:border-sage-700"
            onClick={() => setUseCustomProfileName((current) => !current)}
            type="button"
          >
            <span className="text-sm font-semibold leading-6 text-midnight">
              Mit profilnavn skal være et andet end mit rigtige navn på
              SoulEvents.
            </span>
            <span
              className={
                useCustomProfileName
                  ? "flex h-10 w-[4.5rem] shrink-0 items-center justify-end rounded-full bg-sage-700 p-1"
                  : "flex h-10 w-[4.5rem] shrink-0 items-center justify-start rounded-full bg-midnight/15 p-1"
              }
            >
              <span className="size-8 rounded-full bg-white shadow-soft" />
            </span>
          </button>

          {useCustomProfileName ? (
            <label className="grid gap-2 text-sm font-semibold text-midnight/82">
              Profilnavn
              <ClearableInput
                className="text-xl font-semibold"
                onChange={setProfileName}
                placeholder="Skriv et kaldenavn eller virksomhedsnavn"
                value={profileName}
              />
              <span className="text-sm font-normal leading-6 text-ink/64">
                Det kan eksempelvis være dit kunstnernavn, virksomhedsnavn,
                studionavn eller et andet navn, deltagerne kender dig under.
              </span>
            </label>
          ) : (
            <div className="rounded-[22px] bg-sage-50 p-4">
              <p className="text-sm font-semibold text-sage-700">
                Din profil vises som:
              </p>
              <p className="mt-1 text-2xl font-semibold text-midnight">
                {fullPublicName || "Dit navn"}
              </p>
            </div>
          )}
        </div>
      )}

      {(currentStep.id === "location" || isProfileOverviewStep) && (
        <div
          className={
            (shouldUseEmbeddedProfileSection
              ? "mb-6 grid scroll-mt-24 gap-5 rounded-[28px] border border-[#E5DCCB] bg-[#FFFDF8] p-5 shadow-[0_14px_34px_rgba(47,36,55,0.045)] transition sm:p-6"
              : "grid scroll-mt-24 gap-5 transition") +
            highlightClass("location")
          }
          id="profile-location-section"
          ref={locationSectionRef}
          tabIndex={-1}
        >
          {shouldUseEmbeddedProfileSection ? (
            <SectionHeading
              description="Fortæl hvor du holder til, så profilen kan placeres i det rigtige område."
              Icon={MapPin}
              title="Lokation"
            />
          ) : null}
          {presentationMode !== "onboarding" ? (
            <button
              aria-pressed={isOnlineFacilitator}
              className="flex min-h-20 items-center justify-between gap-4 rounded-[24px] border border-[#D8D0C1] bg-white px-4 text-left shadow-[0_8px_22px_rgba(47,36,55,0.045)] transition hover:border-sage-700"
              onClick={() => setIsOnlineFacilitator((current) => !current)}
              type="button"
            >
              <span className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lavender/15 text-lavender">
                  <Video className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold leading-6 text-midnight">
                    Jeg tilbyder også online forløb eller events.
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-ink/55">
                    Slå til, hvis deltagere må finde dig som online arrangør.
                  </span>
                </span>
              </span>
              <span
                className={
                  isOnlineFacilitator
                    ? "flex h-10 w-[4.5rem] shrink-0 items-center justify-end rounded-full bg-sage-700 p-1"
                    : "flex h-10 w-[4.5rem] shrink-0 items-center justify-start rounded-full bg-midnight/15 p-1"
                }
              >
                <span className="size-8 rounded-full bg-white shadow-soft" />
              </span>
            </button>
          ) : null}

          <button
            aria-pressed={showPublicLocation}
            className="flex min-h-20 items-center justify-between gap-4 rounded-[24px] border border-[#D8D0C1] bg-white px-4 text-left shadow-[0_8px_22px_rgba(47,36,55,0.045)] transition hover:border-sage-700"
            onClick={() => setShowPublicLocation((current) => !current)}
            type="button"
          >
            <span className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sage-50 text-sage-700">
                <MapPin className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold leading-6 text-midnight">
                  Vis postnummer og by på min offentlige profil
                </span>
                <span className="mt-1 block text-sm leading-6 text-ink/55">
                  Slå fra, hvis du arbejder fra din private bopæl. Så vises kun Danmark offentligt.
                </span>
              </span>
            </span>
            <span
              className={
                showPublicLocation
                  ? "flex h-10 w-[4.5rem] shrink-0 items-center justify-end rounded-full bg-sage-700 p-1"
                  : "flex h-10 w-[4.5rem] shrink-0 items-center justify-start rounded-full bg-midnight/15 p-1"
              }
            >
              <span className="size-8 rounded-full bg-white shadow-soft" />
            </span>
          </button>

          <label className="grid gap-2 text-sm font-semibold text-midnight/82">
            Land
            <select
              className={inputClass("appearance-none")}
              onChange={(event) => handleCountryChange(event.target.value)}
              value={country}
            >
              {supportedProfileCountries.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          {isOtherCountry ? (
            <label className="grid gap-2 text-sm font-semibold text-midnight/82">
              Skriv landets navn
              <input
                autoComplete="country-name"
                aria-invalid={locationSubmissionError && !normalizedCountryName}
                className={inputClass(
                  locationSubmissionError && !normalizedCountryName
                    ? "border-[#D97A7A] bg-[#FFF8F8]"
                    : "",
                )}
                maxLength={80}
                onChange={(event) => {
                  setLocationSubmissionError(false);
                  setCountryName(event.target.value.slice(0, 80));
                }}
                placeholder="Skriv landets navn"
                ref={countryNameInputRef}
                required
                value={countryName}
              />
              <span className="min-h-5 text-xs font-medium leading-5 text-ink/64">
                {locationSubmissionError && !normalizedCountryName ? (
                  <span className="font-semibold text-[#A51D1D]">
                    Skriv landets navn.
                  </span>
                ) : (
                  "Brug det navn, deltagerne normalt vil genkende."
                )}
              </span>
            </label>
          ) : null}

          <ClearableInput
            label="Adresse og husnummer (valgfrit)"
            onChange={setAddressLine}
            placeholder="Indtast adresse og husnummer"
            value={addressLine}
          />

          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <label className="grid grid-rows-[auto_auto_minmax(2.75rem,auto)] gap-2 text-sm font-semibold text-midnight/82">
              Postnummer
              <input
                autoComplete="postal-code"
                aria-invalid={
                  locationSubmissionError &&
                  Boolean(locationValidationMessage) &&
                  locationPostalCodeMissingOrInvalid
                }
                className={inputClass(
                  (isDanishLocation &&
                    postalCode.length > 0 &&
                    postalCode.length < 4) ||
                    (locationSubmissionError &&
                      Boolean(locationValidationMessage) &&
                      locationPostalCodeMissingOrInvalid)
                    ? "border-[#D97A7A] bg-[#FFF8F8]"
                    : "",
                )}
                inputMode={isDanishLocation ? "numeric" : "text"}
                maxLength={isDanishLocation ? 4 : 16}
                onChange={(event) => {
                  setLocationSubmissionError(false);
                  handlePostalCodeChange(event.target.value);
                }}
                pattern={isDanishLocation ? "[0-9]{4}" : "[A-Za-z0-9 -]{1,16}"}
                placeholder="Indtast dit postnummer"
                ref={postalCodeInputRef}
                required
                value={postalCode}
              />
              <span className="min-h-11 text-xs font-medium leading-5 text-ink/64">
                {locationSubmissionError &&
                Boolean(locationValidationMessage) &&
                locationPostalCodeMissingOrInvalid ? (
                  <span className="font-semibold text-[#A51D1D]">
                    {locationValidationMessage}
                  </span>
                ) : postalCodeMessage && isDanishLocation ? (
                  <span
                    className={
                      "font-semibold " +
                      (postalCode.length === 4 && !city
                        ? "text-[#A51D1D]"
                        : "text-sage-700")
                    }
                  >
                    {postalCodeMessage}
                  </span>
                ) : isDanishLocation ? (
                  "Indtast postnummer, så finder vi automatisk byen."
                ) : (
                  "Indtast postnummer og by, som de skrives i det valgte land."
                )}
              </span>
            </label>
            <label className="grid grid-rows-[auto_auto_minmax(2.75rem,auto)] gap-2 text-sm font-semibold text-midnight/82">
              By
              <input
                autoComplete="address-level2"
                aria-invalid={
                  locationSubmissionError &&
                  Boolean(locationValidationMessage) &&
                  locationCityMissing
                }
                className={inputClass(
                  locationSubmissionError &&
                    Boolean(locationValidationMessage) &&
                    locationCityMissing
                    ? "border-[#D97A7A] bg-[#FFF8F8]"
                    : "",
                )}
                maxLength={80}
                onChange={(event) => {
                  if (!isDanishLocation) {
                    setLocationSubmissionError(false);
                    setCity(event.target.value.slice(0, 80));
                  }
                }}
                placeholder={isDanishLocation ? "Udfyldes automatisk" : "By"}
                ref={cityInputRef}
                readOnly={isDanishLocation}
                required
                value={city}
              />
              <span className="min-h-11 text-xs font-medium leading-5 text-ink/64">
                {locationSubmissionError &&
                Boolean(locationValidationMessage) &&
                locationCityMissing ? (
                  <span className="font-semibold text-[#A51D1D]">
                    {locationValidationMessage}
                  </span>
                ) : isDanishLocation ? (
                  "Byen udfyldes automatisk ud fra postnummeret."
                ) : (
                  "Skriv byen, som den bruges lokalt."
                )}
              </span>
            </label>
          </div>

          {!isDanishLocation ? (
            <ClearableInput
              label="Region / område"
              maxLength={80}
              onChange={setRegionText}
              placeholder="Skriv region eller område"
              value={regionText}
            />
          ) : null}

          <div className="flex items-start gap-3 rounded-[22px] bg-sage-50 p-4 text-sm leading-6 text-sage-700">
            <Globe className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>
              {isDanishLocation
                ? "Område vælges automatisk ud fra postnummer og by."
                : "Danske områdefiltre bruges ikke for udenlandske profiler."}
              {inferredRegionName ? (
                <span className="block font-semibold">
                  Aktuelt område: {inferredRegionName}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      )}

      {(currentStep.id === "profile-image" ||
        isProfileOverviewStep ||
        shouldShowApprovalImageEditor) &&
        (shouldUseEmbeddedProfileSection ? (
          <div className="mb-6">{imageOverview}</div>
        ) : (
          imageOverview
        ))}

      {(currentStep.id === "experiences" ||
        isProfileOverviewStep ||
        shouldShowApprovalExperiencesEditor) && (
        <div
          className={
            (shouldUseEmbeddedProfileSection
              ? "mb-6 grid scroll-mt-24 gap-5 rounded-[28px] border border-[#E5DCCB] bg-[#FFFDF8] p-5 shadow-[0_14px_34px_rgba(47,36,55,0.045)] transition sm:p-6"
              : "grid scroll-mt-24 gap-5 transition") +
            highlightClass("story")
          }
          id="profile-story-section"
          ref={storySectionRef}
          tabIndex={-1}
        >
          {shouldUseEmbeddedProfileSection ? (
            <SectionHeading
              description="Vælg de områder, der bedst beskriver dit arbejde."
              Icon={Sparkles}
              title="Arbejdsområder og speciale"
            />
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {sortFacilitatorWorkAreas(categories).map((category) => {
              const selected = selectedExperiences.includes(category.id);
              const isLong = category.name.length > 17;
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
                    label={category.name}
                    onInfoToggle={() =>
                      setOpenAreaInfoId((current) =>
                        current === category.id ? null : category.id,
                      )
                    }
                    selected={selected}
                    showInfo={openAreaInfoId === category.id}
                  />
                </button>
              );
            })}
          </div>
          <div className="rounded-[24px] border border-sage-700/15 bg-sage-50 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold leading-6 text-sage-700">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-sage-700 shadow-soft">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              Hvad er du særligt god til?
            </p>
            <p className="mt-3 text-xs leading-5 text-ink/60">
              Hjælp deltagerne med hurtigt at forstå, hvad du er særligt kendt
              for. Fortæl om din baggrund, erfaring og den måde, du arbejder på.
            </p>
            <div className="mt-3">
              <ClearableTextarea
                className="bg-white text-base focus:border-sage-700 focus:ring-sage-700/10"
                maxLength={specialtyMaxLength}
                onChange={setSpecialties}
                placeholder="Beskriv kort dit speciale eller det, du brænder for"
                value={specialties}
              />
              <p className="mt-2 text-right text-xs font-semibold text-ink/50">
                {specialties.length} / {specialtyMaxLength} tegn
              </p>
            </div>
            <p className="mt-3 inline-flex items-start gap-2 rounded-[18px] bg-white/70 px-3 py-2 text-xs font-semibold leading-5 text-sage-700 shadow-soft">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Et godt speciale gør det lettere at blive fundet og skaber tillid
              hos deltagerne.
            </p>
          </div>
        </div>
      )}

      {(currentStep.id === "story" ||
        isProfileOverviewStep ||
        shouldShowApprovalStoryEditor) && (
        <div
          className={
            shouldUseEmbeddedProfileSection
              ? "mb-6 grid gap-5 rounded-[28px] border border-[#E5DCCB] bg-[#FFFDF8] p-5 shadow-[0_14px_34px_rgba(47,36,55,0.045)] sm:p-6"
              : "grid gap-5"
          }
        >
          <div className="border-b border-midnight/10 pb-3">
            <SectionHeading Icon={PencilLine} title="Mit univers" />
          </div>
          <div className="rounded-[22px] bg-[#FBF5E9] p-4 text-sm leading-6 text-ink/65">
            <p className="font-semibold text-midnight">
              Fortæl, hvem du er, og hvad deltagerne kan forvente.
            </p>
            <p className="mt-1">
              Du kan gemme en kort kladde, men teksten skal være færdig, før
              profilen sendes til SoulEvents.
            </p>
          </div>
          <div className="relative">
            <textarea
              className="min-h-64 w-full rounded-[24px] border border-[#D8D0C1] bg-white p-5 pr-12 text-lg leading-8 text-midnight shadow-[0_8px_22px_rgba(47,36,55,0.045)] outline-none transition duration-200 placeholder:text-ink/48 focus:border-sage-700 focus:ring-4 focus:ring-sage-700/12"
              onChange={(event) => {
                setStory(event.target.value);
                if (
                  normalizeFacilitatorStory(event.target.value).length >=
                  facilitatorStoryMinLength
                ) {
                  setStorySubmissionError(false);
                }
              }}
              placeholder="Fortæl om din tilgang, stemningen i dine begivenheder, og hvad deltagerne kan glæde sig til."
              ref={storyTextareaRef}
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
              <span className="rounded-full bg-sage-50 px-3 py-1.5 text-sage-700">
                ✓ Din fortælling er klar
              </span>
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

      {(currentStep.id === "links" || isProfileOverviewStep) && (
        <div
          className={
            shouldUseEmbeddedProfileSection
              ? "mb-6 grid gap-4 rounded-[28px] border border-[#E5DCCB] bg-[#FFFDF8] p-5 shadow-[0_14px_34px_rgba(47,36,55,0.045)] sm:p-6"
              : "grid gap-4"
          }
        >
          {shouldUseEmbeddedProfileSection ? (
            <SectionHeading
              description="Loginmailen vises kun her. Links og telefon kan udfyldes, hvis deltagerne må bruge dem."
              Icon={Link2}
              title="Kontakt og links"
            />
          ) : null}
          <section className="rounded-[22px] border border-[#E5DCCB] bg-white p-4 shadow-[0_8px_22px_rgba(47,36,55,0.035)]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-700">
              Mailadresse
            </p>
            <p className="mt-2 break-all text-base font-semibold text-midnight">
              {profile.email}
            </p>
            <p className="mt-2 text-sm leading-6 text-ink/55">
              Mailadressen bruges til login og vigtige beskeder.
            </p>
            <Link
              className="mt-3 inline-flex text-sm font-semibold text-[#7A4EAB] hover:text-sage-700"
              href="/facilitator/settings"
            >
              Skift mailadresse under Login og sikkerhed
            </Link>
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <ClearableInput
              error={phoneError ?? undefined}
              onChange={setPhone}
              placeholder="Telefonnummer"
              value={phone}
            />
            <ClearableInput
              onChange={setWebsite}
              placeholder="Website"
              value={website}
            />
          </div>
          <div className="grid gap-2">
            <ClearableInput
              onChange={setFacebook}
              placeholder={socialProfileLinkPlaceholder("facebook")}
              value={facebook}
            />
            {facebookError ? (
              <p className="text-sm font-semibold leading-5 text-[#A51D1D]">
                {facebookError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <ClearableInput
              onChange={setInstagram}
              placeholder={socialProfileLinkPlaceholder("instagram")}
              value={instagram}
            />
            {instagramError ? (
              <p className="text-sm font-semibold leading-5 text-[#A51D1D]">
                {instagramError}
              </p>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-ink/55">
            {socialProfileLinkHelpText}
          </p>
          <ClearableInput
            onChange={setYoutube}
            placeholder="YouTube"
            value={youtube}
          />
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
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#7A4EAB]">
                  Privat betalingsinfo
                </p>
                <p className="mt-2 text-sm leading-6 text-ink/65">
                  Betalingsoplysningerne vises kun til deltagere, der
                  tilmelder sig et betalt event via SoulEvents. SoulEvents
                  modtager eller behandler ikke betalingen.
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <ClearableInput
              label="MobilePay"
              maxLength={40}
              onChange={setPaymentMobilepayNumber}
              placeholder="Nummer eller MobilePay Box"
              value={paymentMobilepayNumber}
            />
            <ClearableInput
              label="Betalingslink"
              maxLength={300}
              onChange={setPaymentExternalUrl}
              placeholder="https://..."
              value={paymentExternalUrl}
            />
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

          <label className="flex min-w-0 items-center gap-3 rounded-card border border-[#E5D4F7] bg-white px-4 py-3 text-sm font-semibold text-midnight/82">
            <input
              checked={paymentCashEnabled}
              className="size-4 accent-[#7A4EAB]"
              onChange={(event) => setPaymentCashEnabled(event.currentTarget.checked)}
              type="checkbox"
            />
            Jeg tilbyder også kontant betaling.
          </label>
        </div>
      )}

      {(currentStep.id === "services" || isProfileOverviewStep) && (
        <div
          className={
            shouldUseEmbeddedProfileSection
              ? "mb-6 grid gap-5 rounded-[28px] border border-[#E5DCCB] bg-[#FFFDF8] p-5 shadow-[0_14px_34px_rgba(47,36,55,0.045)] sm:p-6"
              : "grid gap-5"
          }
        >
          {shouldUseEmbeddedProfileSection ? (
            <SectionHeading
              description="Valgfrit: fortæl om ydelser uden for events."
              Icon={HeartHandshake}
              title="Individuelle ydelser"
            />
          ) : null}

          <div
            className="grid gap-3"
            role="radiogroup"
            aria-label="Individuelle ydelser"
            aria-invalid={Boolean(servicesChoiceError)}
            aria-describedby={servicesChoiceError ? "individual-services-error" : undefined}
          >
            {[
              { label: "Nej, jeg afholder kun events", value: false },
              {
                label: "Ja, jeg tilbyder også individuelle ydelser",
                value: true,
              },
            ].map((option) => {
              const selected = offersIndividualServices === option.value;
              return (
                <button
                  aria-checked={selected}
                  className={
                    "flex min-h-16 items-center justify-between gap-4 rounded-[22px] border px-4 text-left text-base font-semibold shadow-soft transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 " +
                    (selected
                      ? "border-sage-700/25 bg-sage-50 text-sage-700"
                      : "border-midnight/10 bg-white text-midnight hover:border-sage-700")
                  }
                  key={String(option.value)}
                  onClick={() => {
                    setOffersIndividualServices(option.value);
                  }}
                  role="radio"
                  type="button"
                >
                  {option.label}
                  <Circle
                    className={
                      selected
                        ? "size-4 fill-sage-700/15 text-sage-700"
                        : "size-4 text-sage-700/45"
                    }
                    aria-hidden="true"
                  />
                </button>
              );
            })}
            {servicesChoiceError ? (
              <p className="rounded-[16px] bg-[#FFF8F8] px-4 py-3 text-sm font-semibold leading-5 text-[#A51D1D]" id="individual-services-error">
                {servicesChoiceError}
              </p>
            ) : null}
          </div>

          {offersIndividualServices === true ? (
            <div className="grid gap-4 rounded-[24px] bg-sage-50/65 p-4">
              <div className="rounded-[24px] bg-white p-4 shadow-soft sm:p-5">
                <p className="text-sm font-semibold leading-6 text-midnight">
                  Hvad tilbyder du?
                </p>
                <p className="mt-2 text-xs leading-5 text-ink/55">
                  Beskriv kort de individuelle ydelser eller forløb, man kan
                  booke hos dig.
                </p>
                <div className="relative mt-3">
                  <textarea
                    className="min-h-36 w-full rounded-[20px] border border-[#D8D0C1] bg-white p-4 pr-12 text-base leading-7 text-midnight shadow-[0_8px_22px_rgba(47,36,55,0.045)] outline-none transition duration-200 placeholder:text-ink/48 focus:border-sage-700 focus:ring-4 focus:ring-sage-700/12"
                    maxLength={500}
                    onChange={(event) =>
                      setServiceDescription(event.target.value)
                    }
                    placeholder="Fortæl om dine individuelle ydelser eller forløb"
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
        <div className="grid gap-6">
          <div className="rounded-[34px] bg-[#FAF8F4] p-3 shadow-soft sm:p-5 lg:p-6">
            <ProfileIdentityHeader
              badges={[]}
              categories={reviewCategories}
              coverImage={{
                altText: bannerPreview.altText,
                isFallback: bannerPreview.isFallback,
                objectPositionDesktop: bannerPreview.objectPositionDesktop,
                objectPositionMobile: bannerPreview.objectPositionMobile,
                url: bannerPreview.url,
              }}
              editActions={{
                banner: (
                  <ProfilePreviewEditButton
                    label="Rediger bannerbillede"
                    onClick={() => editImagesFromReview("banner")}
                  />
                ),
                categories: (
                  <ProfilePreviewEditButton
                    label="Rediger arbejdsområder og speciale"
                    onClick={() => editFromReview("experiences")}
                  />
                ),
                identity: (
                  <ProfilePreviewEditButton
                    label="Rediger navn og grundoplysninger"
                    onClick={() => editFromReview("person")}
                  />
                ),
                profileImage: (
                  <ProfilePreviewEditButton
                    label="Rediger profilbillede"
                    onClick={() => editImagesFromReview("profile")}
                  />
                ),
              }}
              hostReferenceId={facilitatorProfile.host_reference_id}
              name={publicProfileName || "Profilnavn mangler"}
              place={reviewPlace}
              profileImageUrl={profileImageUrl}
              specialty={specialtyText}
            />

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-8">
                <EditablePublicSection
                  label="Rediger fortælling"
                  onClick={() => editFromReview("story")}
                >
                  <ProfilePreviewSectionTitle
                    eyebrow="Mød arrangøren"
                    title="Mit univers"
                  />
                  {normalizedStory ? (
                    <div className="mt-6 max-w-3xl whitespace-pre-line text-base leading-8 text-[#5E5662]">
                      {story}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[22px] bg-[#FFF7DE] p-4 text-sm font-semibold leading-6 text-[#715C21]">
                      Fortæl lidt om dig og de begivenheder, du skaber.
                    </div>
                  )}
                </EditablePublicSection>

                {offersIndividualServices ||
                presentationMode !== "onboarding" ? (
                  <EditablePublicSection
                    className="border-[#D8CBE4] bg-[#F4F0F7]"
                    label="Rediger individuelle ydelser"
                    onClick={() => editFromReview("services")}
                  >
                    <ProfilePreviewSectionTitle
                      eyebrow="Individuelle ydelser"
                      title="Mine ydelser"
                    />
                    {hasIndividualServicesDescription ? (
                      <p className="mt-5 max-w-3xl whitespace-pre-line text-base leading-8 text-[#5E5662]">
                        {serviceDescription}
                      </p>
                    ) : (
                      <p className="mt-5 max-w-3xl text-base leading-8 text-[#5E5662]">
                        Du har valgt at tilbyde individuelle ydelser, men
                        beskrivelsen mangler endnu.
                      </p>
                    )}
                  </EditablePublicSection>
                ) : null}

                {previewGalleryImages.length > 0 ? (
                  <PublicFacilitatorGallery
                    actions={
                      <ProfilePreviewEditButton
                        label="Rediger stemningsbilleder"
                        onClick={() => editImagesFromReview("mood")}
                      />
                    }
                    images={previewGalleryImages}
                  />
                ) : (
                  <EditablePublicSection
                    className="border-[#E5DDEA] bg-white/82"
                    label="Rediger stemningsbilleder"
                    onClick={() => editImagesFromReview("mood")}
                  >
                    <ProfilePreviewSectionTitle
                      eyebrow="Stemninger"
                      title="Galleri"
                    />
                    <div className="mt-6 grid gap-3 md:grid-cols-3">
                      {moodImages.map((image, index) => (
                        <div
                          className="grid aspect-[4/3] place-items-center rounded-xl border-2 border-[#E5DDEA] bg-[#F4F0F7] text-[#7A5D91]"
                          key={"empty-gallery-preview-" + (index + 1)}
                        >
                          {image.previewUrl ? (
                            <img
                              alt=""
                              className="h-full w-full rounded-xl object-cover"
                              src={image.previewUrl}
                            />
                          ) : (
                            <ImagePlus className="size-6" aria-hidden="true" />
                          )}
                        </div>
                      ))}
                    </div>
                  </EditablePublicSection>
                )}

                {missingRequired.length > 0 ? (
                  <div className="rounded-[24px] bg-[#FFF7DE] p-5">
                    <p className="text-sm font-semibold text-[#715C21]">
                      Du mangler stadig nogle oplysninger
                    </p>
                    {!storyMeetsMinimum ? (
                      <p className="mt-2 text-sm leading-6 text-[#715C21]">
                        {storyMissingMessage}
                      </p>
                    ) : null}
                    <div className="mt-3 grid gap-2">
                      {missingRequired.map(renderMissingShortcut)}
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="grid content-start gap-5 lg:sticky lg:top-6">
                {hasPreviewContact ? (
                  <EditablePublicSection
                    className="border-[#E5DDEA] bg-white/86 p-6 sm:p-6"
                    label="Rediger kontaktoplysninger"
                    onClick={() => editFromReview("links")}
                  >
                    <h2 className="font-serif text-3xl font-semibold text-[#2F2437]">
                      Kontakt
                    </h2>
                    <div className="mt-5 grid gap-3 pr-12 text-sm text-[#6E6475]">
                      {reviewPlace ? (
                        <div className="flex gap-2">
                          <MapPinned
                            className="mt-0.5 size-4 shrink-0 text-[#7A5D91]"
                            aria-hidden="true"
                          />
                          <span>{reviewPlace}</span>
                        </div>
                      ) : null}
                      {profile.email ? (
                        <a
                          className="inline-flex items-center gap-2 font-semibold text-[#6E5285] transition hover:text-[#B56F8A]"
                          href={"mailto:" + profile.email}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Mail className="size-4" aria-hidden="true" />
                          {profile.email}
                        </a>
                      ) : null}
                      {phone.trim() ? (
                        <a
                          className="inline-flex items-center gap-2 font-semibold text-[#6E5285] transition hover:text-[#B56F8A]"
                          href={"tel:" + phone.trim()}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Phone className="size-4" aria-hidden="true" />
                          {phone.trim()}
                        </a>
                      ) : null}
                      {previewContactLinks.map((link) => (
                        <a
                          className="inline-flex items-center gap-2 font-semibold text-[#6E5285] transition hover:text-[#B56F8A]"
                          href={link.href}
                          key={link.label}
                          onClick={(event) => event.stopPropagation()}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink className="size-4" aria-hidden="true" />
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </EditablePublicSection>
                ) : null}
              </aside>
            </div>
          </div>
        </div>
      )}

      {currentStep.id === "approval" && (
        <div className="grid gap-6 text-left">
          {missingRequired.length > 0 ? (
            <div
              className={
                "scroll-mt-28 rounded-[24px] bg-[#FFF7DE] p-5 text-left transition" +
                approvalHighlightClass("missing-requirements")
              }
              id="profile-missing-requirements"
              ref={approvalMissingRequirementsRef}
              tabIndex={-1}
            >
              <p
                className="text-sm font-semibold text-[#715C21]"
                id="profile-missing-requirements-title"
              >
                Ret de markerede oplysninger ovenfor, før profilen kan sendes
                til SoulEvents.
              </p>
              {!storyMeetsMinimum ? (
                <p className="mt-2 text-sm leading-6 text-[#715C21]">
                  {storyMissingMessage}
                </p>
              ) : null}
              <div className="mt-3 grid gap-2">
                {missingRequired.map(renderMissingShortcut)}
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-sage-700/20 bg-sage-50 p-5 text-left">
              <p className="text-sm font-semibold text-sage-700">
                Din profil er klar til indsendelse.
              </p>
              <p className="mt-2 text-sm leading-6 text-sage-700/80">
                {acceptedTerms
                  ? "Du kan nu sende profilen til SoulEvents."
                  : "Acceptér vilkårene herunder, så kan profilen sendes til SoulEvents."}
              </p>
            </div>
          )}
          <div
            className={
              "scroll-mt-28 flex items-start gap-3 rounded-[24px] border border-midnight/10 bg-white p-5 text-left shadow-soft transition" +
              approvalHighlightClass("terms")
            }
            id="profile-terms-acceptance-section"
            ref={approvalTermsRef}
            tabIndex={-1}
          >
            <input
              id="facilitator-profile-terms-acceptance"
              checked={acceptedTerms}
              className="mt-1 size-5 rounded border-midnight/20 accent-sage-700"
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              type="checkbox"
            />
            <span className="text-sm font-semibold leading-6 text-midnight">
              <label htmlFor="facilitator-profile-terms-acceptance">
                Jeg har læst og accepterer SoulEvents&apos;{" "}
              </label>
              <Link
                aria-label="Læs arrangørvilkår i en ny fane"
                className="inline-flex items-center gap-1 text-sage-700 underline underline-offset-4"
                href="/legal/arrangoervilkaar"
                rel="noopener noreferrer"
                target="_blank"
              >
                arrangørvilkår
                <ExternalLink className="size-3" aria-hidden="true" />
              </Link>
              ,{" "}
              <Link
                aria-label="Læs retningslinjer i en ny fane"
                className="inline-flex items-center gap-1 text-sage-700 underline underline-offset-4"
                href="/legal/platformens-retningslinjer"
                rel="noopener noreferrer"
                target="_blank"
              >
                retningslinjer
                <ExternalLink className="size-3" aria-hidden="true" />
              </Link>{" "}
              og{" "}
              <Link
                aria-label="Læs privatlivspolitik i en ny fane"
                className="inline-flex items-center gap-1 text-sage-700 underline underline-offset-4"
                href="/legal/privatlivspolitik"
                rel="noopener noreferrer"
                target="_blank"
              >
                privatlivspolitik
                <ExternalLink className="size-3" aria-hidden="true" />
              </Link>
              .
            </span>
          </div>
          <div className="grid gap-4 rounded-[30px] bg-[#F4F0E9] p-5">
            <SectionHeading Icon={HeartHandshake} title="Dig + SoulEvents" />
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="grid min-h-[220px] grid-rows-[1fr_auto] justify-items-center gap-3 rounded-[24px] bg-white p-4 text-center shadow-soft">
                <div className="grid aspect-square w-full max-w-[150px] place-items-center overflow-hidden rounded-[24px] bg-sage-50 text-sage-700">
                  {profileImageUrl ? (
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={profileImageUrl}
                    />
                  ) : (
                    <Camera className="size-9" aria-hidden="true" />
                  )}
                </div>
                <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-midnight">
                  {publicProfileName || "Din profil"}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-full bg-white text-rose shadow-soft">
                <HeartHandshake className="size-5" aria-hidden="true" />
              </div>
              <div className="grid min-h-[220px] grid-rows-[1fr_auto] justify-items-center gap-3 rounded-[24px] bg-white p-4 text-center shadow-soft">
                <div className="grid aspect-square w-full max-w-[150px] place-items-center rounded-[24px] bg-sage-50 p-4">
                  <InlineBrandLogo
                    className="h-full w-full"
                    src={activeDesktopLogoSrc}
                  />
                </div>
                <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-midnight">
                  SoulEvents
                </p>
              </div>
            </div>
          </div>
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
                Vi gennemgår alle nye profiler manuelt for at sikre en tryg og
                troværdig platform. Du modtager en e-mail, så snart din profil
                er godkendt.
              </p>
              <p>
                Du kan allerede nu begynde at oprette dit første event. Eventet
                gemmes som en kladde og bliver først synligt, når din
                arrangørprofil er godkendt.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <Link
              className="inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-[999px] bg-midnight px-6 text-lg font-semibold text-white shadow-soft transition duration-200 hover:bg-sage-700 lg:min-h-12 lg:text-base xl:min-h-14"
              href="/facilitator/events"
            >
              Opret mit første event
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
