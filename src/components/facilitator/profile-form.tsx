"use client";

import { Camera, CheckCircle2, CircleAlert, CircleDashed, Info, Link2, Save, X } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { autosaveFacilitatorProfileAction, updateFacilitatorProfileAction } from "@/app/facilitator/profile/actions";
import { ProfileImageManager } from "@/components/facilitator/profile-image-manager";
import { inferRegionSlug } from "@/lib/regions/infer-region";

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
  company_name: string | null;
  profile_image_path: string | null;
  short_description: string | null;
  long_description: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
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
  errorSection?: string | null;
  feedbackMessage?: string | null;
  profile: {
    full_name: string;
    email: string;
    phone: string | null;
  };
  facilitatorProfile: FacilitatorProfile;
  regions: Region[];
  categories: Category[];
  selectedCategoryIds: string[];
  galleryImages: GalleryImage[];
  savedSection?: string | null;
  serviceTitles: ServiceTitle[];
  selectedServiceTitleIds: string[];
};

const profileFormSections = ["contact", "location", "social", "images", "categories", "services"] as const;

type ProfileFormSection = (typeof profileFormSections)[number];
type ProfileSavedSection = ProfileFormSection | "all";
type MissingProfileItem = {
  focusSelector?: string;
  key: string;
  label: string;
  targetId: string;
};

function isProfileFormSection(value: string | null | undefined): value is ProfileFormSection {
  return profileFormSections.includes(value as ProfileFormSection);
}

function isProfileSavedSection(value: string | null | undefined): value is ProfileSavedSection {
  return value === "all" || isProfileFormSection(value);
}

function value(input: string | number | null | undefined) {
  return input === null || input === undefined ? "" : String(input);
}

const postalCodeCities: Record<string, string> = {
  "2100": "København Ø",
  "2200": "København N",
  "2300": "København S",
  "2400": "København NV",
  "2500": "Valby",
  "2610": "Rødovre",
  "2620": "Albertslund",
  "2630": "Taastrup",
  "2800": "Kongens Lyngby",
  "3000": "Helsingør",
  "3400": "Hillerød",
  "4000": "Roskilde",
  "4100": "Ringsted",
  "4200": "Slagelse",
  "4300": "Holbæk",
  "4400": "Kalundborg",
  "4700": "Næstved",
  "4800": "Nykøbing F",
  "5000": "Odense C",
  "6000": "Kolding",
  "6100": "Haderslev",
  "6200": "Aabenraa",
  "6400": "Sønderborg",
  "6700": "Esbjerg",
  "7100": "Vejle",
  "7400": "Herning",
  "8000": "Aarhus C",
  "8200": "Aarhus N",
  "8210": "Aarhus V",
  "8230": "Åbyhøj",
  "8260": "Viby J",
  "8600": "Silkeborg",
  "8800": "Viborg",
  "9000": "Aalborg",
  "9200": "Aalborg SV",
  "9210": "Aalborg SØ",
  "9220": "Aalborg Øst",
  "9400": "Nørresundby",
};

function digits(input: string | null | undefined) {
  return value(input).replace(/\D/g, "");
}

function formatPhoneInput(input: string) {
  let digitCount = 0;

  return input
    .replace(/[^\d\s]/g, "")
    .split("")
    .filter((character) => {
      if (/\d/.test(character)) {
        digitCount += 1;
        return digitCount <= 8;
      }

      return true;
    })
    .join("")
    .replace(/\s{2,}/g, " ");
}

function FieldStatus({ complete, optional = false }: { complete: boolean; optional?: boolean }) {
  if (complete) {
    return <CheckCircle2 className="size-5 text-sage-700" aria-label="Udfyldt" />;
  }

  if (optional) {
    return <CircleDashed className="size-5 text-orange-500" aria-label="Frivilligt felt mangler" />;
  }

  return <CircleAlert className="size-5 text-red-600" aria-label="Obligatorisk felt mangler" />;
}

function fieldClass(complete: boolean, optional = false) {
  const base = "rounded-md border px-3 text-base outline-none transition focus:border-sage-700";

  if (complete) {
    return `${base} border-olive bg-white`;
  }

  if (optional) {
    return `${base} border-midnight/15`;
  }

  return `${base} border-red-500 bg-red-50`;
}

function SectionSaveButton({ children, section }: { children: string; section: ProfileFormSection }) {
  return (
    <button
      className="inline-flex h-10 items-center justify-center gap-2 rounded-button bg-olive px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500"
      name="section"
      type="submit"
      value={section}
    >
      <Save className="size-4" aria-hidden="true" />
      {children}
    </button>
  );
}

