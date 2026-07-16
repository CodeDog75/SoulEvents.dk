"use client";

import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Camera,
  Circle,
  Dumbbell,
  ExternalLink,
  Flame,
  Flower2,
  Globe,
  HandHeart,
  Heart,
  HeartHandshake,
  ImagePlus,
  Leaf,
  Link2,
  Moon,
  Music,
  PartyPopper,
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
import { type ChangeEvent, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import {
  autosaveFacilitatorProfileAction,
  saveFacilitatorMoodImageAction,
  saveFacilitatorProfileImageAction,
  saveWorkAreaSuggestionAction,
  submitFacilitatorProfileForReviewAction,
} from "@/app/facilitator/profile/actions";
import { imageUploadAccept, prepareImageFileForUpload } from "@/lib/images/client-image-upload";
import { OnboardingShell as SharedOnboardingShell } from "@/components/onboarding/onboarding-shell";

type Region = {
  id: string;
  name: string;
  slug: string;
};

type Category = {
  id: string;
  name: string;
};

type ServiceTitle = {
  id: string;
  name: string;
  is_active?: boolean;
};

type FacilitatorProfile = {
  status?: string | null;
  company_name: string | null;
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
  offers_services?: boolean | null;
  service_description?: string | null;
  service_other_title?: string | null;
  show_in_local_service_results?: boolean | null;
};

type GalleryImage = {
  image_path: string;
  alt_text: string | null;
};

type ProfileFormProps = {
  adminReturnTo?: string | null;
  adminTargetFacilitatorId?: string | null;
  autosaveEnabled?: boolean;
  backHref?: string;
  backLabel?: string;
  errorSection?: string | null;
  feedbackMessage?: string | null;
  profile: {
    full_name: string;
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
  serviceTitles: ServiceTitle[];
  selectedServiceTitleIds: string[];
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

const fallbackTreatmentForms: ServiceTitle[] = [
  { id: "healing", name: "Healing" },
  { id: "reiki", name: "Reiki" },
  { id: "kropsterapi", name: "Kropsterapi" },
  { id: "massage", name: "Massage" },
  { id: "terapi", name: "Terapi" },
  { id: "coaching", name: "Coaching" },
  { id: "clairvoyance", name: "Clairvoyance" },
  { id: "astrologi", name: "Astrologi" },
  { id: "zoneterapi", name: "Zoneterapi" },
  { id: "akupunktur", name: "Akupunktur" },
  { id: "hypnose", name: "Hypnose" },
  { id: "samtaleforloeb", name: "Samtaleforløb" },
  { id: "energiarbejde", name: "Energiarbejde" },
  { id: "lydhealing", name: "Lydhealing" },
  { id: "breathwork", name: "Breathwork" },
  { id: "meditation-1-1", name: "Meditation 1:1" },
];

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
    text: "Vælg et profilbillede og op til tre stemningsbilleder, der viser dig og det, du inviterer mennesker ind i.",
    title: "Gør din profil levende.",
  },
  {
    eyebrow: "Arbejdsområder",
    id: "experiences",
    text: "Vælg de områder, der bedst beskriver dit arbejde og det, du inviterer mennesker ind i.",
    title: "Inden for hvilke områder arbejder du?",
  },
  {
    eyebrow: "Din fortælling",
    id: "story",
    text: "Skriv som du ville fortælle det til et menneske, der overvejer at deltage.",
    title: "Fortæl lidt om dig.",
  },
  {
    eyebrow: "Forbindelse",
    id: "links",
    text: "Del de steder, hvor deltagere kan lære dig bedre at kende.",
    title: "Hvor kan deltagerne finde dig?",
  },
  {
    eyebrow: "Ydelser",
    id: "services",
    text: "Kun hvis du også arbejder med 1:1-forløb. Hvis du kun afholder events, vælger du bare nej.",
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
    text: "Er du klar til at blive en del af SoulEvents?",
    title: "Sådan! Din profil er næsten klar",
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

function value(input: string | null | undefined) {
  return input ?? "";
}

function splitOtherTreatmentForms(input: string | null | undefined) {
  return value(input)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function joinOtherTreatmentForms(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join("\n");
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
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
  Icon,
  label,
  selected,
}: {
  Icon: LucideIcon;
  label: string;
  selected: boolean;
}) {
  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Icon
          aria-hidden="true"
          className={selected ? "size-5 shrink-0 text-sage-700" : "size-5 shrink-0 text-sage-700/55"}
        />
        <span className="min-w-0 whitespace-normal break-words text-left leading-snug">{label}</span>
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
        "block w-full min-w-0 cursor-pointer rounded-[24px] text-left transition hover:bg-white/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 " +
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
      {children}
    </section>
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
  onBack,
  onContinue,
  presentationMode = "editing",
  canContinue = true,
  ctaLabel,
  ctaHelper,
}: {
  backHref: string;
  backLabel: string;
  canContinue?: boolean;
  children: React.ReactNode;
  currentIndex: number;
  ctaLabel?: string;
  ctaHelper?: string;
  hideBackNavigation?: boolean;
  hidePrimaryAction?: boolean;
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
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
              {footer}
              {ctaHelper ? <p className="mt-3 text-left text-sm font-medium text-ink/55">{ctaHelper}</p> : null}
            </>
          ) : null
        }
        mode="profile"
        scrollKey={currentIndex}
        visualPanel={{ text: "En rolig vej ind til din profil, dine begivenheder og dit fællesskab." }}
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

export function ProfileForm({
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
  serviceTitles,
  selectedServiceTitleIds,
}: ProfileFormProps) {
  const names = splitName(profile.full_name);
  const activeSteps =
    presentationMode === "onboarding"
      ? (showEmailConfirmedStep ? ["account", ...onboardingStepIds] : onboardingStepIds)
          .map((stepId) => steps.find((step) => step.id === stepId))
          .filter((step): step is (typeof steps)[number] => Boolean(step))
      : editingStepIds.map((stepId) => steps.find((step) => step.id === stepId)).filter((step): step is (typeof steps)[number] => Boolean(step));
  const [stepIndex, setStepIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
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
  const [moodImageStatuses, setMoodImageStatuses] = useState<SlotStatus[]>(
    Array.from({ length: 3 }, () => ({ message: "", status: "idle" })),
  );
  const [selectedExperiences, setSelectedExperiences] = useState(selectedCategoryIds);
  const [story, setStory] = useState(value(facilitatorProfile.long_description || facilitatorProfile.short_description));
  const [website, setWebsite] = useState(value(facilitatorProfile.website_url));
  const [facebook, setFacebook] = useState(value(facilitatorProfile.facebook_url));
  const [instagram, setInstagram] = useState(value(facilitatorProfile.instagram_url));
  const [youtube, setYoutube] = useState(value(facilitatorProfile.youtube_url));
  const [offersIndividualServices, setOffersIndividualServices] = useState(Boolean(facilitatorProfile.offers_services));
  const [selectedTreatmentIds, setSelectedTreatmentIds] = useState(selectedServiceTitleIds);
  const [otherTreatmentForms, setOtherTreatmentForms] = useState<[string, string]>(() => {
    const values = splitOtherTreatmentForms(facilitatorProfile.service_other_title);
    return [values[0] ?? "", values[1] ?? ""];
  });
  const [otherExperience, setOtherExperience] = useState("");
  const [workAreaSuggestionStatus, setWorkAreaSuggestionStatus] = useState<SlotStatus>({ message: "", status: "idle" });
  const [stepSaveStatus, setStepSaveStatus] = useState<SlotStatus>({ message: "", status: "idle" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const currentStep = activeSteps[stepIndex] ?? activeSteps[0] ?? steps[0];
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
  const treatmentOptions = sortedByDanishName(serviceTitles.length > 0 ? serviceTitles : fallbackTreatmentForms);
  const selectedTreatments = offersIndividualServices
    ? treatmentOptions.filter((serviceTitle) => selectedTreatmentIds.includes(serviceTitle.id))
    : [];
  const otherTreatmentFormValue = joinOtherTreatmentForms(otherTreatmentForms);
  const otherTreatmentFormChips = splitOtherTreatmentForms(otherTreatmentFormValue);
  const hasTreatmentForms = offersIndividualServices && (selectedTreatments.length > 0 || otherTreatmentFormChips.length > 0);
  const hasLinks = Boolean(website.trim() || facebook.trim() || instagram.trim() || youtube.trim());
  const missingRequired = [
    !firstName.trim() || !lastName.trim() ? { label: "Dit navn", step: "person" as PrototypeStep } : null,
    !publicProfileName ? { label: "Profilnavn", step: "person" as PrototypeStep } : null,
    !profileImageUrl ? { label: "Profilbillede", step: "profile-image" as PrototypeStep } : null,
    moodImages.every((image) => !image.previewUrl) ? { label: "Mindst ét stemningsbillede", step: "profile-image" as PrototypeStep } : null,
    !hasWorkArea ? { label: "Begivenheder", step: "experiences" as PrototypeStep } : null,
    !story.trim() ? { label: "Fortælling", step: "story" as PrototypeStep } : null,
  ].filter((item): item is { label: string; step: PrototypeStep } => Boolean(item));

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("confirmed");
    url.searchParams.set("prototypeStep", currentStep.id);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [currentStep.id]);

  const contactValues = {
    company_name: publicProfileName,
    full_name: fullPublicName,
    long_description: story,
    phone: profile.phone ?? "",
    short_description: story.trim().slice(0, 300),
  };

  async function saveCurrentStep() {
    if (!autosaveEnabled || presentationMode === "admin") {
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
    }

    if (currentStep.id === "experiences") {
      const result = await autosaveFacilitatorProfileAction({
        section: "categories",
        values: { category_ids: selectedExperiences },
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
      const result = await autosaveFacilitatorProfileAction({
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

    if (currentStep.id === "services") {
      const result = await autosaveFacilitatorProfileAction({
        section: "services",
        values: {
          offers_services: offersIndividualServices,
          service_description: "",
          service_other_title: otherTreatmentFormValue,
          service_title_ids: selectedTreatmentIds,
          show_in_local_service_results: offersIndividualServices,
        },
      });

      if (!result.ok) return result;
    }

    if (currentStep.id === "approval") {
      const result = await submitFacilitatorProfileForReviewAction({ acceptedTerms });

      if (!result.ok) return result;
      return result;
    }

    return { message: "Gemt", ok: true };
  }

  async function continueFlow() {
    setIsBusy(true);
    setStepSaveStatus({ message: "", status: "idle" });

    const saveResult = await saveCurrentStep();
    if (!saveResult.ok) {
      setIsBusy(false);
      setStepSaveStatus({ message: saveResult.message, status: "error" });
      return;
    }

    setStepSaveStatus({ message: saveResult.message, status: "success" });

    window.setTimeout(async () => {
      if (currentStep.id === "experiences" && otherExperience.trim() && presentationMode !== "admin") {
        setWorkAreaSuggestionStatus({ message: "Sender forslag til SoulEvents...", status: "saving" });
        const result = await saveWorkAreaSuggestionAction(otherExperience);

        if (result.status === "error") {
          setIsBusy(false);
          setWorkAreaSuggestionStatus({ message: result.message, status: "error" });
          return;
        }

        setOtherExperience("");
        setWorkAreaSuggestionStatus({ message: result.message || "Dit forslag er sendt til SoulEvents.", status: "success" });
      }

      setIsBusy(false);
      if (presentationMode !== "onboarding" && currentStep.id === "review") {
        window.location.href = backHref;
        return;
      }

      if (presentationMode === "onboarding" && currentStep.id === "approval") {
        goToStep("complete");
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

  function goBack() {
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

  function toggleExperience(categoryId: string) {
    setSelectedExperiences((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId],
    );
  }

  function toggleTreatment(serviceTitleId: string) {
    setSelectedTreatmentIds((current) =>
      current.includes(serviceTitleId) ? current.filter((id) => id !== serviceTitleId) : [...current, serviceTitleId],
    );
  }

  function setOtherTreatmentForm(index: number, nextValue: string) {
    setOtherTreatmentForms((current) => {
      const next: [string, string] = [current[0], current[1]];
      next[index] = nextValue;
      return next;
    });
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
        setProfileImageFile(file);
        setProfileImageUrl(previewUrl);
      }}
    />
  );

  const moodImageTiles = (
    <>
      {moodImages.map((image, index) => (
        <div className="grid gap-2" key={index}>
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
          <p className="font-semibold text-midnight">
            Dit profilbillede vises på din offentlige profil og ved dine begivenheder.
          </p>
          <p className="mt-2">
            Vi anbefaler et kvadratisk billede i god kvalitet.
          </p>
        </div>
      </section>

      <section className="grid gap-3">
        <p className="text-sm font-semibold text-midnight">Stemningsbilleder (1-3)</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {moodImageTiles}
        </div>
      </section>
    </div>
  );

  return (
    <OnboardingShell
      backHref={backHref}
      backLabel={backLabel}
      canContinue={currentStep.id !== "approval" || acceptedTerms}
      currentIndex={stepIndex}
      ctaLabel={
        presentationMode === "onboarding"
          ? currentStep.id === "approval"
            ? "Opret profil"
            : stepIndex === 0
              ? "Fortsæt"
              : undefined
          : currentStep.id === "review"
            ? "Gem ændringer"
            : returnToReview
              ? "Tilbage til gennemse"
              : undefined
      }
      ctaHelper={presentationMode === "onboarding" && currentStep.id === "approval" ? "Din profil sendes til godkendelse." : undefined}
      hideBackNavigation={presentationMode === "onboarding" && currentStep.id === "complete"}
      hidePrimaryAction={presentationMode === "onboarding" && currentStep.id === "complete"}
      isBusy={isBusy}
      onBack={goBack}
      onContinue={continueFlow}
      presentationMode={presentationMode}
    >
      {currentStep.id === "welcome" ? (
        <div className="mb-6 flex justify-center">
          <img alt="SoulEvents" className="h-20 w-auto object-contain" src="/brand/soulevents-logo.png" />
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
          {[...categories].sort((a, b) => a.name.localeCompare(b.name, "da-DK")).map((category) => {
            const selected = selectedExperiences.includes(category.id);
            const isLong = category.name.length > 17;
            const WorkAreaIcon = workAreaIconForName(category.name);
            return (
              <button
                className={workAreaClass(selected, isLong)}
                key={category.id}
                onClick={() => toggleExperience(category.id)}
                type="button"
              >
                <SelectionCardContent Icon={WorkAreaIcon} label={category.name} selected={selected} />
              </button>
            );
          })}
          </div>
          <div className="rounded-[24px] bg-[#FBF5E9] p-4">
            <p className="text-sm font-semibold leading-6 text-[#695A3C]">
              Mangler du et arbejdsområde på listen?
            </p>
            <p className="mt-2 text-xs leading-5 text-ink/55">
              Send gerne dit forslag til SoulEvents. Forslaget bliver ikke tilføjet til din profil, men bliver sendt til os til vurdering.
            </p>
            <div className="mt-3">
              <ClearableInput
                className="bg-white text-base"
                maxLength={120}
                onChange={setOtherExperience}
                placeholder="Skriv dit forslag til et nyt arbejdsområde"
                value={otherExperience}
              />
            </div>
            {otherExperience.trim() ? (
              <p className="mt-3 text-xs font-semibold leading-5 text-sage-700">
                Dit forslag sendes til SoulEvents, når du fortsætter.
              </p>
            ) : null}
            {workAreaSuggestionStatus.message ? (
              <p
                className={
                  "mt-3 text-xs font-semibold leading-5 " +
                  (workAreaSuggestionStatus.status === "error"
                    ? "text-rose"
                    : workAreaSuggestionStatus.status === "success"
                      ? "text-sage-700"
                      : "text-ink/55")
                }
              >
                {workAreaSuggestionStatus.message}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {currentStep.id === "story" && (
        <div className="grid gap-4">
          <div className="relative">
            <textarea
              className="min-h-64 w-full rounded-[24px] border border-midnight/10 bg-white p-5 pr-12 text-lg leading-8 text-midnight shadow-soft outline-none transition duration-200 placeholder:text-ink/35 focus:border-sage-700 focus:ring-4 focus:ring-sage-700/10"
              onChange={(event) => setStory(event.target.value)}
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
          <p className="text-sm leading-6 text-ink/55">Skriv varmt og enkelt. Det behøver ikke være perfekt.</p>
        </div>
      )}

      {currentStep.id === "links" && (
        <div className="grid gap-4">
          <ClearableInput onChange={setWebsite} placeholder="Website" value={website} />
          <ClearableInput onChange={setFacebook} placeholder="Facebook" value={facebook} />
          <ClearableInput onChange={setInstagram} placeholder="Instagram" value={instagram} />
          <ClearableInput onChange={setYoutube} placeholder="YouTube" value={youtube} />
        </div>
      )}

      {currentStep.id === "services" && (
        <div className="grid gap-5">
          <p className="text-base leading-7 text-ink/65">
            Fx healing, terapi, coaching, massage, clairvoyance eller andre 1:1-forløb.
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
            <div className="grid gap-5 rounded-[28px] bg-[#FBF5E9] p-4">
              <div className="grid gap-3">
                <p className="text-sm font-semibold leading-6 text-[#695A3C]">
                  Vælg de behandlinger eller individuelle ydelser, du tilbyder.
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {treatmentOptions.map((serviceTitle) => {
                    const selected = selectedTreatmentIds.includes(serviceTitle.id);
                    const isLong = serviceTitle.name.length > 17;
                    const TreatmentIcon = workAreaIconForName(serviceTitle.name);
                    return (
                      <button
                        className={workAreaClass(selected, isLong)}
                        key={serviceTitle.id}
                        onClick={() => toggleTreatment(serviceTitle.id)}
                        type="button"
                      >
                        <SelectionCardContent Icon={TreatmentIcon} label={serviceTitle.name} selected={selected} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[24px] bg-white p-4 shadow-soft">
                <p className="text-sm font-semibold leading-6 text-midnight">
                  Tilbyder du en behandlingsform, som ikke står på listen?
                </p>
                <div className="mt-3 grid gap-3">
                  <ClearableInput onChange={(nextValue) => setOtherTreatmentForm(0, nextValue)} placeholder="" value={otherTreatmentForms[0]} />
                  <ClearableInput onChange={(nextValue) => setOtherTreatmentForm(1, nextValue)} placeholder="" value={otherTreatmentForms[1]} />
                </div>
                <p className="mt-3 text-xs leading-5 text-ink/55">
                  Der findes mange forskellige navne og retninger. Skriv det her, hvis din behandlingsform ikke står på listen.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {currentStep.id === "review" && (
        <div className="rounded-[34px] border border-midnight/5 bg-[#F4F0E9] p-4 shadow-soft sm:p-6">
          <div className="grid gap-5">
            <ReviewJump label="Rediger navn" onClick={() => editFromReview("person")} className="p-2 -m-2">
              <div className="grid gap-3">
                <h3 className="break-words text-4xl font-semibold leading-tight text-midnight sm:text-5xl">{publicProfileName || "Profilnavn mangler"}</h3>
              </div>
            </ReviewJump>

            <ReviewJump label="Rediger arbejdsområder" onClick={() => editFromReview("experiences")} className="p-2 -m-2">
              {hasWorkArea ? (
                <div className="flex flex-wrap gap-2">
                  {categories
                    .filter((category) => selectedExperiences.includes(category.id))
                    .map((category) => (
                      <span className="rounded-full border border-sage-700/15 bg-white/65 px-3 py-1.5 text-sm font-semibold text-sage-700" key={category.id}>
                        {category.name}
                      </span>
                    ))}
                </div>
              ) : (
                <div className="rounded-[22px] bg-[#FFF7DE] p-4 text-sm font-semibold leading-6 text-[#715C21]">
                  Du mangler at vælge mindst ét arbejdsområde.
                </div>
              )}
            </ReviewJump>

            <ReviewJump label="Rediger profilbillede" onClick={() => editFromReview("profile-image")}>
              <div className="aspect-square w-full overflow-hidden rounded-[30px] bg-sage-50 text-sage-700 shadow-soft">
                {profileImageUrl ? (
                  <img alt="" className="h-full w-full object-cover" src={profileImageUrl} />
                ) : (
                  <span className="grid h-full place-items-center">
                    <Camera className="size-12" aria-hidden="true" />
                  </span>
                )}
              </div>
            </ReviewJump>

            <ReviewJump label="Rediger stemningsbilleder" onClick={() => editFromReview("profile-image")}>
              <div className="grid grid-cols-3 gap-2">
                {moodImages.map((image, index) => (
                  <div
                    className="aspect-square overflow-hidden rounded-[18px] bg-white/45 text-sage-700/45"
                    key={index}
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
            </ReviewJump>

            <ReviewJump label="Rediger om mig" onClick={() => editFromReview("story")} className="p-2 -m-2">
              {story.trim() ? (
                <p className="min-w-0 whitespace-pre-line text-base leading-8 text-ink/72">{story}</p>
              ) : (
                <div className="rounded-[22px] bg-[#FFF7DE] p-4 text-sm font-semibold leading-6 text-[#715C21]">
                  Fortæl lidt om dig og de begivenheder, du skaber.
                </div>
              )}
            </ReviewJump>

            {hasTreatmentForms ? (
              <ReviewJump label="Rediger behandlingsformer" onClick={() => editFromReview("services")} className="p-2 -m-2">
                <div className="grid gap-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Behandlingsformer</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTreatments.map((serviceTitle) => (
                      <span className="rounded-full border border-sage-700/15 bg-white/65 px-3 py-1.5 text-sm font-semibold text-sage-700" key={serviceTitle.id}>
                        {serviceTitle.name}
                      </span>
                    ))}
                    {otherTreatmentFormChips.map((treatmentForm) => (
                      <span className="rounded-full border border-midnight/10 bg-white/65 px-3 py-1.5 text-sm font-semibold text-midnight" key={treatmentForm}>
                        {treatmentForm}
                      </span>
                    ))}
                  </div>
                </div>
              </ReviewJump>
            ) : null}

            {hasLinks ? (
              <ReviewJump label="Rediger links" onClick={() => editFromReview("links")} className="p-2 -m-2">
                <LinkRows facebook={facebook} instagram={instagram} website={website} youtube={youtube} />
              </ReviewJump>
            ) : null}

            {missingRequired.length > 0 ? (
              <div className="rounded-[24px] bg-[#FFF7DE] p-5">
                <p className="text-sm font-semibold text-[#715C21]">Du mangler stadig nogle oplysninger</p>
                <div className="mt-3 grid gap-2">
                  {missingRequired.map((item) => (
                    <button
                      className="inline-flex min-h-10 items-center justify-between rounded-full bg-white px-4 text-sm font-semibold text-midnight shadow-soft"
                      key={item.label}
                      onClick={() => goToStep(item.step)}
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
          <p className="text-base leading-7 text-ink/65">
            Når du sender profilen til godkendelse, gennemgår vi den og giver dig besked, så snart den er klar.
          </p>
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
                  <img alt="SoulEvents" className="h-full w-full object-contain" src="/brand/soulevents-logo.png" />
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
              <div className="mt-3 grid gap-2">
                {missingRequired.map((item) => (
                  <button
                    className="inline-flex min-h-10 items-center justify-between rounded-full bg-white px-4 text-sm font-semibold text-midnight shadow-soft"
                    key={item.label}
                    onClick={() => goToStep(item.step)}
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
