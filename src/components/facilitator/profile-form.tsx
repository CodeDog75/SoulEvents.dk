"use client";

import { Camera, CheckCircle2, CircleAlert, CircleDashed, Info, Link2, Save } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { updateFacilitatorProfileAction } from "@/app/facilitator/profile/actions";
import { ProfileImageManager } from "@/components/facilitator/profile-image-manager";

type Region = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  name: string;
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
};

type GalleryImage = {
  image_path: string;
  alt_text: string | null;
};

type ProfileFormProps = {
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
};

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

function SectionSaveButton({ children, section }: { children: string; section: string }) {
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

function InfoHelp({ children }: { children: string }) {
  return (
    <details className="group relative inline-block">
      <summary className="grid size-6 cursor-pointer list-none place-items-center rounded-full border border-sage-700/25 bg-sage-50 text-sage-700 transition hover:bg-sage-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-700 [&::-webkit-details-marker]:hidden">
        <Info className="size-3.5" aria-label="Vis hjælp" />
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-[min(18rem,calc(100vw-3rem))] rounded-md border border-midnight/10 bg-white p-3 text-xs font-normal leading-5 text-ink/70 shadow-lift sm:left-auto sm:right-0">
        {children}
      </div>
    </details>
  );
}

export function ProfileForm({
  profile,
  facilitatorProfile,
  regions,
  categories,
  selectedCategoryIds,
  galleryImages,
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
  const fullNameComplete = Boolean(fullName.trim());
  const companyNameComplete = Boolean(companyName.trim());
  const shortComplete = shortDescription.trim().length >= 20;
  const phoneComplete = Boolean(phone && digits(phone).length === 8);
  const locationComplete = Boolean(postalCode.trim() && city.trim());
  const categoriesComplete = selectedCategories.length > 0;

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
    <form action={updateFacilitatorProfileAction} className="grid gap-6" noValidate>
      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-midnight">Kontakt og præsentation</h2>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              Dit rigtige navn
              <InfoHelp>Dit rigtige navn bruges internt af SoulEvents og i kommunikationen med dig.</InfoHelp>
            </span>
            <input
              className={`h-11 ${fieldClass(fullNameComplete)}`}
              name="full_name"
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

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              Det navn du ønsker at blive vist under
              <InfoHelp>
                Dette navn vises på din offentlige profil og ved dine events. Det kan være dit eget navn, navnet på
                din praksis, dit koncept eller dit brand.
              </InfoHelp>
            </span>
            <input
              className={`h-11 ${fieldClass(companyNameComplete)}`}
              name="company_name"
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Skal udfyldes"
              value={companyName}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              Kort præsentation
              <FieldStatus complete={shortComplete} />
              <InfoHelp>Denne tekst vises offentligt på din profil og bruges ofte som det første indtryk af dig.</InfoHelp>
            </span>
            <textarea
              className={`min-h-24 p-3 ${fieldClass(shortComplete)}`}
              name="short_description"
              onChange={(event) => setShortDescription(event.target.value)}
              placeholder="Skal udfyldes"
              value={shortDescription}
            />
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
              className={`min-h-40 p-3 ${fieldClass(Boolean(longDescription.trim()), true)}`}
              name="long_description"
              onChange={(event) => setLongDescription(event.target.value)}
              placeholder="Valgfrit"
              value={longDescription}
            />
          </label>
        </div>

        <div className="mt-5 flex justify-center sm:justify-end">
          <SectionSaveButton section="contact">Gem kontakt og præsentation</SectionSaveButton>
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
              className={`h-11 ${fieldClass(Boolean(addressLine.trim()), true)}`}
              name="address_line"
              onChange={(event) => setAddressLine(event.target.value)}
              placeholder="Valgfrit"
              value={addressLine}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              Postnummer
            </span>
            <input
              className={`h-11 ${fieldClass(Boolean(postalCode.trim()))}`}
              name="postal_code"
              onChange={(event) => handlePostalCodeChange(event.target.value)}
              placeholder="Skal udfyldes"
              value={postalCode}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              By
            </span>
            <input
              className={`h-11 ${fieldClass(Boolean(city.trim()))}`}
              name="city"
              onChange={(event) => setCity(event.target.value)}
              placeholder="Skal udfyldes"
              value={city}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              Region
            </span>
            <select
              className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue={value(facilitatorProfile.region_id)}
              name="region_id"
            >
              <option value="">Vælg region</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>

          <p className="rounded-md bg-sage-50 p-3 text-sm leading-6 text-ink/65">
            Kortplacering oprettes automatisk ud fra postnummer og by. Hvis du udfylder adresse, bliver placeringen
            mere præcis.
          </p>
        </div>

        <div className="mt-5 flex justify-center sm:justify-end">
          <SectionSaveButton section="location">Gem lokation</SectionSaveButton>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-50 text-sage-700">
              <Link2 className="size-4" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-midnight">SoMe links</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="flex flex-wrap items-center gap-2">
              Hjemmeside
              <InfoHelp>Eksempel: https://www.soulevents.dk/</InfoHelp>
            </span>
            <input
              className={`h-11 ${fieldClass(Boolean(websiteUrl.trim()), true)}`}
              name="website_url"
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
              className={`h-11 ${fieldClass(Boolean(facebookUrl.trim()), true)}`}
              name="facebook_url"
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
              className={`h-11 ${fieldClass(Boolean(instagramUrl.trim()), true)}`}
              name="instagram_url"
              onChange={(event) => setInstagramUrl(event.target.value)}
              placeholder="Valgfrit"
              type="url"
              value={instagramUrl}
            />
          </label>
        </div>

        <div className="mt-5 flex justify-center sm:justify-end">
          <SectionSaveButton section="social">Gem sociale medier</SectionSaveButton>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
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

        <div className="mt-5 flex justify-center sm:justify-end">
          <SectionSaveButton section="images">Gem billeder</SectionSaveButton>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-midnight">
            Facilitatorydelser
            <FieldStatus complete={categoriesComplete} />
            <InfoHelp>Vælg mindst én kategori, så brugerne kan finde dig under de rigtige emner.</InfoHelp>
          </h2>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <label
              className="flex items-center gap-3 rounded-md border border-midnight/10 p-3 text-sm font-medium text-ink/75"
              key={category.id}
            >
              <input
                className="size-4 accent-sage-700"
                defaultChecked={selectedCategoryIds.includes(category.id)}
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

        <div className="mt-5 flex justify-center sm:justify-end">
          <SectionSaveButton section="categories">Gem facilitatorydelser</SectionSaveButton>
        </div>
      </section>

      <div className="flex flex-col items-center gap-4 rounded-md border border-midnight/10 bg-white p-5 text-center shadow-soft sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p className="max-w-2xl text-sm leading-6 text-ink/64">
          Har du ændret flere afsnit uden at bruge de enkelte gem-knapper, kan du gemme hele profilen samlet her.
        </p>
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
    </form>
  );
}