function SectionFeedback({
  errorSection,
  message,
  savedSection,
  section,
}: {
  errorSection: ProfileFormSection | null;
  message: string | null;
  savedSection: ProfileSavedSection | null;
  section: ProfileFormSection;
}) {
  if (errorSection === section && message) {
    return (
      <div className="mt-5 flex items-start gap-2 rounded-md border border-red-500/25 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
    );
  }

  if ((savedSection === section || savedSection === "all") && message) {
    return (
      <div className="mt-5 flex items-start gap-2 rounded-md border border-sage-700/25 bg-[#EEF6E8] px-4 py-3 text-sm font-semibold text-sage-700">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
    );
  }

  return null;
}

function InfoHelp({ children }: { children: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverId = useId();

  return (
    <span className="relative inline-block">
      {isOpen ? (
        <button
          aria-label="Luk hjælp"
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setIsOpen(false)}
          type="button"
        />
      ) : null}
      <button
        aria-controls={popoverId}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Luk hjælp" : "Vis hjælp"}
        className="relative z-20 grid size-6 cursor-pointer place-items-center rounded-full border border-sage-700/25 bg-sage-50 text-sage-700 transition hover:bg-sage-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      {isOpen ? (
        <span
          className="absolute left-0 z-30 mt-2 grid w-[min(18rem,calc(100vw-3rem))] gap-2 rounded-md border border-midnight/10 bg-white p-3 text-xs font-normal leading-5 text-ink/70 shadow-lift sm:left-auto sm:right-0"
          id={popoverId}
          role="dialog"
        >
          <button
            aria-label="Luk hjælp"
            className="justify-self-end rounded-full p-1 text-ink/45 transition hover:bg-sage-50 hover:text-sage-700"
            onClick={() => setIsOpen(false)}
            type="button"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
          <span>{children}</span>
        </span>
      ) : null}
    </span>
  );
}

