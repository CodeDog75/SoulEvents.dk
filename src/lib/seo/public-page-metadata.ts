import { formatDanishEventDate } from "@/lib/events/date-format";
import { profileCountryName } from "@/lib/locations/countries";
import { stripHtml } from "@/lib/open-graph-core";

type PublicLink = {
  href: string;
};

type FacilitatorSeoInput = {
  categories?: Array<string | null | undefined>;
  city?: string | null;
  country?: string | null;
  countryName?: string | null;
  eventTitles?: Array<string | null | undefined>;
  name: string;
  presentationText?: string | null;
  region?: string | null;
  serviceDescription?: string | null;
  specialties?: Array<string | null | undefined>;
};

type EventSeoInput = {
  categories?: Array<string | null | undefined>;
  city?: string | null;
  description?: string | null;
  eventFormat?: string | null;
  organizerCategories?: Array<string | null | undefined>;
  organizerName?: string | null;
  organizerSpecialties?: Array<string | null | undefined>;
  startsAt?: string | null;
  tags?: Array<string | null | undefined>;
  title: string;
};

type ProfileJsonLdInput = FacilitatorSeoInput & {
  canonicalUrl: string;
  email?: string | null;
  imageUrl?: string | null;
  links?: PublicLink[];
  phone?: string | null;
};

type EventJsonLdInput = EventSeoInput & {
  canonicalUrl: string;
  coOrganizers?: Array<{ name: string; url?: string | null }>;
  endDate?: string | null;
  imageUrl?: string | null;
  isSoldOut?: boolean;
  location?: {
    addressLine?: string | null;
    city?: string | null;
    name?: string | null;
    postalCode?: string | null;
    region?: string | null;
  };
  organizerUrl?: string | null;
  priceCents?: number | null;
  status?: string | null;
};

function normalizeText(value: string | null | undefined) {
  return stripHtml(value).replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string) {
  return value.toLocaleLowerCase("da-DK").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function uniqueTexts(values: Array<string | null | undefined>, limit = 4) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of values) {
    const value = normalizeText(rawValue);
    if (!value) continue;
    const key = normalizeKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }

  return result;
}

function removeTextsAlreadyInSource(values: string[], source: string) {
  const sourceKey = normalizeKey(source);
  return values.filter((value) => !sourceKey.includes(normalizeKey(value)));
}

function truncateAtWord(value: string, maxLength = 170) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;
  const sliced = normalized.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut = lastSpace > 90 ? sliced.slice(0, lastSpace) : sliced;
  return cut.trimEnd().replace(/[,.:-]+$/, "") + "…";
}

function sentence(value: string) {
  const trimmed = normalizeText(value);
  if (!trimmed) return "";
  return /[.!?…]$/.test(trimmed) ? trimmed : trimmed + ".";
}

function naturalList(values: string[]) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return values[0] + " og " + values[1];
  return values.slice(0, -1).join(", ") + " og " + values[values.length - 1];
}

function formatDate(value: string | null | undefined) {
  return value ? formatDanishEventDate(value, "") || null : null;
}

function placeText(input: { city?: string | null; country?: string | null; countryName?: string | null; region?: string | null }) {
  return normalizeText(input.city) || normalizeText(input.region) || profileCountryName(input.country, input.countryName) || "Danmark";
}

function eventPlaceText(input: { city?: string | null; eventFormat?: string | null }) {
  if (input.eventFormat === "online") return "online";
  return normalizeText(input.city) || "Danmark";
}

export function buildFacilitatorMetadata(input: FacilitatorSeoInput) {
  const name = normalizeText(input.name) || "Arrangør";
  const place = placeText(input);
  const categories = uniqueTexts(input.categories ?? [], 3);
  const specialties = uniqueTexts(input.specialties ?? [], 2);
  const serviceDescription = normalizeText(input.serviceDescription);
  const presentationText = normalizeText(input.presentationText);
  const eventTitles = uniqueTexts(input.eventTitles ?? [], 2);
  const headlineParts = uniqueTexts([...specialties, ...categories], 3);
  const title = name + (headlineParts.length ? " – " + naturalList(headlineParts) : "") + " i " + place + " | SoulEvents";
  const focus = specialties[0] || naturalList(categories) || serviceDescription || "sit univers";
  const categorySentence = categories.length ? "Arbejder med " + naturalList(categories) + "." : "";
  const serviceSentence = serviceDescription ? sentence(serviceDescription) : "";
  const eventSentence = eventTitles.length ? "Se kommende events som " + naturalList(eventTitles) + "." : "Se ydelser og kommende events.";
  const description = truncateAtWord(
    [
      "Mød " + name + " i " + place + ".",
      "Læs om " + focus + ".",
      categorySentence,
      serviceSentence,
      presentationText,
      eventSentence,
    ].filter(Boolean).join(" "),
  );

  return {
    description,
    title,
    topics: uniqueTexts([...specialties, ...categories], 8),
  };
}