export function ProfileForm({
  errorSection = null,
  feedbackMessage = null,
  profile,
  facilitatorProfile,
  regions,
  categories,
  selectedCategoryIds,
  galleryImages,
  savedSection = null,
  serviceTitles,
  selectedServiceTitleIds,
}: ProfileFormProps) {
  const [postalCode, setPostalCode] = useState(value(facilitatorProfile.postal_code));
  const [city, setCity] = useState(value(facilitatorProfile.city));
  const [fullName, setFullName] = useState(value(profile.full_name));
  const [companyName, setCompanyName] = useState(value(facilitatorProfile.company_name));
  const [shortDescription, setShortDescription] = useState(value(facilitatorProfile.short_description));
  const [longDescription, setLongDescription] = useState(value(facilitatorProfile.long_description));
  const [phone, setPhone] = useState(value(profile.phone));
  const [addressLine, setAddressLine] = useState(value(facilitatorProfile.address_line));
  const [websiteUrl, setWebsiteUrl] = useState(value(facilitatorProfile.website_url));
  const [facebookUrl, setFacebookUrl] = useState(value(facilitatorProfile.facebook_url));
  const [instagramUrl, setInstagramUrl] = useState(value(facilitatorProfile.instagram_url));
  const [selectedCategories, setSelectedCategories] = useState(selectedCategoryIds);
  const [offersServices, setOffersServices] = useState(Boolean(facilitatorProfile.offers_services));
  const [selectedServiceTitles, setSelectedServiceTitles] = useState(selectedServiceTitleIds);
  const [serviceDescription, setServiceDescription] = useState(value(facilitatorProfile.service_description));
  const [serviceOtherTitle, setServiceOtherTitle] = useState(value(facilitatorProfile.service_other_title));
  const [showInLocalServiceResults, setShowInLocalServiceResults] = useState(Boolean(facilitatorProfile.show_in_local_service_results));
  const [highlightedMissingKey, setHighlightedMissingKey] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveQueueRef = useRef(Promise.resolve());
  const dirtySectionsRef = useRef<Set<ProfileFormSection>>(new Set());
  const hasMountedAutosaveRef = useRef(false);
  const autosaveInFlightRef = useRef(false);
  const lastAutosaveFailedRef = useRef(false);
  const skipSubmitAutosaveRef = useRef(false);
  const saveSequenceRef = useRef(0);
  const [autosaveStatus, setAutosaveStatus] = useState<"error" | "idle" | "saved" | "saving">("idle");
  const [autosaveMessage, setAutosaveMessage] = useState("");
  const currentOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const fullNameComplete = Boolean(fullName.trim());
  const companyNameComplete = Boolean(companyName.trim());
  const shortComplete = shortDescription.trim().length >= 20;
  const phoneComplete = Boolean(phone && digits(phone).length === 8);
  const locationComplete = Boolean(postalCode.trim() && city.trim());
  const categoriesComplete = selectedCategories.length > 0;
  const shortDescriptionMinimum = 20;
  const shortDescriptionMaximum = 300;
  const longDescriptionMaximum = 2000;
  const serviceDescriptionMaximum = 500;
  const shortDescriptionMissing = Math.max(shortDescriptionMinimum - shortDescription.trim().length, 0);
  const inferredRegionSlug = inferRegionSlug({ city, postalCode });
  const selectedRegion =
    regions.find((region) => region.slug === inferredRegionSlug) ??
    regions.find((region) => region.id === facilitatorProfile.region_id);
  const normalizedErrorSection = isProfileFormSection(errorSection) ? errorSection : null;
  const normalizedSavedSection = isProfileSavedSection(savedSection) ? savedSection : null;
  const missingProfileItems: MissingProfileItem[] = [
    fullNameComplete ? null : { focusSelector: "[name='full_name']", key: "full_name", label: "Privat navn", targetId: "profile-full-name-field" },
    companyNameComplete
      ? null
      : { focusSelector: "[name='company_name']", key: "company_name", label: "Visningsnavn", targetId: "profile-company-name-field" },
    shortComplete
      ? null
      : { focusSelector: "[name='short_description']", key: "short_description", label: "Kort præsentation", targetId: "profile-short-description-field" },
    postalCode.trim()
      ? null
      : { focusSelector: "[name='postal_code']", key: "postal_code", label: "Postnummer", targetId: "profile-postal-code-field" },
    city.trim() ? null : { focusSelector: "[name='city']", key: "city", label: "By", targetId: "profile-city-field" },
    categoriesComplete ? null : { key: "categories", label: "Kategorier", targetId: "profile-categories-section" },
  ].filter((item): item is MissingProfileItem => Boolean(item));

  function guideToMissingProfileItem(item: MissingProfileItem) {
    setHighlightedMissingKey(item.key);

    window.setTimeout(() => {
      const target = document.getElementById(item.targetId);
      const focusTarget = item.focusSelector
        ? (document.querySelector(item.focusSelector) as HTMLElement | null)
        : (target?.querySelector("input, textarea, select, button") as HTMLElement | null);

      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      focusTarget?.focus({ preventScroll: true });
    }, 50);

    window.setTimeout(() => setHighlightedMissingKey(""), 1800);
  }

  function highlightMissingClass(key: string) {
    return highlightedMissingKey === key ? "ring-4 ring-[#D89A94]/35" : "";
  }

  const buildAutosaveInput = useCallback(
    (section: ProfileFormSection): Parameters<typeof autosaveFacilitatorProfileAction>[0] => {
      if (section === "contact") {
        return {
          section,
          values: {
            company_name: companyName,
            full_name: fullName,
            long_description: longDescription,
            phone,
            short_description: shortDescription,
          },
        };
      }

      if (section === "location") {
        return {
          section,
          values: {
            address_line: addressLine,
            city,
            postal_code: postalCode,
          },
        };
      }

      if (section === "social") {
        return {
          section,
          values: {
            facebook_url: facebookUrl,
            instagram_url: instagramUrl,
            website_url: websiteUrl,
          },
        };
      }

      if (section === "categories") {
        return { section, values: { category_ids: selectedCategories } };
      }

      if (section === "services") {
        return {
          section,
          values: {
            offers_services: offersServices,
            service_description: serviceDescription,
            service_other_title: serviceOtherTitle,
            service_title_ids: selectedServiceTitles,
            show_in_local_service_results: showInLocalServiceResults,
          },
        };
      }

      return { section, values: {} };
    },
    [
      addressLine,
      city,
      companyName,
      facebookUrl,
      fullName,
      instagramUrl,
      longDescription,
      offersServices,
      phone,
      postalCode,
      selectedCategories,
      selectedServiceTitles,
      serviceDescription,
      serviceOtherTitle,
      shortDescription,
      showInLocalServiceResults,
      websiteUrl,
    ],
  );

  const flushAutosaveNow = useCallback(
    async (sections?: ProfileFormSection[]) => {
      const sectionsToSave = sections ?? [...dirtySectionsRef.current];

      if (sectionsToSave.length === 0) {
        if (autosaveInFlightRef.current) {
          await autosaveQueueRef.current;
          return !lastAutosaveFailedRef.current;
        }

        return true;
      }

      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      sectionsToSave.forEach((section) => dirtySectionsRef.current.delete(section));
      const saveSequence = saveSequenceRef.current + 1;
      saveSequenceRef.current = saveSequence;
      autosaveInFlightRef.current = true;
      lastAutosaveFailedRef.current = false;
      setAutosaveStatus("saving");
      setAutosaveMessage("Gemmer...");

      const saveTask = autosaveQueueRef.current.then(async () => {
        for (const section of sectionsToSave) {
          const result = await autosaveFacilitatorProfileAction(buildAutosaveInput(section));

          if (!result.ok) {
            throw new Error(result.message);
          }
        }
      });

      const trackedSaveTask = saveTask.catch(() => undefined);
      autosaveQueueRef.current = trackedSaveTask;

      try {
        await saveTask;

        if (autosaveQueueRef.current === trackedSaveTask) {
          autosaveInFlightRef.current = false;
        }

        if (saveSequenceRef.current === saveSequence) {
          setAutosaveStatus("saved");
          setAutosaveMessage("Gemt");
        }

        return true;
      } catch (error) {
        if (autosaveQueueRef.current === trackedSaveTask) {
          autosaveInFlightRef.current = false;
        }

        lastAutosaveFailedRef.current = true;

        if (saveSequenceRef.current === saveSequence) {
          setAutosaveStatus("error");
          setAutosaveMessage(error instanceof Error ? error.message : "Profilen kunne ikke gemmes automatisk.");
        }

        sectionsToSave.forEach((section) => dirtySectionsRef.current.add(section));
        return false;
      }
    },
    [buildAutosaveInput],
  );

  const markSectionDirty = useCallback(
    (section: ProfileFormSection) => {
      dirtySectionsRef.current.add(section);
      setAutosaveStatus("idle");
      setAutosaveMessage("");

      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = window.setTimeout(() => {
        void flushAutosaveNow();
      }, 1000);
    },
    [flushAutosaveNow],
  );

  function handleFormBlur() {
    void flushAutosaveNow();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;

    if (skipSubmitAutosaveRef.current) {
      skipSubmitAutosaveRef.current = false;
      return;
    }

    if (submitter?.value === "all" && missingProfileItems.length > 0) {
      event.preventDefault();
      guideToMissingProfileItem(missingProfileItems[0]);
      return;
    }

    event.preventDefault();

    const didSave = await flushAutosaveNow();

    if (didSave) {
      skipSubmitAutosaveRef.current = true;
      formRef.current?.requestSubmit(submitter ?? undefined);
    }
  }

  useEffect(() => {
    if (!hasMountedAutosaveRef.current) return;
    markSectionDirty("contact");
  }, [companyName, fullName, longDescription, markSectionDirty, phone, shortDescription]);

  useEffect(() => {
    if (!hasMountedAutosaveRef.current) return;
    markSectionDirty("location");
  }, [addressLine, city, markSectionDirty, postalCode]);

  useEffect(() => {
    if (!hasMountedAutosaveRef.current) return;
    markSectionDirty("social");
  }, [facebookUrl, instagramUrl, markSectionDirty, websiteUrl]);

  useEffect(() => {
    if (!hasMountedAutosaveRef.current) return;
    markSectionDirty("categories");
  }, [markSectionDirty, selectedCategories]);

  useEffect(() => {
    if (!hasMountedAutosaveRef.current) return;
    markSectionDirty("services");
  }, [markSectionDirty, offersServices, selectedServiceTitles, serviceDescription, serviceOtherTitle, showInLocalServiceResults]);

  useEffect(() => {
    hasMountedAutosaveRef.current = true;

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  async function fetchPostalCodeCity(normalizedPostalCode: string) {
    try {
      const response = await fetch(`https://api.dataforsyningen.dk/postnumre/${normalizedPostalCode}`);

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { navn?: string };

      if (data.navn) {
        setCity(data.navn);
      }
    } catch {
      // Keep the manually entered city or local fallback if the public lookup is unavailable.
    }
  }

  function handlePostalCodeChange(nextPostalCode: string) {
    setPostalCode(nextPostalCode);
    const normalizedPostalCode = nextPostalCode.replace(/\D/g, "");
    const inferredCity = postalCodeCities[normalizedPostalCode];

    if (inferredCity) {
      setCity(inferredCity);
    }

    if (normalizedPostalCode.length === 4) {
      void fetchPostalCodeCity(normalizedPostalCode);
    }
  }

  return (
    <form
      action={updateFacilitatorProfileAction}
      autoComplete="off"
      className="grid gap-6"
      noValidate
      onBlurCapture={handleFormBlur}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <input name="current_origin" suppressHydrationWarning type="hidden" value={currentOrigin} />
      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-midnight">Kontakt og præsentation</h2>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className={"grid gap-2 text-sm font-medium text-ink/72 " + highlightMissingClass("full_name")} id="profile-full-name-field">
            <span className="flex flex-wrap items-center gap-2">
              Privat navn
              <InfoHelp>Privat navn bruges internt af SoulEvents og i kommunikationen med dig.</InfoHelp>
            </span>
            <input
              autoComplete="off"
              className={`h-11 ${fieldClass(fullNameComplete)}`}
              name="full_name"
              maxLength={80}

              onChange={(event) => setFullName(event.target.value)}
              placeholder="Skal udfyldes"
              value={fullName}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            E-mail
            <input
              className="h-11 rounded-md border border-midnight/15 bg-sage-50 px-3 text-base text-ink/65"
              defaultValue={profile.email}
              disabled
              type="email"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              Telefon
              <InfoHelp>Telefonnummer skal bestå af præcis 8 tal. Mellemrum er tilladt.</InfoHelp>
            </span>
            <input
              autoComplete="off"
              className={`h-11 ${fieldClass(phoneComplete, true)}`}
              inputMode="tel"
              maxLength={11}
              name="phone"
              onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
              pattern="[0-9 ]*"
              placeholder="Valgfrit - fx 12 34 56 78"
              title="Telefonnummer skal bestå af præcis 8 tal. Mellemrum er tilladt."
              value={phone}
            />
          </label>

          <label className={"grid gap-2 text-sm font-medium text-ink/72 " + highlightMissingClass("company_name")} id="profile-company-name-field">
            <span className="flex flex-wrap items-center gap-2">
              Det navn du ønsker at blive vist under
              <InfoHelp>
                Dette navn vises på din offentlige profil og ved dine events. Det kan være dit eget navn, navnet på
                din praksis, dit koncept eller dit brand.
              </InfoHelp>
            </span>
            <input
              autoComplete="off"
              className={`h-11 ${fieldClass(companyNameComplete)}`}
              name="company_name"
              maxLength={100}

              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Skal udfyldes"
              value={companyName}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4">
          <label className={"grid gap-2 text-sm font-medium text-ink/72 " + highlightMissingClass("short_description")} id="profile-short-description-field">
            <span className="flex flex-wrap items-center gap-2">
              Kort præsentation
              <FieldStatus complete={shortComplete} />
              <InfoHelp>Denne tekst vises offentligt på din profil og bruges ofte som det første indtryk af dig.</InfoHelp>
            </span>
            <textarea
              autoComplete="off"
              className={`min-h-24 p-3 ${fieldClass(shortComplete)}`}
              name="short_description"
              maxLength={shortDescriptionMaximum}

              onChange={(event) => setShortDescription(event.target.value)}
              placeholder="Skal udfyldes"
              value={shortDescription}
            />
            <span className={shortComplete ? "text-xs font-semibold text-[#7A4EAB]" : "text-xs font-semibold text-[#B56F8A]"}>
              {shortComplete
                ? `${shortDescriptionMaximum - shortDescription.length} tegn tilbage`
                : `Mangler ${shortDescriptionMissing} tegn før præsentationen er lang nok`}
            </span>
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              Uddybende præsentation
              <InfoHelp>
                Denne tekst vises offentligt på din profil. Her kan du fortælle mere om din baggrund, erfaring og
                tilgang.
              </InfoHelp>
            </span>
            <textarea
              autoComplete="off"
              className={`min-h-40 p-3 ${fieldClass(Boolean(longDescription.trim()), true)}`}
              name="long_description"
              maxLength={longDescriptionMaximum}

              onChange={(event) => setLongDescription(event.target.value)}
              placeholder="Valgfrit"
              value={longDescription}
            />
            <span className="text-xs font-semibold text-[#7A4EAB]">
              {longDescriptionMaximum - longDescription.length} tegn tilbage
            </span>
          </label>
        </div>

        <SectionFeedback
          errorSection={normalizedErrorSection}
          message={feedbackMessage}
          savedSection={normalizedSavedSection}
          section="contact"
        />

        <div className="mt-5 flex justify-center sm:justify-end">
          <SectionSaveButton section="contact">Gem dette afsnit</SectionSaveButton>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-midnight">
            Lokation
            <FieldStatus complete={locationComplete} />
            <InfoHelp>Postnummer og by skal udfyldes. Adresse er frivillig og kan udelades af hensyn til privatliv.</InfoHelp>
          </h2>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-ink/72 md:col-span-2">
            <span className="flex flex-wrap items-center gap-2">
              Adresse
            </span>
            <input
              autoComplete="off"
              className={`h-11 ${fieldClass(Boolean(addressLine.trim()), true)}`}
              name="address_line"
              maxLength={120}

              onChange={(event) => setAddressLine(event.target.value)}
              placeholder="Valgfrit"
              value={addressLine}
            />
          </label>

          <label className={"grid gap-2 text-sm font-medium text-ink/72 " + highlightMissingClass("postal_code")} id="profile-postal-code-field">
            <span className="flex flex-wrap items-center gap-2">
              Postnummer
            </span>
            <input
              autoComplete="off"
              className={`h-11 ${fieldClass(Boolean(postalCode.trim()))}`}
              name="postal_code"
              maxLength={20}

              onChange={(event) => handlePostalCodeChange(event.target.value)}
              placeholder="Skal udfyldes"
              value={postalCode}
            />
          </label>

          <label className={"grid gap-2 text-sm font-medium text-ink/72 " + highlightMissingClass("city")} id="profile-city-field">
            <span className="flex flex-wrap items-center gap-2">
              By
            </span>
            <input
              autoComplete="off"
              className={`h-11 ${fieldClass(Boolean(city.trim()))}`}
              name="city"
              maxLength={80}

              onChange={(event) => setCity(event.target.value)}
              placeholder="Skal udfyldes"
              value={city}
            />
          </label>

          <div className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">Område</span>
            <input name="region_id" type="hidden" value={selectedRegion?.id ?? ""} />
            <div className="flex min-h-11 items-center rounded-md border border-[#D7C4F0] bg-[#F8F3FF] px-3 text-base text-ink">
              {selectedRegion?.name ?? "Område beregnes automatisk ud fra postnummer"}
            </div>
          </div>

          <p className="rounded-md bg-sage-50 p-3 text-sm leading-6 text-ink/65">
            Kortplacering oprettes automatisk ud fra postnummer og by. Hvis du udfylder adresse, bliver placeringen
            mere præcis.
          </p>
        </div>

        <SectionFeedback
          errorSection={normalizedErrorSection}
          message={feedbackMessage}
          savedSection={normalizedSavedSection}
          section="location"
        />

        <div className="mt-5 flex justify-center sm:justify-end">
          <SectionSaveButton section="location">Gem dette afsnit</SectionSaveButton>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-50 text-sage-700">
              <Link2 className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-midnight">Offentlige links</h2>
              <p className="mt-1 text-sm leading-6 text-ink/64">
                Links vises på din offentlige profil, hvis du udfylder dem.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              Hjemmeside
              <InfoHelp>Eksempel: https://www.soulevents.dk/</InfoHelp>
            </span>
            <input
              autoComplete="off"
              className={`h-11 ${fieldClass(Boolean(websiteUrl.trim()), true)}`}
              name="website_url"
              maxLength={300}

              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="Valgfrit"
              type="url"
              value={websiteUrl}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              Facebook
              <InfoHelp>Eksempel: https://www.facebook.com/soulevents.dk/</InfoHelp>
            </span>
            <input
              autoComplete="off"
              className={`h-11 ${fieldClass(Boolean(facebookUrl.trim()), true)}`}
              name="facebook_url"
              maxLength={300}

              onChange={(event) => setFacebookUrl(event.target.value)}
              placeholder="Valgfrit"
              type="url"
              value={facebookUrl}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              Instagram
              <InfoHelp>Eksempel: https://www.instagram.com/soulevents.dk/</InfoHelp>
            </span>
            <input
              autoComplete="off"
              className={`h-11 ${fieldClass(Boolean(instagramUrl.trim()), true)}`}
              name="instagram_url"
              maxLength={300}

              onChange={(event) => setInstagramUrl(event.target.value)}
              placeholder="Valgfrit"
              type="url"
              value={instagramUrl}
            />
          </label>
        </div>

        <SectionFeedback
          errorSection={normalizedErrorSection}
          message={feedbackMessage}
          savedSection={normalizedSavedSection}
          section="social"
        />

        <div className="mt-5 flex justify-center sm:justify-end">
          <SectionSaveButton section="social">Gem dette afsnit</SectionSaveButton>
        </div>
      </section>

      <section className={"rounded-md border border-midnight/10 bg-white p-5 shadow-soft " + highlightMissingClass("categories")} id="profile-categories-section">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-50 text-sage-700">
              <Camera className="size-4" aria-hidden="true" />
            </div>
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-midnight">
              Billeder
            </h2>
          </div>
        </div>

        <div className="mt-5">
          <ProfileImageManager
            galleryImages={galleryImages}
            profileImagePath={facilitatorProfile.profile_image_path}
          />
        </div>

        <SectionFeedback
          errorSection={normalizedErrorSection}
          message={feedbackMessage}
          savedSection={normalizedSavedSection}
          section="images"
        />

        <div className="mt-5 flex justify-center sm:justify-end">
          <SectionSaveButton section="images">Gem dette afsnit</SectionSaveButton>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-midnight">
            Kategorier
            <FieldStatus complete={categoriesComplete} />
            <InfoHelp>Vælg mindst én kategori, så brugerne kan finde dig under de rigtige emner.</InfoHelp>
          </h2>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...categories].sort((a, b) => a.name.localeCompare(b.name, "da-DK")).map((category) => (
            <label
              className="flex items-center gap-3 rounded-md border border-midnight/10 p-3 text-sm font-medium text-ink/75"
              key={category.id}
            >
              <input
                className="size-4 accent-sage-700"
                checked={selectedCategories.includes(category.id)}
                name="category_ids"
                onChange={(event) => {
                  setSelectedCategories((current) =>
                    event.target.checked
                      ? [...current, category.id]
                      : current.filter((categoryId) => categoryId !== category.id),
                  );
                }}
                type="checkbox"
                value={category.id}
              />
              {category.name}
            </label>
          ))}
        </div>

        <SectionFeedback
          errorSection={normalizedErrorSection}
          message={feedbackMessage}
          savedSection={normalizedSavedSection}
          section="categories"
        />

        <div className="mt-5 flex justify-center sm:justify-end">
          <SectionSaveButton section="categories">Gem dette afsnit</SectionSaveButton>
        </div>
      </section>



      <section className="rounded-md border border-[#E5D4F7] bg-[#FAF6EF] p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Behandlinger og ydelser</p>
            <h2 className="mt-1 text-lg font-semibold text-midnight">Tilbyder du også sessioner?</h2>
            <p className="mt-1 text-sm leading-6 text-ink/64">
              Vælg titler fra listen, så din profil senere kan findes i lokale søgeresultater og på kortet.
            </p>
          </div>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-md border border-[#E5D4F7] bg-white p-4 text-sm font-semibold text-midnight">
          <input
            checked={offersServices}
            className="mt-1 size-4 accent-[#7A4EAB]"
            name="offers_services"
            onChange={(event) => setOffersServices(event.target.checked)}
            type="checkbox"
          />
          <span>
            Jeg tilbyder også behandlinger, sessioner eller ydelser
            <span className="mt-1 block text-sm font-normal leading-6 text-ink/64">
              Fx healing, massage, coaching, lydterapi, åndedræt eller individuel undervisning.
            </span>
          </span>
        </label>

        {offersServices && (
          <div className="mt-5 grid gap-5">
            <div>
              <p className="text-sm font-semibold text-ink/72">Vælg dine titler/ydelser</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {serviceTitles.map((title) => (
                  <label
                    className={
                      selectedServiceTitles.includes(title.id)
                        ? "flex items-center gap-3 rounded-md border border-[#7A4EAB] bg-[#EDE4F7] p-3 text-sm font-semibold text-[#2F2633]"
                        : "flex items-center gap-3 rounded-md border border-midnight/10 bg-white p-3 text-sm font-medium text-ink/75"
                    }
                    key={title.id}
                  >
                    <input
                      checked={selectedServiceTitles.includes(title.id)}
                      className="size-4 accent-[#7A4EAB]"
                      name="service_title_ids"
                      onChange={(event) => {
                        setSelectedServiceTitles((current) =>
                          event.target.checked
                            ? [...current, title.id]
                            : current.filter((titleId) => titleId !== title.id),
                        );
                      }}
                      type="checkbox"
                      value={title.id}
                    />
                    {title.name}
                    {title.is_active === false && <span className="ml-auto text-xs text-ink/45">Skjult</span>}
                  </label>
                ))}
              </div>
            </div>

            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Kort beskrivelse
              <textarea
                autoComplete="off"
                className={"min-h-28 p-3 " + fieldClass(Boolean(serviceDescription.trim()), true)}
                name="service_description"
                maxLength={serviceDescriptionMaximum}

                onChange={(event) => setServiceDescription(event.target.value)}
                placeholder="Fortæl kort hvilke behandlinger, sessioner eller ydelser du tilbyder."
                value={serviceDescription}
              />
              <span className="text-xs font-semibold text-[#7A4EAB]">
                {serviceDescriptionMaximum - serviceDescription.length} tegn tilbage
              </span>
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Anden titel eller uddybning
              <input
                autoComplete="off"
                className={"h-11 " + fieldClass(Boolean(serviceOtherTitle.trim()), true)}
                name="service_other_title"
                maxLength={120}

                onChange={(event) => setServiceOtherTitle(event.target.value)}
                placeholder="Valgfrit - fx Reiki Master, Breathwork facilitator eller lignende"
                value={serviceOtherTitle}
              />
            </label>

            <label className="flex items-start gap-3 rounded-md border border-midnight/10 bg-white p-4 text-sm font-semibold text-midnight">
              <input
                className="mt-1 size-4 accent-[#7A4EAB]"
                checked={showInLocalServiceResults}
                name="show_in_local_service_results"
                onChange={(event) => setShowInLocalServiceResults(event.target.checked)}
                type="checkbox"
              />
              <span>
                Vis min profil i lokale søgeresultater, hvor det er relevant
                <span className="mt-1 block text-sm font-normal leading-6 text-ink/64">
                  Bruges senere til lokale søgninger, kort og filtre for behandlinger og ydelser.
                </span>
              </span>
            </label>
          </div>
        )}

        <SectionFeedback
          errorSection={normalizedErrorSection}
          message={feedbackMessage}
          savedSection={normalizedSavedSection}
          section="services"
        />

        <div className="mt-5 flex justify-center sm:justify-end">
          <SectionSaveButton section="services">Gem dette afsnit</SectionSaveButton>
        </div>
      </section>

      <div className="grid gap-4 rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        {normalizedSavedSection === "all" && feedbackMessage ? (
          <div className="flex items-start gap-2 rounded-md border border-sage-700/25 bg-[#EEF6E8] px-4 py-3 text-sm font-semibold text-sage-700">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{feedbackMessage}</span>
          </div>
        ) : null}

        {normalizedErrorSection && feedbackMessage ? (
          <div className="flex items-start gap-2 rounded-md border border-red-500/25 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{feedbackMessage}</span>
          </div>
        ) : null}

        {missingProfileItems.length > 0 ? (
          <div className="rounded-md border border-[#D8CBE4] bg-[#F4F0F7] p-4 text-sm leading-6 text-[#6E5A86]">
            <p className="font-semibold">Udfyld først:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {missingProfileItems.map((item) => (
                <button
                  className="rounded-full border border-[#D8CBE4] bg-white px-3 py-1 text-xs font-semibold text-[#7A5D91] transition hover:border-[#7A5D91]"
                  key={item.key}
                  onClick={() => guideToMissingProfileItem(item)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-[#CFE3C8] bg-[#F3F7F0] p-4 text-sm leading-6 text-[#4F6F48]">
            <p className="font-semibold">Din profil er klar til at blive gemt samlet.</p>
          </div>
        )}

        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div className="grid max-w-2xl gap-1">
            <p className="text-sm leading-6 text-ink/64">
              Når du er færdig, kan du gemme hele profilen samlet her.
            </p>
            {autosaveMessage ? (
              <p
                className={
                  autosaveStatus === "error"
                    ? "text-sm font-semibold text-red-700"
                    : autosaveStatus === "saving"
                      ? "text-sm font-semibold text-[#7A5D91]"
                      : "text-sm font-semibold text-sage-700"
                }
              >
                {autosaveMessage}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md border border-midnight/15 bg-white px-5 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
              href="/facilitator"
            >
              Tilbage til forsiden
            </Link>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-midnight px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700"
              name="section"
              type="submit"
              value="all"
            >
              <Save className="size-4" aria-hidden="true" />
              Gem hele profilen
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