export function buildEventMetadata(input: EventSeoInput) {
  const title = normalizeText(input.title) || "Event";
  const place = eventPlaceText(input);
  const date = formatDate(input.startsAt);
  const organizerName = normalizeText(input.organizerName) || "arrangøren";
  const categories = removeTextsAlreadyInSource(uniqueTexts(input.categories ?? [], 3), title);
  const tags = removeTextsAlreadyInSource(uniqueTexts(input.tags ?? [], 4), title);
  const organizerTopics = removeTextsAlreadyInSource(uniqueTexts([...(input.organizerSpecialties ?? []), ...(input.organizerCategories ?? [])], 2), title);
  const topics = uniqueTexts([...categories, ...tags, ...organizerTopics], 4);
  const seoTitle = title + " " + (place === "online" ? "online" : "i " + place) + (date ? " – " + date : "") + " | SoulEvents";
  const topicSentence = topics.length ? "Et event med " + naturalList(topics) + "." : "";
  const sourceDescription = normalizeText(input.description);
  const description = truncateAtWord(
    [
      "Oplev " + title + " " + (place === "online" ? "online" : "i " + place) + " med " + organizerName + (date ? " den " + date : "") + ".",
      topicSentence,
      sourceDescription,
      "Se pris og tilmelding.",
    ].filter(Boolean).join(" "),
  );

  return {
    description,
    title: seoTitle,
    topics,
  };
}

export function buildProfilePageJsonLd(input: ProfileJsonLdInput) {
  const metadata = buildFacilitatorMetadata(input);
  const sameAs = uniqueTexts((input.links ?? []).map((link) => link.href), 8);

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: input.name + " på SoulEvents",
    description: metadata.description,
    url: input.canonicalUrl,
    image: input.imageUrl || undefined,
    mainEntity: {
      "@type": "Person",
      name: input.name,
      description: metadata.description,
      image: input.imageUrl || undefined,
      url: input.canonicalUrl,
      homeLocation: {
        "@type": "Place",
        name: placeText(input),
      },
      knowsAbout: metadata.topics,
      sameAs: sameAs.length ? sameAs : undefined,
      email: input.email || undefined,
      telephone: input.phone || undefined,
    },
  };
}

export function buildEventJsonLd(input: EventJsonLdInput) {
  const metadata = buildEventMetadata(input);
  const organizerItems = [
    {
      "@type": "Organization",
      name: normalizeText(input.organizerName) || "SoulEvents arrangør",
      url: input.organizerUrl || undefined,
    },
    ...(input.coOrganizers ?? []).map((coOrganizer) => ({
      "@type": "Organization",
      name: coOrganizer.name,
      url: coOrganizer.url || undefined,
    })),
  ];

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: input.title,
    description: metadata.description,
    image: input.imageUrl ? [input.imageUrl] : undefined,
    startDate: input.startsAt || undefined,
    endDate: input.endDate || undefined,
    eventAttendanceMode:
      input.eventFormat === "online"
        ? "https://schema.org/OnlineEventAttendanceMode"
        : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: input.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    url: input.canonicalUrl,
    keywords: metadata.topics.length ? metadata.topics.join(", ") : undefined,
    location:
      input.eventFormat === "online"
        ? {
            "@type": "VirtualLocation",
            url: input.canonicalUrl,
          }
        : {
            "@type": "Place",
            name: input.location?.name || [input.location?.addressLine, input.location?.city].filter(Boolean).join(", ") || input.location?.city || "Danmark",
            address: {
              "@type": "PostalAddress",
              streetAddress: input.location?.addressLine || undefined,
              postalCode: input.location?.postalCode || undefined,
              addressLocality: input.location?.city || input.location?.region || undefined,
              addressCountry: "DK",
            },
          },
    organizer: organizerItems.length === 1 ? organizerItems[0] : organizerItems,
    offers:
      input.priceCents === null || input.priceCents === undefined
        ? undefined
        : {
            "@type": "Offer",
            price: String(input.priceCents / 100),
            priceCurrency: "DKK",
            availability: input.isSoldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
            url: input.canonicalUrl,
          },
  };
}
