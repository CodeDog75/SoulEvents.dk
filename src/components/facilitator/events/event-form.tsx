"use client";

import Link from "next/link";
import NextImage from "next/image";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  ChevronDown,
  CreditCard,
  Eye,
  ImagePlus,
  Mail,
  MapPin,
  MonitorSmartphone,
  Plus,
  Save,
  Send,
  Tags,
  Ticket,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cancelCoOrganizerInvitationAction, createEventAction, resendCoOrganizerInvitationAction, searchCoOrganizerCandidatesAction } from "@/app/facilitator/events/actions";
import { sortTagsByDanishLabel } from "@/lib/events/tags";
import { imageUploadAccept, prepareImageFileForUpload, replaceInputFile, supportedImageUploadText } from "@/lib/images/client-image-upload";
import { fetchDanishPostalCity, getLocalDanishPostalCity } from "@/lib/locations/danish-postal-codes";

type Region = {
  id: string;
  name: string;
  slug?: string | null;
};

type Category = {
  id: string;
  name: string;
  colorHex?: string | null;
  imageUrl?: string | null;
};

type MainCategory = Category;
type Subcategory = Category & {
  mainCategoryIds?: string[];
};
type Tag = Category;

type CoverCropState = {
  cropX: number;
  cropY: number;
  file: File;
  fileName: string;
  naturalHeight: number;
  naturalWidth: number;
  url: string;
  zoom: number;
};

type DraftEvent = {
  id: string;
  status?: string | null;
  title?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  cover_image_path?: string | null;
  coverImageUrl?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  region_id?: string | null;
  price_cents?: number | null;
  payment_method_source?: "facilitator" | "custom" | "none" | null;
  payment_mobilepay_number?: string | null;
  payment_bank_registration_number?: string | null;
  payment_bank_account_number?: string | null;
  payment_bank_account_name?: string | null;
  payment_external_url?: string | null;
  payment_instructions?: string | null;
  payment_deadline_days?: number | null;
  capacity?: number | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  event_format?: "physical" | "online" | null;
  online_description?: string | null;
  online_url_or_note?: string | null;
  practical_information?: string | null;
  categoryIds?: string[];
  mainCategoryIds?: string[];
  subcategoryIds?: string[];
  tagIds?: string[];
  activeBookingCount?: number;
  coOrganizerInvitations?: CoOrganizerInvitation[];
};

type CoOrganizerInvitation = {
  categories?: string[];
  city?: string | null;
  id: string;
  imageUrl?: string | null;
  name: string;
  profileIsActive?: boolean;
  profileId: string;
  status: "accepted" | "declined" | "pending";
};

type CoOrganizerCandidate = {
  categories?: string[];
  city?: string | null;
  id: string;
  imageUrl?: string | null;
  name: string;
  specialties?: string | null;
};

type EventFormProps = {
  regions: Region[];
  categories: Category[];
  activeLimitMessage?: string | null;
  mainCategories?: MainCategory[];
  subcategories?: Subcategory[];
  tags?: Tag[];
  draftEvent?: DraftEvent | null;
  initialStep?: number;
  message?: string;
  prefill?: {
    date?: string | null;
    source?: string | null;
    title?: string | null;
  };
  requiresOrganizerAcceptance?: boolean;
  notificationLogs?: Array<{
    actorName?: string | null;
    createdAt: string;
    recipientCount: number;
  }>;
  facilitator: {
    id: string;
    contactEmail: string;
    contactPhone: string | null;
    regionId: string | null;
    addressLine: string | null;
    postalCode: string | null;
    city: string | null;
    maxTicketPricePerPerson: number | null;
    paymentMobilepayNumber?: string | null;
    paymentBankRegistrationNumber?: string | null;
    paymentBankAccountNumber?: string | null;
    paymentBankAccountName?: string | null;
    paymentExternalUrl?: string | null;
    paymentInstructions?: string | null;
    paymentDeadlineDays?: number | null;
  };
};

type Step = {
  icon: ReactNode;
  label: string;
  title: string;
};

type MissingInvitationItem = {
  focusSelector?: string;
  key: string;
  label: string;
  step: number;
  targetId: string;
};

function value(input: string | number | null | undefined) {
  return input === null || input === undefined ? "" : String(input);
}

function fieldStateClass(value: string, options: { auto?: boolean; error?: boolean } = {}) {
  if (options.error) return "border-[#D97A7A] bg-[#FFF3F3]";
  if (value.trim()) return "border-[#CFE3C8] bg-[#F6FBF3]";
  if (options.auto) return "border-[#CFE3C8] bg-[#F6FBF3]";
  return "border-midnight/15 bg-white";
}

function readableTextColor(hex: string) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "#2F2437";
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 160 ? "#2F2437" : "#FFFFFF";
}

function softTagColor(index: number) {
  const palette = ["#7A5D91", "#86A478", "#C0808F", "#6B7F9E", "#C9A66B", "#8C6F5B", "#6FA89C", "#A47FB5"];
  return palette[index % palette.length];
}

function MainCategoryCard({
  category,
  checked,
  priority = false,
  onChange,
}: {
  category: MainCategory;
  checked: boolean;
  priority?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const color = category.colorHex || "#7A5D91";
  const fallbackBackground = "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.76), transparent 42%), linear-gradient(135deg, " + color + "33, #F8F3FF)";

  return (
    <label
      className={
        "group relative min-h-[148px] cursor-pointer overflow-hidden rounded-[24px] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg " +
        (checked
          ? "-translate-y-0.5 border-[3px] border-[#7A5D91] opacity-100 shadow-[0_0_0_4px_rgba(122,93,145,0.15)]"
          : "border border-transparent opacity-100 shadow-soft")
      }
      style={{ background: fallbackBackground }}
    >
      <input
        checked={checked}
        className="sr-only"
        name="main_category_ids"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
        value={category.id}
      />
      {category.imageUrl ? (
        <>
          <NextImage
            alt=""
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            fill
            priority={priority}
            sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1023px) calc((100vw - 3rem) / 2), 320px"
            src={category.imageUrl}
          />
          <span className="absolute inset-0 bg-gradient-to-br from-[#2F2437]/50 to-[#7A5D91]/22" aria-hidden="true" />
        </>
      ) : null}
      {checked ? (
        <span className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-[#7A5D91] text-base font-bold text-white shadow-soft">
          {"✓"}
        </span>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 z-10 p-5">
        <span className={"block font-serif text-2xl font-semibold leading-tight " + (category.imageUrl ? "text-white" : "text-[#2F1437]")}>
          {category.name}
        </span>
      </span>
    </label>
  );
}

function TagPill({
  checked,
  onChange,
  tag,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  tag: Tag;
}) {
  return (
    <label
      className={
        "inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 " +
        (checked ? "border-[#7A5D91] bg-[#7A5D91] text-white" : "border-[#D8CBE4] bg-white text-[#6E6475]")
      }
    >
      <input
        checked={checked}
        className="sr-only"
        name="tag_ids"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
        value={tag.id}
      />
      {checked ? <span aria-hidden="true">{"✓"}</span> : null}
      {tag.name}
    </label>
  );
}

function CoOrganizerAvatar({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  return imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className="size-11 rounded-[14px] object-cover" src={imageUrl} />
  ) : (
    <span className="grid size-11 place-items-center rounded-[14px] bg-[#F4F0F7] text-sm font-semibold text-[#7A5D91]">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function coOrganizerStatusCopy(status: CoOrganizerInvitation["status"], profileIsActive?: boolean) {
  if (profileIsActive === false) {
    return {
      badgeClass: "border-[#E8D2CC] bg-[#FFF8F6] text-[#9A4F45]",
      description: "Profilen er ikke længere aktiv og skal fjernes, før eventet kan offentliggøres.",
      label: "Ikke aktiv",
    };
  }

  if (status === "accepted") {
    return {
      badgeClass: "border-[#BFD9B6] bg-[#F1F7ED] text-[#3F6838]",
      description: "Invitationen er bekræftet. Medarrangøren vises på eventet.",
      label: "Bekræftet",
    };
  }

  if (status === "declined") {
    return {
      badgeClass: "border-[#E8D2CC] bg-[#FFF8F6] text-[#9A4F45]",
      description: "Medarrangøren har sagt nej tak til invitationen.",
      label: "Afslået",
    };
  }

  return {
    badgeClass: "border-[#E7D59D] bg-[#FFF8DF] text-[#7A5A15]",
    description: "Invitationen er sendt og afventer bekræftelse.",
    label: "Afventer accept",
  };
}

function normalizeCoOrganizerSearchText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

const legacyEventDraftStorageKey = "soulevents:event-form-draft:v1";
const eventDraftStoragePrefix = "soulevents:event-form-draft:v2";
const maxEventDescriptionLength = 5000;
const maxEventTags = 4;
const onlineLinkLaterText = "Deltagerne modtager linket senere i invitationen";
const danishTimeZone = "Europe/Copenhagen";
const paymentDeadlineOptions = [
  { label: "3 dage efter bekræftelse", value: "3" },
  { label: "5 dage efter bekræftelse", value: "5" },
  { label: "14 dage efter bekræftelse", value: "14" },
  { label: "Senest på eventdagen", value: "60" },
];
const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const hour = String(Math.floor(index / 4)).padStart(2, "0");
  const minute = String((index % 4) * 15).padStart(2, "0");
  return `${hour}:${minute}`;
});

function normalizeTimeInputValue(timeValue: string | undefined) {
  const match = timeValue?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return "";
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return "";
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatLocalDateInputValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: danishTimeZone,
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const year = value("year");
  const month = value("month");
  const day = value("day");

  return `${year}-${month}-${day}`;
}

function formatLocalTimeInputValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: danishTimeZone,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hours = value("hour");
  const minutes = value("minute");

  return `${hours}:${minutes}`;
}


function getEventImageMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("billedet") || normalized.includes("eventbillede") || normalized.includes("forsidebillede")) {
    return message;
  }

  return "";
}

function normalizeTimeOption(timeValue: string | undefined, fallback: string) {
  return normalizeTimeInputValue(timeValue) || fallback;
}

function TimeSelect({
  label,
  name,
  defaultValue,
  required,
  value: selectedValue,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const currentValue = normalizeTimeOption(selectedValue, defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement | null>(null);
  const options = timeOptions.includes(currentValue)
    ? timeOptions
    : [...timeOptions, currentValue].sort((first, second) => first.localeCompare(second));

  function handleSelect(nextValue: string) {
    onChange?.(nextValue);
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const selectedOption = optionsRef.current?.querySelector<HTMLElement>("[data-selected='true']");
    selectedOption?.scrollIntoView({ block: "center" });
  }, [currentValue, isOpen]);

  return (
    <div className="grid gap-2 text-sm font-medium text-ink/72">
      <span>
        {label}
        {required ? <span className="ml-1 text-[#B56F8A]">*</span> : null}
      </span>
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsOpen(false);
          }
        }}
      >
        <input name={name} type="hidden" value={currentValue} />
        <button
          aria-expanded={isOpen}
          className={"h-12 w-full min-w-0 cursor-pointer appearance-none rounded-card border py-0 pl-4 pr-11 text-left text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none " + fieldStateClass(currentValue)}
          onClick={() => setIsOpen((open) => !open)}
          type="button"
        >
          {currentValue}
        </button>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-midnight/70" aria-hidden="true" />
        {isOpen ? (
          <div
            className="absolute left-0 top-full z-30 mt-2 max-h-64 w-full overflow-auto rounded-card border border-[#E6D8F0] bg-white py-2 shadow-soft"
            ref={optionsRef}
          >
            {options.map((timeOption) => (
              <button
                aria-selected={timeOption === currentValue}
                className={
                  "block w-full px-4 py-2 text-left text-base transition hover:bg-[#F4EEF8] " +
                  (timeOption === currentValue ? "bg-[#F4EEF8] font-semibold text-[#6E5285]" : "text-ink")
                }
                key={timeOption}
                data-selected={timeOption === currentValue ? "true" : undefined}
                onClick={() => handleSelect(timeOption)}
                onMouseDown={(event) => event.preventDefault()}
                role="option"
                type="button"
              >
                {timeOption}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function regionSlugFromPostalCode(postalCode: string) {
  const numberValue = Number(postalCode);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  if (numberValue >= 3700 && numberValue <= 3799) {
    return "bornholm";
  }

  if (numberValue >= 1000 && numberValue <= 2999) {
    return "storkobenhavn";
  }

  if (numberValue >= 3000 && numberValue <= 3699) {
    return "nordsjaelland";
  }

  if (numberValue >= 4000 && numberValue <= 4199) {
    return "midtsjaelland";
  }

  if (numberValue >= 4200 && numberValue <= 4699) {
    return "vestsjaelland";
  }

  if (numberValue >= 4700 && numberValue <= 4999) {
    return "sydsjaelland";
  }

  if (numberValue >= 5000 && numberValue <= 5999) {
    return "fyn";
  }

  if (numberValue >= 6000 && numberValue <= 6999) {
    return "sonderjylland";
  }

  if (numberValue >= 7000 && numberValue <= 8999) {
    return "midtjylland";
  }

  if (numberValue >= 9000 && numberValue <= 9999) {
    return "nordjylland";
  }

  return "";
}

function isValidHttpUrl(input: string) {
  if (input.trim() === onlineLinkLaterText) {
    return true;
  }

  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function TextInput({
  label,
  name,
  required,
  defaultValue,
  type = "text",
  placeholder,
  help,
  maxLength,
  max,
  min,
  step,
  autoFocus,
  highlightWhenEmpty,
  id,
  onValueChange,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  help?: string;
  maxLength?: number;
  max?: number;
  min?: number;
  step?: string;
  autoFocus?: boolean;
  highlightWhenEmpty?: boolean;
  id?: string;
  onValueChange?: (value: string) => void;
}) {
  const [inputCharacterCount, setInputCharacterCount] = useState(defaultValue?.length ?? 0);
  const [inputValue, setInputValue] = useState(defaultValue ?? "");
  const emptyHighlightClass =
    highlightWhenEmpty && !inputValue.trim()
      ? "border-[#D89A94] bg-[#FFF8F6] shadow-[0_0_0_4px_rgba(216,154,148,0.18)]"
      : fieldStateClass(inputValue);

  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-ink/72">
      <span>
        {label}
        {required ? <span className="ml-1 text-[#B56F8A]">*</span> : null}
      </span>
      <input
        autoComplete="off"
        autoFocus={autoFocus}
        className={"h-12 w-full min-w-0 rounded-card border px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA] " + emptyHighlightClass}
        defaultValue={defaultValue}
        id={id}
        max={max}
        maxLength={maxLength}
        min={min}
        name={name}
        onInput={(event) => {
          const nextValue = event.currentTarget.value;
          setInputCharacterCount(nextValue.length);
          setInputValue(nextValue);
          onValueChange?.(nextValue);
        }}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
      />
      {help ? <span className="text-xs leading-5 text-ink/52">{help}</span> : null}
      {maxLength ? (
        <span className="text-xs font-semibold text-[#7A4EAB]">
          {inputCharacterCount} / {maxLength} tegn
        </span>
      ) : null}
    </label>
  );
}

function TextArea({
  label,
  name,
  placeholder,
  required,
  defaultValue,
  minHeight = "min-h-28",
  help,
  maxLength,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  minHeight?: string;
  help?: string;
  maxLength?: number;
}) {
  const [characterCount, setCharacterCount] = useState(defaultValue?.length ?? 0);
  const [textValue, setTextValue] = useState(defaultValue ?? "");
  const remainingCharacters = typeof maxLength === "number" ? maxLength - characterCount : null;
  const isAtLimit = remainingCharacters !== null && remainingCharacters <= 0;

  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-ink/72">
      <span>
        {label}
        {required ? <span className="ml-1 text-[#B56F8A]">*</span> : null}
      </span>
      <textarea
        autoComplete="off"
        className={minHeight + " w-full min-w-0 rounded-card border p-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA] " + fieldStateClass(textValue)}
        defaultValue={defaultValue}
        maxLength={maxLength}
        name={name}
        onInput={(event) => {
          setCharacterCount(event.currentTarget.value.length);
          setTextValue(event.currentTarget.value);
        }}
        placeholder={placeholder}
        required={required}
      />
      {help ? <span className="text-xs leading-5 text-ink/52">{help}</span> : null}
      {typeof maxLength === "number" ? (
        <span className={isAtLimit ? "text-xs font-semibold text-[#9A3F3F]" : "text-xs font-semibold text-[#7A4EAB]"}>
          {characterCount} / {maxLength} tegn
        </span>
      ) : null}
    </label>
  );
}

function EventDescriptionField({ defaultValue = "" }: { defaultValue?: string }) {
  const [characterCount, setCharacterCount] = useState(defaultValue.length);
  const [descriptionValue, setDescriptionValue] = useState(defaultValue);
  const remainingCharacters = maxEventDescriptionLength - characterCount;
  const minimumCharacters = 20;
  const missingMinimumCharacters = Math.max(minimumCharacters - characterCount, 0);
  const isAtLimit = remainingCharacters <= 0;
  const hasMinimumCharacters = missingMinimumCharacters === 0;

  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-ink/72">
      <span>
        Hvad skal deltagerne opleve?<span className="ml-1 text-[#B56F8A]">*</span>
      </span>
      <textarea
        autoComplete="off"
        className={"min-h-40 w-full min-w-0 rounded-card border p-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA] " + fieldStateClass(descriptionValue)}
        maxLength={maxEventDescriptionLength}
        defaultValue={defaultValue}
        id="event-description-input"
        name="event_description"
        onInput={(event) => {
          setCharacterCount(event.currentTarget.value.length);
          setDescriptionValue(event.currentTarget.value);
        }}
        placeholder="Beskriv med dine egne ord, hvad der skal ske, hvem oplevelsen er for, og hvad deltagerne kan forvente."
        required
      />
      <span className="text-xs leading-5 text-ink/52">
        Fortæl kort, hvad der skal ske, hvem eventet er for, og hvad deltagerne kan forvente. Minimum {minimumCharacters} tegn.
      </span>
      <span
        className={
          isAtLimit
            ? "text-xs font-semibold text-[#9A3F3F]"
            : hasMinimumCharacters
              ? "text-xs font-semibold text-[#7A4EAB]"
              : "text-xs font-semibold text-[#B56F8A]"
        }
      >
        {hasMinimumCharacters
          ? remainingCharacters + " tegn tilbage"
          : "Mangler " + missingMinimumCharacters + " tegn før beskrivelsen er lang nok"}
      </span>
    </label>
  );
}

function CheckboxPill({
  checked,
  label,
  name,
  onChange,
  value,
}: {
  checked?: boolean;
  label: string;
  name: string;
  onChange?: (checked: boolean) => void;
  value: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-card border border-[#E5D4F7] bg-white p-3 text-sm font-medium text-ink/75 shadow-soft transition hover:border-[#7A4EAB]/40 hover:bg-[#F6EFFF]">
      <input
        {...(onChange
          ? {
              checked,
              onChange: (event) => onChange(event.target.checked),
            }
          : {
              defaultChecked: checked,
            })}
        className="size-4 accent-[#7A4EAB]"
        name={name}
        type="checkbox"
        value={value}
      />
      {label}
    </label>
  );
}

export function EventForm({
  regions,
  activeLimitMessage,
  mainCategories = [],
  subcategories = [],
  tags = [],
  draftEvent = null,
  initialStep = 0,
  message,
  prefill,
  requiresOrganizerAcceptance = false,
  notificationLogs = [],
  facilitator,
}: EventFormProps) {
  const todayDate = new Date();
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(todayDate.getDate() + 1);
  const today = formatLocalDateInputValue(todayDate);
  const tomorrow = formatLocalDateInputValue(tomorrowDate);
  const draftStart = draftEvent?.starts_at ? new Date(draftEvent.starts_at) : null;
  const draftEnd = draftEvent?.ends_at ? new Date(draftEvent.ends_at) : null;
  const prefillDate = !draftEvent && prefill?.date && /^\d{4}-\d{2}-\d{2}$/.test(prefill.date) ? prefill.date : null;
  const prefillTitle = !draftEvent ? value(prefill?.title).slice(0, 120) : "";
  const shouldUsePrefillAsSource = !draftEvent && prefill?.source === "year-rhythm" && Boolean(prefillDate || prefillTitle);
  const draftStartDate = draftStart ? formatLocalDateInputValue(draftStart) : prefillDate ?? tomorrow;
  const draftEndDate = draftEnd ? formatLocalDateInputValue(draftEnd) : draftStartDate;
  const draftStartTime = draftStart ? formatLocalTimeInputValue(draftStart) : "19:00";
  const draftEndTime = draftEnd ? formatLocalTimeInputValue(draftEnd) : "21:00";
  const formRef = useRef<HTMLFormElement | null>(null);
  const initialFormSignatureRef = useRef<string | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const cropDragRef = useRef<{
    cropX: number;
    cropY: number;
    height: number;
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
  } | null>(null);
  const cropPinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const [currentStep, setCurrentStep] = useState(() => Math.min(Math.max(initialStep, 0), 4));
  const [openStepIndexes, setOpenStepIndexes] = useState<number[]>(() => [Math.min(Math.max(initialStep, 0), 3)]);
  const [startDate, setStartDate] = useState(draftStartDate);
  const [endDate, setEndDate] = useState(draftEndDate);
  const [startTime, setStartTime] = useState(draftStartTime);
  const [endTime, setEndTime] = useState(draftEndTime);
  const [showEndDateTime, setShowEndDateTime] = useState(Boolean(draftEvent?.ends_at && (draftEndDate !== draftStartDate || draftEndTime !== draftStartTime)));
  const [postalCode, setPostalCode] = useState(value(draftEvent?.postal_code ?? facilitator.postalCode));
  const [city, setCity] = useState(value(draftEvent?.city ?? facilitator.city));
  const [country, setCountry] = useState(value(draftEvent?.country ?? "Danmark") || "Danmark");
  const [isForeignLocation, setIsForeignLocation] = useState(() => {
    const initialCountry = value(draftEvent?.country);
    return Boolean(initialCountry && initialCountry.trim().toLowerCase() !== "danmark");
  });
  const [regionId, setRegionId] = useState(value(draftEvent?.region_id ?? facilitator.regionId));
  const [postalCodeMessage, setPostalCodeMessage] = useState("");
  const [eventFormat, setEventFormat] = useState<"physical" | "online">(draftEvent?.event_format === "online" ? "online" : "physical");
  const [hasChosenEventFormat, setHasChosenEventFormat] = useState(Boolean(draftEvent?.event_format));
  const [sendOnlineLinkLater, setSendOnlineLinkLater] = useState(draftEvent?.online_url_or_note === onlineLinkLaterText);
  const [priceMode, setPriceMode] = useState<"" | "free" | "paid">(
    draftEvent ? ((draftEvent.price_cents ?? 0) > 0 ? "paid" : "free") : "",
  );
  const [isFree, setIsFree] = useState((draftEvent?.price_cents ?? 0) === 0);
  const hasCustomPaymentSettings = draftEvent?.payment_method_source === "custom";
  const standardPaymentMobilepayNumber = value(facilitator.paymentMobilepayNumber);
  const standardPaymentBankRegistrationNumber = value(facilitator.paymentBankRegistrationNumber);
  const standardPaymentBankAccountNumber = value(facilitator.paymentBankAccountNumber);
  const standardPaymentBankAccountName = value(facilitator.paymentBankAccountName);
  const standardPaymentExternalUrl = value(facilitator.paymentExternalUrl);
  const standardPaymentInstructions = value(facilitator.paymentInstructions);
  const standardPaymentDeadlineDays = value(facilitator.paymentDeadlineDays ?? 14);
  const hasStandardPaymentSettings = Boolean(
    standardPaymentMobilepayNumber.trim() ||
      standardPaymentBankRegistrationNumber.trim() ||
      standardPaymentBankAccountNumber.trim() ||
      standardPaymentExternalUrl.trim() ||
      standardPaymentInstructions.trim(),
  );
  const initialPaymentMobilepayNumber = hasCustomPaymentSettings ? value(draftEvent?.payment_mobilepay_number) : standardPaymentMobilepayNumber;
  const initialPaymentBankRegistrationNumber = hasCustomPaymentSettings
    ? value(draftEvent?.payment_bank_registration_number)
    : standardPaymentBankRegistrationNumber;
  const initialPaymentBankAccountNumber = hasCustomPaymentSettings ? value(draftEvent?.payment_bank_account_number) : standardPaymentBankAccountNumber;
  const initialPaymentBankAccountName = hasCustomPaymentSettings ? value(draftEvent?.payment_bank_account_name) : standardPaymentBankAccountName;
  const initialPaymentExternalUrl = hasCustomPaymentSettings ? value(draftEvent?.payment_external_url) : standardPaymentExternalUrl;
  const initialPaymentInstructions = hasCustomPaymentSettings ? value(draftEvent?.payment_instructions) : standardPaymentInstructions;
  const initialPaymentDeadlineDays = hasCustomPaymentSettings
    ? value(draftEvent?.payment_deadline_days ?? facilitator.paymentDeadlineDays ?? 14)
    : standardPaymentDeadlineDays;
  const initialPaymentFieldsEdited = hasCustomPaymentSettings;
  const [sendPaymentInfo, setSendPaymentInfo] = useState(draftEvent?.payment_method_source !== "none");
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [paymentFieldsEdited, setPaymentFieldsEdited] = useState(initialPaymentFieldsEdited);
  const [paymentMobilepayNumber, setPaymentMobilepayNumber] = useState(initialPaymentMobilepayNumber);
  const [paymentBankRegistrationNumber, setPaymentBankRegistrationNumber] = useState(initialPaymentBankRegistrationNumber);
  const [paymentBankAccountNumber, setPaymentBankAccountNumber] = useState(initialPaymentBankAccountNumber);
  const [paymentBankAccountName, setPaymentBankAccountName] = useState(initialPaymentBankAccountName);
  const [paymentExternalUrl, setPaymentExternalUrl] = useState(initialPaymentExternalUrl);
  const [paymentInstructions, setPaymentInstructions] = useState(initialPaymentInstructions);
  const [paymentDeadlineDays, setPaymentDeadlineDays] = useState(initialPaymentDeadlineDays);
  const [selectedMainCategoryIds, setSelectedMainCategoryIds] = useState<string[]>(draftEvent?.mainCategoryIds ?? []);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>((draftEvent?.tagIds ?? []).slice(0, maxEventTags));
  const sortedTags = useMemo(() => sortTagsByDanishLabel(tags), [tags]);
  const [categoryLimitMessage, setCategoryLimitMessage] = useState("");
  const [capacityValue, setCapacityValue] = useState(String(draftEvent?.capacity ?? 12));
  const [highlightedMissingKey, setHighlightedMissingKey] = useState("");
  const initialPriceValue = String((draftEvent?.price_cents ?? 0) / 100);
  const [priceValue, setPriceValue] = useState(initialPriceValue);
  const [preview, setPreview] = useState<{
    title: string;
    description: string;
    format: string;
    price: string;
    date: string;
    time: string;
    location: string;
    capacity: string;
    categories: string[];
    tags: string[];
    coverImageUrl: string;
  } | null>(null);
  const [hasAutosavedDraft, setHasAutosavedDraft] = useState(false);
  const [autosaveMessage, setAutosaveMessage] = useState("");
  const [coverImageErrorMessage, setCoverImageErrorMessage] = useState("");
  const [coverFileName, setCoverFileName] = useState("");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [coverCrop, setCoverCrop] = useState<CoverCropState | null>(null);
  const [showParticipantNotificationDialog, setShowParticipantNotificationDialog] = useState(false);
  const [pendingSubmitStatus, setPendingSubmitStatus] = useState("");
  const [isSavingWithoutEmail, setIsSavingWithoutEmail] = useState(false);
  const [isSavingAndSending, setIsSavingAndSending] = useState(false);
  const [acceptedOrganizerTerms, setAcceptedOrganizerTerms] = useState(false);
  const [, setFormVersion] = useState(0);
  const showAddress = hasChosenEventFormat && eventFormat === "physical";
  const showOnline = hasChosenEventFormat && eventFormat === "online";
  const isDanishPhysicalEvent = showAddress && !isForeignLocation;
  const selectedRegionName = regions.find((region) => region.id === regionId)?.name ?? "";
  const currentCoverImageUrl = coverPreviewUrl || draftEvent?.coverImageUrl || "";
  const [titleValue, setTitleValue] = useState(value(draftEvent?.title) || prefillTitle);
  const [coOrganizerSearchOpen, setCoOrganizerSearchOpen] = useState(false);
  const [coOrganizerSearchQuery, setCoOrganizerSearchQuery] = useState("");
  const [coOrganizerCandidates, setCoOrganizerCandidates] = useState<CoOrganizerCandidate[]>([]);
  const [coOrganizerExistingMatches, setCoOrganizerExistingMatches] = useState<CoOrganizerInvitation[]>([]);
  const [selectedCoOrganizers, setSelectedCoOrganizers] = useState<CoOrganizerCandidate[]>([]);
  const [coOrganizerSearchMessage, setCoOrganizerSearchMessage] = useState("");
  const [isSearchingCoOrganizers, startCoOrganizerSearch] = useTransition();
  const [isUpdatingCoOrganizerInvitation, startCoOrganizerInvitationUpdate] = useTransition();
  const titleBoxStateClass = titleValue.trim()
    ? "border-[#CFE3C8] bg-[#F6FBF3]"
    : "border-[#F0D6D2] bg-[#FFF8F6]";
  const hasCoverImage = Boolean(currentCoverImageUrl || draftEvent?.cover_image_path || coverFileName);
  const draftEventStatus = draftEvent?.status ?? null;
  const isEditingPublishedEvent = draftEventStatus === "active" || draftEventStatus === "sold_out";
  const activeBookingCount = draftEvent?.activeBookingCount ?? 0;
  const isSubmittingEventUpdate = isSavingWithoutEmail || isSavingAndSending;
  const primarySubmitStatus = isEditingPublishedEvent && draftEventStatus ? draftEventStatus : "active";
  const userDraftStorageKey = `${eventDraftStoragePrefix}:${facilitator.id}`;
  const draftStorageKey = draftEvent?.id ? `${userDraftStorageKey}:event:${draftEvent.id}` : `${userDraftStorageKey}:new`;
  const paymentFieldsDifferFromStandard =
    paymentMobilepayNumber.trim() !== standardPaymentMobilepayNumber.trim() ||
    paymentBankRegistrationNumber.trim() !== standardPaymentBankRegistrationNumber.trim() ||
    paymentBankAccountNumber.trim() !== standardPaymentBankAccountNumber.trim() ||
    paymentBankAccountName.trim() !== standardPaymentBankAccountName.trim() ||
    paymentExternalUrl.trim() !== standardPaymentExternalUrl.trim() ||
    paymentInstructions.trim() !== standardPaymentInstructions.trim() ||
    paymentDeadlineDays.trim() !== standardPaymentDeadlineDays.trim();
  const effectivePaymentMethodSource = priceMode === "paid" ? (sendPaymentInfo ? "custom" : "none") : "facilitator";
  const statusHelp = useMemo(
    () =>
      "Når du gør eventet offentligt, bliver det synligt med det samme, hvis din arrangørprofil er godkendt og eventet er klar.",
    [],
  );
  const existingCoOrganizers = draftEvent?.coOrganizerInvitations ?? [];
  const activeExistingCoOrganizers = existingCoOrganizers.filter((coOrganizer) => coOrganizer.status === "pending" || coOrganizer.status === "accepted");
  const inactiveExistingCoOrganizers = activeExistingCoOrganizers.filter((coOrganizer) => coOrganizer.profileIsActive === false);
  const activeCoOrganizerCount = activeExistingCoOrganizers.length + selectedCoOrganizers.length;
  const coOrganizerSearchNeedle = normalizeCoOrganizerSearchText(coOrganizerSearchQuery);
  const localMatchingExistingCoOrganizers =
    coOrganizerSearchNeedle.length >= 2
      ? existingCoOrganizers.filter((coOrganizer) =>
          normalizeCoOrganizerSearchText([coOrganizer.name, coOrganizer.city, ...(coOrganizer.categories ?? [])].filter(Boolean).join(" ")).includes(
            coOrganizerSearchNeedle,
          ),
        )
      : [];
  const matchingExistingCoOrganizers = [
    ...localMatchingExistingCoOrganizers,
    ...coOrganizerExistingMatches.filter(
      (remoteMatch) => !localMatchingExistingCoOrganizers.some((localMatch) => localMatch.id === remoteMatch.id),
    ),
  ];
  const canAddCoOrganizer = activeCoOrganizerCount < 2;
  const organizerAcceptanceMessage =
    message && (message.toLowerCase().includes("arrangørvilkår") || message.toLowerCase().includes("retningslinjer"))
      ? message
      : "";

  const durationLabel = useMemo(() => {
    const start = new Date(startDate + "T" + startTime + ":00");
    const effectiveEndDate = showEndDateTime ? endDate : startDate;
    const end = new Date(effectiveEndDate + "T" + endTime + ":00");
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return "Vælg en slutdato og et sluttidspunkt efter starttidspunktet.";
    }

    const days = Math.floor(durationMinutes / 1440);
    const hours = Math.floor((durationMinutes % 1440) / 60);
    const minutes = durationMinutes % 60;
    const parts: string[] = [];

    if (days > 0) {
      parts.push(days + (days === 1 ? " dag" : " dage"));
    }

    if (hours > 0) {
      parts.push(hours + (hours === 1 ? " time" : " timer"));
    }

    if (minutes > 0) {
      parts.push(minutes + " minutter");
    }

    return "Varighed: " + parts.join(" og ");
  }, [endDate, endTime, showEndDateTime, startDate, startTime]);

  const steps: Step[] = [
    { icon: <CalendarPlus className="size-4" />, label: "Invitation", title: "Hvad vil du invitere til?" },
    { icon: <MapPin className="size-4" />, label: "Sted", title: "Hvor foregår oplevelsen?" },
    { icon: <Ticket className="size-4" />, label: "Pris", title: "Pris & antal deltagere" },
    { icon: <Tags className="size-4" />, label: "Findbarhed", title: "Vælg 1-3 kategorier, som bedst beskriver dit event." },
  ];

  const stepDescriptions = [
    "Giv eventet et navn, beskriv oplevelsen og vælg tidspunkt.",
    "Vælg om eventet foregår fysisk eller online.",
    "Tilføj pris, antal deltagere og eventuelle praktiske oplysninger.",
    "Vælg brede hovedkategorier og eventuelle tags.",
  ];
  const [missingInvitationItems, setMissingInvitationItems] = useState<MissingInvitationItem[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Array<"complete" | "missing">>(() =>
    steps.map(() => "missing"),
  );


  function loadImageDimensions(url: string) {
    return new Promise<{ height: number; width: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth });
      image.onerror = reject;
      image.src = url;
    });
  }

  function loadImage(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function setCoverInputFile(file: File) {
    const input = coverFileInputRef.current;

    if (!input) {
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  }

  function getCoverCropArea(crop: CoverCropState) {
    const targetRatio = 16 / 9;
    let sourceWidth = crop.naturalWidth;
    let sourceHeight = sourceWidth / targetRatio;

    if (sourceHeight > crop.naturalHeight) {
      sourceHeight = crop.naturalHeight;
      sourceWidth = sourceHeight * targetRatio;
    }

    sourceWidth = sourceWidth / crop.zoom;
    sourceHeight = sourceHeight / crop.zoom;

    const maxX = Math.max(crop.naturalWidth - sourceWidth, 0);
    const maxY = Math.max(crop.naturalHeight - sourceHeight, 0);

    return {
      sourceHeight,
      sourceWidth,
      sourceX: maxX * (crop.cropX / 100),
      sourceY: maxY * (crop.cropY / 100),
    };
  }

  function getCoverCropPreview(crop: CoverCropState) {
    const area = getCoverCropArea(crop);
    const scale = 1600 / area.sourceWidth;

    return {
      height: crop.naturalHeight * scale,
      width: crop.naturalWidth * scale,
      x: -area.sourceX * scale,
      y: -area.sourceY * scale,
    };
  }

  function updateCoverCropZoom(direction: "in" | "out") {
    setCoverCrop((current) => {
      if (!current) return current;
      const nextZoom = direction === "in" ? current.zoom + 0.15 : current.zoom - 0.15;
      return { ...current, zoom: Math.min(Math.max(nextZoom, 1), 3) };
    });
  }

  function startCoverCropDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!coverCrop) return;

    const rect = event.currentTarget.getBoundingClientRect();
    cropDragRef.current = {
      cropX: coverCrop.cropX,
      cropY: coverCrop.cropY,
      height: rect.height,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveCoverCrop(event: React.PointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const nextCropX = Math.min(Math.max(drag.cropX - (deltaX / drag.width) * 100, 0), 100);
    const nextCropY = Math.min(Math.max(drag.cropY - (deltaY / drag.height) * 100, 0), 100);

    setCoverCrop((current) => (current ? { ...current, cropX: nextCropX, cropY: nextCropY } : current));
  }

  function stopCoverCropDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (cropDragRef.current?.pointerId === event.pointerId) {
      cropDragRef.current = null;
    }
  }

  function getTouchDistance(touches: React.TouchList) {
    const firstTouch = touches[0];
    const secondTouch = touches[1];

    if (!firstTouch || !secondTouch) {
      return 0;
    }

    return Math.hypot(firstTouch.clientX - secondTouch.clientX, firstTouch.clientY - secondTouch.clientY);
  }

  function startCoverCropPinch(event: React.TouchEvent<HTMLDivElement>) {
    if (!coverCrop || event.touches.length !== 2) {
      cropPinchRef.current = null;
      return;
    }

    cropPinchRef.current = { distance: getTouchDistance(event.touches), zoom: coverCrop.zoom };
  }

  function moveCoverCropPinch(event: React.TouchEvent<HTMLDivElement>) {
    const pinch = cropPinchRef.current;

    if (!pinch || event.touches.length !== 2 || pinch.distance <= 0) {
      return;
    }

    event.preventDefault();
    const nextDistance = getTouchDistance(event.touches);
    const nextZoom = Math.min(Math.max(pinch.zoom * (nextDistance / pinch.distance), 1), 3);
    setCoverCrop((current) => (current ? { ...current, zoom: nextZoom } : current));
  }

  function stopCoverCropPinch() {
    cropPinchRef.current = null;
  }

  function closeCoverCrop() {
    if (coverCrop?.url) {
      URL.revokeObjectURL(coverCrop.url);
    }

    setCoverCrop(null);
  }

  async function applyCoverCrop() {
    if (!coverCrop) {
      return;
    }

    const image = await loadImage(coverCrop.url);
    const { sourceHeight, sourceWidth, sourceX, sourceY } = getCoverCropArea(coverCrop);
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const context = canvas.getContext("2d");

    if (!context) {
      setCoverImageErrorMessage("Billedet kunne ikke tilpasses. Prøv et andet billede.");
      return;
    }

    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));

    if (!blob) {
      setCoverImageErrorMessage("Billedet kunne ikke gemmes efter tilpasning. Prøv et andet billede.");
      return;
    }

    const croppedFileName = coverCrop.fileName.replace(/\.[^.]+$/, "") + "-forside.jpg";
    const croppedFile = new File([blob], croppedFileName, { type: "image/jpeg" });
    const nextPreviewUrl = URL.createObjectURL(croppedFile);

    setCoverInputFile(croppedFile);
    setCoverFileName(croppedFileName);
    setCoverPreviewUrl(nextPreviewUrl);
    closeCoverCrop();
  }

  function formatReviewDate(dateValue: string) {
    if (!dateValue) {
      return "Dato mangler";
    }

    const [year, month, day] = dateValue.split("-");
    return [day, month, year].filter(Boolean).join(".");
  }

  async function handleCoverFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    let file = input.files?.[0];

    if (!file) {
      setCoverFileName("");
      setCoverPreviewUrl("");
      setPreview((currentPreview) => (currentPreview ? { ...currentPreview, coverImageUrl: "" } : currentPreview));
      return;
    }

    try {
      if (file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif")) {
        setCoverImageErrorMessage("Konverterer HEIC til JPG...");
      }

      file = await prepareImageFileForUpload(file);
      replaceInputFile(input, file);
    } catch (error) {
      input.value = "";
      setCoverFileName("");
      setCoverPreviewUrl("");
      setPreview((currentPreview) => (currentPreview ? { ...currentPreview, coverImageUrl: "" } : currentPreview));
      setCoverImageErrorMessage(error instanceof Error ? error.message : "Billedet kunne ikke klargøres til upload.");
      return;
    }

    const imageUrl = URL.createObjectURL(file);

    try {
      const dimensions = await loadImageDimensions(imageUrl);
      const aspectRatio = dimensions.width / dimensions.height;
      const expectedRatio = 16 / 9;

      setCoverFileName(file.name);
      setCoverImageErrorMessage("");

      if (Math.abs(aspectRatio - expectedRatio) <= 0.04) {
        setCoverPreviewUrl(imageUrl);
        setPreview((currentPreview) => (currentPreview ? { ...currentPreview, coverImageUrl: imageUrl } : currentPreview));
        setCoverCrop(null);
        return;
      }

      setCoverPreviewUrl("");
      setCoverCrop({
        cropX: 50,
        cropY: 50,
        file,
        fileName: file.name,
        naturalHeight: dimensions.height,
        naturalWidth: dimensions.width,
        url: imageUrl,
        zoom: 1,
      });
    } catch {
      URL.revokeObjectURL(imageUrl);
      input.value = "";
      setCoverFileName("");
      setCoverPreviewUrl("");
      setPreview((currentPreview) => (currentPreview ? { ...currentPreview, coverImageUrl: "" } : currentPreview));
      setCoverImageErrorMessage("Billedet kunne ikke læses. Prøv et andet billede.");
    }
  }

  async function reopenCoverCropTool() {
    let file = coverFileInputRef.current?.files?.[0] ?? null;
    let imageUrl = "";

    try {
      if (!file && currentCoverImageUrl) {
        const response = await fetch(currentCoverImageUrl);
        const blob = await response.blob();
        const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
        file = new File([blob], "forsidebillede." + extension, { type: blob.type || "image/jpeg" });
      }

      if (!file) {
        setCoverImageErrorMessage("Vælg et billede, før du tilpasser udsnittet.");
        return;
      }

      imageUrl = URL.createObjectURL(file);
      const dimensions = await loadImageDimensions(imageUrl);

      setCoverFileName(file.name);
      setCoverImageErrorMessage("");
      setCoverCrop({
        cropX: 50,
        cropY: 50,
        file,
        fileName: file.name,
        naturalHeight: dimensions.height,
        naturalWidth: dimensions.width,
        url: imageUrl,
        zoom: 1,
      });
    } catch {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }

      setCoverImageErrorMessage("Billedet kunne ikke åbnes til beskæring. Vælg eventuelt et nyt billede.");
    }
  }

  function handlePriceChange(nextValue: string) {
    const normalizedValue = nextValue.replace(/\D/g, "").slice(0, 5);
    setPriceValue(normalizedValue);
    const numericValue = Number(normalizedValue || "0");

    if (Number.isFinite(numericValue) && numericValue > 0) {
      setPriceMode("paid");
      setIsFree(false);
    }
  }

  function handleFreeChange(checked: boolean) {
    setIsFree(checked);

    if (checked) {
      setPriceMode("free");
      setPriceValue("0");
    }
  }

  function updateStartDate(nextDate: string) {
    setStartDate(nextDate);
    setEndDate((currentEndDate) => (currentEndDate && currentEndDate >= nextDate ? currentEndDate : nextDate));
  }

  function searchCoOrganizers(nextQuery: string) {
    setCoOrganizerSearchQuery(nextQuery);
    setCoOrganizerSearchMessage("");

    if (nextQuery.trim().length < 2) {
      setCoOrganizerCandidates([]);
      setCoOrganizerExistingMatches([]);
      return;
    }

    startCoOrganizerSearch(async () => {
      const existingProfileIds = new Set([
        ...activeExistingCoOrganizers.map((coOrganizer) => coOrganizer.profileId),
        ...selectedCoOrganizers.map((coOrganizer) => coOrganizer.id),
      ]);
      const searchResult = await searchCoOrganizerCandidatesAction(nextQuery, draftEvent?.id ?? null);
      const results = Array.isArray(searchResult) ? searchResult : searchResult.candidates;
      const remoteExistingMatches = Array.isArray(searchResult) ? [] : searchResult.existingMatches;
      const filteredResults = results.filter((candidate) => !existingProfileIds.has(candidate.id));
      setCoOrganizerCandidates(filteredResults);
      setCoOrganizerExistingMatches(remoteExistingMatches);
      const existingMatchFound = existingCoOrganizers.some((coOrganizer) =>
        normalizeCoOrganizerSearchText([coOrganizer.name, coOrganizer.city, ...(coOrganizer.categories ?? [])].filter(Boolean).join(" ")).includes(
          normalizeCoOrganizerSearchText(nextQuery),
        ),
      );
      setCoOrganizerSearchMessage(
        filteredResults.length === 0 && !existingMatchFound && remoteExistingMatches.length === 0
          ? "Ingen aktive og fuldførte arrangørprofiler matcher din søgning."
          : "",
      );
    });
  }

  function addCoOrganizer(candidate: CoOrganizerCandidate) {
    if (!canAddCoOrganizer) {
      setCoOrganizerSearchMessage("Du kan højst invitere to medarrangører.");
      return;
    }

    setSelectedCoOrganizers((current) => {
      if (current.some((item) => item.id === candidate.id)) {
        return current;
      }

      return [...current, candidate].slice(0, 2 - existingCoOrganizers.length);
    });
    setCoOrganizerSearchQuery("");
    setCoOrganizerCandidates([]);
    setCoOrganizerSearchMessage("Medarrangøren inviteres, når eventet gemmes.");
  }

  function removeSelectedCoOrganizer(candidateId: string) {
    setSelectedCoOrganizers((current) => current.filter((candidate) => candidate.id !== candidateId));
  }

  function runCoOrganizerInvitationAction(action: (formData: FormData) => Promise<void>, invitationId: string) {
    if (!draftEvent?.id) {
      setCoOrganizerSearchMessage("Medarrangøren kunne ikke opdateres.");
      return;
    }

    const formData = new FormData();
    formData.set("event_id", draftEvent.id);
    formData.set("invitation_id", invitationId);
    startCoOrganizerInvitationUpdate(() => {
      void action(formData);
    });
  }

  function setRegionFromPostalCode(nextPostalCode: string) {
    const regionSlug = regionSlugFromPostalCode(nextPostalCode);

    if (!regionSlug) {
      setRegionId("");
      return;
    }

    const matchingRegion = regions.find((region) => region.slug === regionSlug);

    if (matchingRegion) {
      setRegionId(matchingRegion.id);
    } else {
      setRegionId("");
    }
  }

  async function fetchPostalCodeCity(nextPostalCode: string) {
    const result = await fetchDanishPostalCity(nextPostalCode);

    if (result.ok) {
      setCity(result.city);
      setPostalCodeMessage("By er opdateret ud fra postnummeret.");
      return;
    }

    setPostalCodeMessage("Postnummeret kunne ikke valideres. Tjek at det består af 4 tal.");
  }

  function handlePostalCodeChange(nextValue: string) {
    if (isForeignLocation) {
      setPostalCode(nextValue);
      setPostalCodeMessage("");
      return;
    }

    const normalizedPostalCode = nextValue.replace(/\D/g, "").slice(0, 4);
    setPostalCode(normalizedPostalCode);

    if (normalizedPostalCode.length < 4) {
      setPostalCodeMessage("Skriv et postnummer på 4 tal.");
      setRegionId("");
      return;
    }

    const localCity = getLocalDanishPostalCity(normalizedPostalCode);

    if (localCity) {
      setCity(localCity);
      setPostalCodeMessage("By er opdateret ud fra postnummeret.");
    } else {
      setPostalCodeMessage("Validerer postnummer...");
      void fetchPostalCodeCity(normalizedPostalCode);
    }

    setRegionFromPostalCode(normalizedPostalCode);
  }

  function updateMainCategory(categoryId: string, checked: boolean) {
    setSelectedMainCategoryIds((current) => {
      if (!checked) {
        setCategoryLimitMessage("");
        return current.filter((currentCategoryId) => currentCategoryId !== categoryId);
      }

      if (current.includes(categoryId)) {
        return current;
      }

      if (current.length >= 3) {
        setCategoryLimitMessage("Du kan vælge op til 3 kategorier og op til 4 tags.");
        return current;
      }

      setCategoryLimitMessage("");
      return [...current, categoryId];
    });
  }

  function updateTag(tagId: string, checked: boolean) {
    setSelectedTagIds((current) => {
      if (!checked) {
        setCategoryLimitMessage("");
        return current.filter((currentTagId) => currentTagId !== tagId);
      }

      if (current.includes(tagId)) {
        return current;
      }

      if (current.length >= maxEventTags) {
        setCategoryLimitMessage("Du kan vælge op til 3 kategorier og op til 4 tags.");
        return current;
      }

      setCategoryLimitMessage("");
      return [...current, tagId];
    });
  }

  function showPreview() {
    const form = formRef.current;
    if (!form) return;

    const data = new FormData(form);
    const selectedCategoryIds = data.getAll("main_category_ids").map(String);
    const selectedTagIds = data.getAll("tag_ids").map(String);
    const categoryNames = mainCategories
      .filter((category) => selectedCategoryIds.includes(category.id))
      .map((category) => category.name);
    const tagNames = sortedTags
      .filter((tag) => selectedTagIds.includes(tag.id))
      .map((tag) => tag.name);
    const title = String(data.get("title") ?? "").trim() || "Eventtitel mangler";
    const description = String(data.get("event_description") ?? "").trim();
    const startDateValue = String(data.get("start_date") ?? "");
    const endDateValue = String(data.get("end_date") ?? "");
    const startTimeValue = String(data.get("start_time") ?? "");
    const endTimeValue = String(data.get("end_time") ?? "");
    const address = [data.get("address_line"), data.get("postal_code"), data.get("city"), data.get("country")]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(", ");
    const onlineLink = String(data.get("online_url_or_note") ?? "").trim();
    const numericPrice = Number(priceValue.replace(",", "."));

    setPreview({
      title,
      description,
      format: eventFormat === "online" ? "Virtuelt event" : "Personligt event",
      price: isFree || numericPrice <= 0 ? "Gratis" : priceValue + " kr.",
      date: startDateValue === endDateValue ? formatReviewDate(startDateValue) : formatReviewDate(startDateValue) + " - " + formatReviewDate(endDateValue),
      time: startTimeValue && endTimeValue ? startTimeValue + " - " + endTimeValue : "Tidspunkt mangler",
      location: eventFormat === "online" ? onlineLink || "Online-link mangler" : address || "Adresse mangler",
      capacity: String(data.get("capacity") ?? "").trim() || "Ikke angivet",
      categories: categoryNames,
      tags: tagNames,
      coverImageUrl: currentCoverImageUrl,
    });
  }

  function getStepStatus(index: number): "complete" | "missing" {
    const form = formRef.current;
    const data = form ? new FormData(form) : null;
    const text = (name: string) => String(data?.get(name) || "").trim();
    const selectedCategories = data?.getAll("main_category_ids").map(String).filter(Boolean) ?? [];
    const priceValue = text("price");
    const start = new Date(startDate + "T" + startTime + ":00");
    const effectiveEndDate = showEndDateTime ? endDate : startDate;
    const end = new Date(effectiveEndDate + "T" + endTime + ":00");
    const hasValidDuration = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end.getTime() > start.getTime();
    const capacityValue = Number(text("capacity") || 0);
    const hasValidPrice = /^\d{1,5}$/.test(priceValue || "0");

    if (index === 0) {
      return text("title").length > 0 && text("event_description").length >= 20 && hasValidDuration ? "complete" : "missing";
    }

    if (index === 1) {
      if (!hasChosenEventFormat) return "missing";
      if (eventFormat === "online") return isValidHttpUrl(text("online_url_or_note")) ? "complete" : "missing";
      const hasValidPostalCode = isDanishPhysicalEvent ? postalCode.length === 4 : postalCode.trim().length > 0;
      return text("address_line").length > 0 && hasValidPostalCode && city.trim().length > 0 && country.trim().length > 0 ? "complete" : "missing";
    }

    if (index === 2) {
      const numericPrice = Number(priceValue || 0);
      if (priceMode !== "free" && priceMode !== "paid") return "missing";
      if (priceMode === "paid" && (!hasValidPrice || numericPrice <= 0)) return "missing";
      return capacityValue > 0 && capacityValue <= 500 ? "complete" : "missing";
    }

    if (index === 3) {
      return selectedCategories.length > 0 ? "complete" : "missing";
    }

    return [0, 1, 2, 3].every((stepIndex) => getStepStatus(stepIndex) === "complete") ? "complete" : "missing";
  }

  function getMissingInvitationItems(): MissingInvitationItem[] {
    const form = formRef.current;
    const data = form ? new FormData(form) : null;
    const text = (name: string) => String(data?.get(name) || "").trim();
    const selectedCategories = data?.getAll("main_category_ids").map(String).filter(Boolean) ?? [];
    const missing: MissingInvitationItem[] = [];
    const addMissing = (item: MissingInvitationItem) => {
      if (!missing.some((currentItem) => currentItem.key === item.key)) {
        missing.push(item);
      }
    };

    if (text("title").length === 0) {
      addMissing({ focusSelector: "#event-title-input", key: "title", label: "Eventtitel", step: 0, targetId: "event-title-field" });
    }

    if (text("event_description").length < 20) {
      addMissing({ focusSelector: "#event-description-input", key: "description", label: "Beskrivelse", step: 0, targetId: "event-description-field" });
    }

    if (!hasCoverImage) {
      addMissing({ focusSelector: "#event-cover-file", key: "cover", label: "Coverbillede", step: 0, targetId: "event-cover-field" });
    }

    if (getStepStatus(1) !== "complete") {
      addMissing({
        focusSelector: eventFormat === "online" ? "[name='online_url_or_note']" : "[name='address_line']",
        key: eventFormat === "online" ? "online" : "location",
        label: eventFormat === "online" ? "Online-link" : "Lokation",
        step: 1,
        targetId: "event-location-field",
      });
    }

    if (priceMode !== "free" && priceMode !== "paid") {
      addMissing({ key: "price-mode", label: "Prisvalg", step: 2, targetId: "event-price-field" });
    }

    if (getStepStatus(2) !== "complete") {
      addMissing({ focusSelector: "[name='capacity']", key: "capacity", label: "Pris og antal deltagere", step: 2, targetId: "event-price-field" });
    }

    if (selectedCategories.length === 0) {
      addMissing({ key: "category", label: "Kategori", step: 3, targetId: "event-category-field" });
    }

    return missing;
  }

  function refreshFormValidationState() {
    setMissingInvitationItems(getMissingInvitationItems());
    setStepStatuses(steps.map((_, stepIndex) => getStepStatus(stepIndex)));
  }

  function isStepOpen(index: number) {
    return openStepIndexes.includes(index);
  }

  function openStep(index: number) {
    setCurrentStep(index);
    setOpenStepIndexes((currentIndexes) =>
      currentIndexes.includes(index) ? currentIndexes : [...currentIndexes, index].sort((first, second) => first - second),
    );
  }

  function guideToMissingItem(item?: MissingInvitationItem) {
    if (!item) {
      return;
    }

    openStep(item.step);
    setHighlightedMissingKey(item.key);

    window.setTimeout(() => {
      const target = document.getElementById(item.targetId);
      const focusTarget = item.focusSelector
        ? (document.querySelector(item.focusSelector) as HTMLElement | null)
        : (target?.querySelector("input, textarea, select, button") as HTMLElement | null);

      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      focusTarget?.focus({ preventScroll: true });
    }, 80);

    window.setTimeout(() => setHighlightedMissingKey(""), 1800);
  }

  function highlightMissingClass(key: string) {
    return highlightedMissingKey === key ? "ring-4 ring-[#D89A94]/35" : "";
  }

  function goToStep(index: number, anchor?: HTMLElement | null) {
    const nextStep = Math.min(Math.max(index, 0), steps.length - 1);
    const shouldCollapse = isStepOpen(nextStep);
    const beforeTop = anchor?.getBoundingClientRect().top ?? null;

    writeDraft();

    if (nextStep === steps.length - 1) {
      showPreview();
    }

    setCurrentStep(nextStep);
    setOpenStepIndexes((currentIndexes) =>
      shouldCollapse
        ? currentIndexes.filter((currentIndex) => currentIndex !== nextStep)
        : [...currentIndexes, nextStep].sort((first, second) => first - second),
    );
    window.setTimeout(() => {
      restoreDraftFields();
      showPreview();
      refreshFormValidationState();
    }, 0);

    if (beforeTop !== null && anchor) {
      window.requestAnimationFrame(() => {
        const afterTop = anchor.getBoundingClientRect().top;
        window.scrollBy({ top: afterTop - beforeTop, behavior: "instant" });
      });
    }
  }

  function readDraft() {
    try {
      const rawDraft = window.localStorage.getItem(draftStorageKey);
      return rawDraft ? JSON.parse(rawDraft) : null;
    } catch {
      return null;
    }
  }

  function writeDraft() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const fields: Record<string, string[]> = {};

    for (const [key, rawValue] of formData.entries()) {
      if (key === "status" || rawValue instanceof File) {
        continue;
      }

      const fieldValue = String(rawValue);
      fields[key] = [...(fields[key] ?? []), fieldValue];
    }

    const meaningfulValues = Object.entries(fields).filter(([key, values]) => {
      if (["start_date", "end_date", "start_time", "end_time", "country", "event_format"].includes(key)) {
        return false;
      }

      return values.some((fieldValue) => fieldValue.trim().length > 0);
    });

    if (meaningfulValues.length === 0 && selectedMainCategoryIds.length === 0) {
      return;
    }

    window.localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        fields,
        state: {
          city,
          country,
          endDate,
          endTime,
          eventFormat: String(formData.get("event_format") || eventFormat),
          hasChosenEventFormat,
          isForeignLocation,
          paymentBankAccountName,
          paymentBankAccountNumber,
          paymentBankRegistrationNumber,
          paymentDeadlineDays,
          paymentExternalUrl,
          paymentFieldsEdited,
          paymentFieldsInitialized: true,
          paymentInstructions,
          paymentMobilepayNumber,
          isPaymentFormOpen,
          priceMode,
          isFree,
          sendPaymentInfo,
          sendOnlineLinkLater,
          capacityValue,

          postalCode,
          regionId,
          selectedMainCategoryIds,
          selectedTagIds,
          startDate,
          startTime,
        },
        savedAt: new Date().toISOString(),
      }),
    );
    setHasAutosavedDraft(true);
  }

  function formSignature() {
    const form = formRef.current;
    if (!form) return "";

    const ignoredKeys = new Set([
      "current_step",
      "notify_participants",
      "participant_update_message",
      "status",
    ]);
    const formData = new FormData(form);
    const entries: string[] = [];

    for (const [key, rawValue] of formData.entries()) {
      if (ignoredKeys.has(key)) continue;

      if (rawValue instanceof File) {
        if (rawValue.size > 0) {
          entries.push(`${key}=file:${rawValue.name}:${rawValue.size}`);
        }
        continue;
      }

      entries.push(`${key}=${rawValue}`);
    }

    return entries.sort().join("&");
  }

  function hasActualFormChanges() {
    const initialSignature = initialFormSignatureRef.current;
    return Boolean(initialSignature && formSignature() !== initialSignature);
  }

  function applyDraftFields(fields: Record<string, string[]>, options: { keepEventFormat?: boolean } = {}) {
    const form = formRef.current;
    const restoredOnlineValues = Array.isArray(fields.online_url_or_note) ? fields.online_url_or_note : [];

    if (restoredOnlineValues.includes(onlineLinkLaterText)) {
      setSendOnlineLinkLater(true);
    }

    if (!form) {
      return;
    }

    for (const [name, values] of Object.entries(fields) as Array<[string, string[]]>) {
      if ((options.keepEventFormat && name === "event_format") || name === "tag_ids") {
        continue;
      }

      const controls = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name='" + name + "']"));

      controls.forEach((control, index) => {
        const valueAtIndex = values[index] ?? values[0] ?? "";

        if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
          control.checked = values.includes(control.value);
          control.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          control.value = valueAtIndex;
          control.dispatchEvent(new Event("input", { bubbles: true }));
          control.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    setFormVersion((version) => version + 1);
  }

  function restoreDraft() {
    const draft = readDraft();

    if (!draft) {
      setHasAutosavedDraft(false);
      return;
    }

    setStartDate(draft.state?.startDate ?? today);
    setEndDate(draft.state?.endDate ?? draft.state?.startDate ?? today);
    setStartTime(draft.state?.startTime ?? "19:00");
    setEndTime(draft.state?.endTime ?? "21:00");
    setPostalCode(draft.state?.postalCode ?? "");
    setCity(draft.state?.city ?? "");
    const restoredCountry = draft.state?.country ?? "Danmark";
    setCountry(restoredCountry);
    setIsForeignLocation(
      typeof draft.state?.isForeignLocation === "boolean"
        ? draft.state.isForeignLocation
        : String(restoredCountry).trim().toLowerCase() !== "danmark",
    );
    setRegionId(draft.state?.regionId ?? "");
    setEventFormat(draft.state?.eventFormat === "online" ? "online" : "physical");
    setHasChosenEventFormat(Boolean(draft.state?.hasChosenEventFormat));
    setPriceMode(draft.state?.priceMode === "paid" || draft.state?.priceMode === "free" ? draft.state.priceMode : "");
    setIsFree(Boolean(draft.state?.isFree));
    setSendPaymentInfo(
      typeof draft.state?.sendPaymentInfo === "boolean"
        ? draft.state.sendPaymentInfo
        : draft.state?.paymentMethodSource !== "none",
    );
    const hasPersistedPaymentFields = draft.state?.paymentFieldsInitialized === true && draft.state?.paymentFieldsEdited === true;
    setPaymentFieldsEdited(Boolean(draft.state?.paymentFieldsEdited) || initialPaymentFieldsEdited);
    setPaymentMobilepayNumber(hasPersistedPaymentFields ? draft.state?.paymentMobilepayNumber ?? "" : initialPaymentMobilepayNumber);
    setPaymentBankRegistrationNumber(
      hasPersistedPaymentFields ? draft.state?.paymentBankRegistrationNumber ?? "" : initialPaymentBankRegistrationNumber,
    );
    setPaymentBankAccountNumber(hasPersistedPaymentFields ? draft.state?.paymentBankAccountNumber ?? "" : initialPaymentBankAccountNumber);
    setPaymentBankAccountName(hasPersistedPaymentFields ? draft.state?.paymentBankAccountName ?? "" : initialPaymentBankAccountName);
    setPaymentExternalUrl(hasPersistedPaymentFields ? draft.state?.paymentExternalUrl ?? "" : initialPaymentExternalUrl);
    setPaymentInstructions(hasPersistedPaymentFields ? draft.state?.paymentInstructions ?? "" : initialPaymentInstructions);
    setPaymentDeadlineDays(hasPersistedPaymentFields ? draft.state?.paymentDeadlineDays ?? "" : initialPaymentDeadlineDays);
    setIsPaymentFormOpen(false);
    setSendOnlineLinkLater(Boolean(draft.state?.sendOnlineLinkLater));
    setCapacityValue(draft.state?.capacityValue ?? String(draftEvent?.capacity ?? 12));
    setSelectedMainCategoryIds(Array.isArray(draft.state?.selectedMainCategoryIds) ? draft.state.selectedMainCategoryIds : []);
    const restoredTagIds = Array.isArray(draft.state?.selectedTagIds)
      ? draft.state.selectedTagIds.filter((tagId: unknown): tagId is string => typeof tagId === "string")
      : [];
    setSelectedTagIds(restoredTagIds.slice(0, maxEventTags));

    window.requestAnimationFrame(() => {
      applyDraftFields(draft.fields ?? {});
      refreshFormValidationState();
    });
  }

  function restoreDraftFields() {
    const draft = readDraft();

    if (!draft) {
      return;
    }

    window.requestAnimationFrame(() => applyDraftFields(draft.fields ?? {}, { keepEventFormat: true }));
  }

  function clearDraft() {
    window.localStorage.removeItem(draftStorageKey);
    setHasAutosavedDraft(false);
    setAutosaveMessage("");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("message") ?? "";

    const normalizedMessage = message.toLowerCase();
    const imageMessage = getEventImageMessage(message);

    if (imageMessage) {
      window.setTimeout(() => {
        setCoverImageErrorMessage(imageMessage);
        openStep(0);
      }, 0);
    }

    if (organizerAcceptanceMessage) {
      window.setTimeout(() => {
        guideToMissingItem({
          focusSelector: "[name='accepted_organizer_terms']",
          key: "organizer-terms",
          label: "Arrangørvilkår",
          step: steps.length - 1,
          targetId: "event-organizer-terms-field",
        });
      }, 0);
    }

    if (normalizedMessage.includes("oprettet") || normalizedMessage.includes("gemt") || normalizedMessage.includes("opdateret")) {
      window.localStorage.removeItem(draftStorageKey);
      window.localStorage.removeItem(userDraftStorageKey + ":new");
      window.localStorage.removeItem(legacyEventDraftStorageKey);
      return;
    }

    if (shouldUsePrefillAsSource) {
      window.localStorage.removeItem(draftStorageKey);
      window.setTimeout(refreshFormValidationState, 0);
      return;
    }

    const hasDraft = Boolean(window.localStorage.getItem(draftStorageKey));
    window.localStorage.removeItem(legacyEventDraftStorageKey);
    window.setTimeout(() => {
      setHasAutosavedDraft(hasDraft);
      if (hasDraft) {
        restoreDraft();
      } else {
        refreshFormValidationState();
      }
    }, 0);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(writeDraft, 350);
    return () => window.clearTimeout(timeout);
  }, [
    capacityValue,
    city,
    country,
    endDate,
    endTime,
    eventFormat,
    hasChosenEventFormat,
    isForeignLocation,
    isFree,
    isPaymentFormOpen,
    paymentBankAccountName,
    paymentBankAccountNumber,
    paymentBankRegistrationNumber,
    paymentDeadlineDays,
    paymentExternalUrl,
    paymentInstructions,
    paymentMobilepayNumber,
    postalCode,
    priceMode,
    regionId,
    sendPaymentInfo,
    selectedMainCategoryIds,
    selectedTagIds,
    startDate,
    startTime,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      showPreview();
      refreshFormValidationState();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [capacityValue, city, country, endDate, endTime, eventFormat, hasChosenEventFormat, hasCoverImage, isForeignLocation, isFree, postalCode, priceValue, regionId, selectedMainCategoryIds, selectedTagIds, startDate, startTime]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      initialFormSignatureRef.current = formSignature();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  function renderStepAccordionHeader(index: number) {
    const step = steps[index];
    const isOpen = isStepOpen(index);
    const status = stepStatuses[index] ?? "missing";
    const isDone = status === "complete";
    const statusClass = isDone
      ? "border-[#C8DCC0] bg-[#F3F7F0] text-[#4E6A48]"
      : isOpen
        ? "border-[#7A5D91] bg-[#F4F0F7] text-[#6E5A86] shadow-[0_0_0_3px_rgba(122,93,145,0.10)]"
        : "border-[#E8E0D2] bg-[#FFFCF7] text-[#6E6475]";
    const badgeClass = isDone
      ? "border-[#CFE3C8] bg-[#EAF4E6] text-[#4F6F48]"
      : "border-[#D8CBE4] bg-[#F4F0F7] text-[#7A5D91]";
    const headerLayoutClass =
      index === 1 || index === 2 ? "flex-col items-stretch sm:flex-row sm:items-center" : "items-center";
    const radioGroupClass = "grid w-full min-w-0 grid-cols-2 gap-2 sm:w-auto sm:min-w-[245px]";
    const radioPillClass = (checked: boolean) =>
      "inline-flex h-9 cursor-pointer items-center justify-center rounded-full border px-3 text-xs font-semibold transition sm:h-10 sm:text-sm " +
      (checked
        ? "border-[#7A5D91] bg-[#7A5D91] text-white shadow-soft"
        : "border-[#D8CBE4] bg-white text-[#2F2437] hover:border-[#7A5D91]");

    return (
      <div className={"flex w-full min-w-0 gap-3 rounded-[18px] border px-4 py-3 transition " + headerLayoutClass + " " + statusClass}>
        <button
          aria-expanded={isOpen}
          className="min-w-0 flex-1 text-left"
          onClick={(event) => goToStep(index, event.currentTarget)}
          type="button"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-75">
            Trin {index + 1}
          </span>
          <span className="mt-0.5 block truncate text-base font-semibold sm:text-lg">
            {step.title}
          </span>
        </button>

        {index === 1 ? (
          <span className="sr-only" id="event-format-header-label">
            Hvordan deltager man?
          </span>
        ) : null}
        {index === 1 ? (
          <div aria-labelledby="event-format-header-label" className={radioGroupClass} role="radiogroup">
            {[
              { label: "Personligt", value: "physical" },
              { label: "Online", value: "online" },
            ].map((option) => (
              <label className={radioPillClass(hasChosenEventFormat && eventFormat === option.value)} key={option.value}>
                <input
                  checked={hasChosenEventFormat && eventFormat === option.value}
                  className="sr-only"
                  name="event_format"
                  onChange={() => {
                    writeDraft();
                    setEventFormat(option.value as "physical" | "online");
                    setHasChosenEventFormat(true);
                    openStep(1);
                    window.setTimeout(() => {
                      restoreDraftFields();
                      showPreview();
                      refreshFormValidationState();
                    }, 0);
                  }}
                  type="radio"
                  value={option.value}
                />
                {option.label}
              </label>
            ))}
          </div>
        ) : null}

        {index === 2 ? (
          <span className="sr-only" id="event-price-header-label">
            Hvad koster det at deltage?
          </span>
        ) : null}
        {index === 2 ? (
          <div aria-labelledby="event-price-header-label" className={radioGroupClass} role="radiogroup">
            {[
              { label: "Gratis", value: "free" },
              { label: "Betaling", value: "paid" },
            ].map((option) => (
              <label className={radioPillClass(priceMode === option.value)} key={option.value}>
                <input
                  checked={priceMode === option.value}
                  className="sr-only"
                  onChange={() => {
                    const nextMode = option.value as "free" | "paid";
                    writeDraft();
                    setPriceMode(nextMode);
                    openStep(2);
                    if (nextMode === "free") {
                      setIsFree(true);
                      setPriceValue("0");
                    }
                    if (nextMode === "paid") {
                      setIsFree(false);
                      if (priceValue === "0") setPriceValue("");
                    }
                    window.setTimeout(() => {
                      restoreDraftFields();
                      showPreview();
                      refreshFormValidationState();
                    }, 0);
                  }}
                  type="radio"
                />
                {option.label}
              </label>
            ))}
          </div>
        ) : null}

        {index !== 1 && index !== 2 ? (
          <span className={"inline-flex h-7 shrink-0 items-center justify-center rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-wide sm:h-8 sm:px-3 sm:text-xs " + badgeClass}>
            {isDone ? "Klar" : "Afventer"}
          </span>
        ) : null}

      </div>
    );
  }

  const hasReachedActiveLimit = Boolean(activeLimitMessage);
  const coOrganizerBlocksSubmit = inactiveExistingCoOrganizers.length > 0;
  const activeLimitBlocksSubmit = hasReachedActiveLimit && !isEditingPublishedEvent;
  const canPublish = missingInvitationItems.length === 0 && !coOrganizerBlocksSubmit && !activeLimitBlocksSubmit;
  const legalAcceptanceBlocksSubmit = requiresOrganizerAcceptance && !acceptedOrganizerTerms;
  const canSubmitEvent = canPublish && !legalAcceptanceBlocksSubmit;

  function renderSubmitPanel() {
    return (
      <section className="grid gap-3 rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:p-5" id="event-submit-panel">
        <div
          className={
            "rounded-card border px-4 py-3 text-sm leading-6 " +
            (canSubmitEvent
              ? "border-[#CFE3C8] bg-[#F3F7F0] text-[#4F6F48]"
              : "border-[#D8CBE4] bg-[#F4F0F7] text-[#6E5A86]")
          }
        >
          <p className="font-semibold">
            {canSubmitEvent
              ? isEditingPublishedEvent
                ? "Ændringerne er klar"
                : "Din invitation er klar"
              : coOrganizerBlocksSubmit
                ? "Medarrangør skal fjernes"
              : activeLimitBlocksSubmit
                ? "Grænsen for aktive events er nået"
                : legalAcceptanceBlocksSubmit
                  ? "Før eventet kan offentliggøres"
                : "Din invitation er næsten klar"}
          </p>
          {canSubmitEvent ? (
            <p>
              {isEditingPublishedEvent
                ? "Du kan nu gemme ændringerne på eventet."
                : "Du kan nu gøre eventet synligt på SoulEvents."}
            </p>
          ) : activeLimitBlocksSubmit ? (
            <p className="mt-2">{activeLimitMessage}</p>
          ) : coOrganizerBlocksSubmit ? (
            <p className="mt-2">Fjern medarrangører, der ikke længere har en aktiv godkendt profil, før eventet kan offentliggøres.</p>
          ) : legalAcceptanceBlocksSubmit ? (
            <p className="mt-2">
              Før eventet kan offentliggøres, skal du acceptere de gældende arrangørvilkår og retningslinjer nedenfor.
            </p>
          ) : (
            <div className="mt-2">
              <p>Udfyld først:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {missingInvitationItems.map((item) => (
                  <button
                    className="rounded-full border border-[#D8CBE4] bg-white px-3 py-1 text-xs font-semibold text-[#7A5D91] transition hover:border-[#7A5D91]"
                    key={item.key}
                    onClick={() => guideToMissingItem(item)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {requiresOrganizerAcceptance ? (
          <div
            className={
              "rounded-card border px-4 py-3 text-sm leading-6 transition " +
              (legalAcceptanceBlocksSubmit
                ? "border-[#E8D2CC] bg-[#FFF8F6] text-[#6E3A4A]"
                : "border-[#CFE3C8] bg-[#F6FBF3] text-[#4F6F48]") +
              " " +
              highlightMissingClass("organizer-terms")
            }
            id="event-organizer-terms-field"
          >
            <label className="flex items-start gap-3">
              <input
                checked={acceptedOrganizerTerms}
                className="mt-1 size-4 shrink-0 accent-[#7A4EAB]"
                name="accepted_organizer_terms"
                onChange={(event) => {
                  setAcceptedOrganizerTerms(event.currentTarget.checked);
                  setFormVersion((version) => version + 1);
                  window.setTimeout(() => {
                    writeDraft();
                    refreshFormValidationState();
                  }, 0);
                }}
                type="checkbox"
                value="yes"
              />
              <span>
                <span className="block font-semibold text-[#2F2633]">Jeg accepterer de gældende arrangørvilkår og retningslinjer for SoulEvents.</span>
                <span className="mt-1 block text-xs leading-5 text-ink/62">
                  Læs{" "}
                  <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4" href="/legal/arrangoervilkaar" target="_blank">
                    arrangørvilkår
                  </Link>{" "}
                  og{" "}
                  <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4" href="/legal/platformens-retningslinjer" target="_blank">
                    retningslinjer
                  </Link>
                  . Dit valg gemmes for den aktuelle version, når eventet offentliggøres.
                </span>
              </span>
            </label>
            {organizerAcceptanceMessage ? (
              <p className="mt-3 rounded-md border border-[#E8D2CC] bg-white px-3 py-2 text-sm font-semibold text-[#8B3E5A]">
                {organizerAcceptanceMessage}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            className={
              "inline-flex h-11 items-center justify-center gap-2 rounded-button px-5 text-sm font-semibold shadow-soft transition " +
              (canSubmitEvent
                ? "bg-[#7A5D91] text-white hover:bg-[#6E5285]"
                : "bg-[#D8CBE4] text-white shadow-none")
            }
            name="status"
            disabled={!canSubmitEvent || isSubmittingEventUpdate}
            type="submit"
            value={primarySubmitStatus}
          >
            {isSubmittingEventUpdate
              ? "Gemmer..."
              : coOrganizerBlocksSubmit
                ? "Fjern inaktiv medarrangør"
              : canPublish
              ? isEditingPublishedEvent
                ? "Gem ændringer"
                : "Gør event offentlig"
              : activeLimitBlocksSubmit
                ? "Grænsen er nået"
                : legalAcceptanceBlocksSubmit
                  ? "Accepter vilkår for at fortsætte"
                : "Fuldfør eventet for at gøre det offentligt"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
          {!isEditingPublishedEvent ? (
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-button border border-[#7A4EAB]/30 bg-white px-5 text-sm font-semibold text-[#7A4EAB]"
              name="status"
              type="submit"
              value="draft"
            >
              <Save className="size-4" aria-hidden="true" />
              Gem kladde
            </button>
          ) : null}
        </div>
        <p className="text-xs leading-5 text-ink/58">
          Ved at offentliggøre bekræfter du, at eventet overholder SoulEvents&apos; gældende{" "}
          <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4" href="/legal/arrangoervilkaar" target="_blank">
            arrangørvilkår
          </Link>{" "}
          og{" "}
          <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4" href="/legal/platformens-retningslinjer" target="_blank">
            retningslinjer
          </Link>
          .
        </p>
        {notificationLogs.length > 0 ? (
          <div className="rounded-card border border-[#E5D4F7] bg-[#F7F2FB] p-4 text-sm text-ink/72">
            <h3 className="font-semibold text-midnight">Log over ændringsmails</h3>
            <div className="mt-3 grid gap-3">
              {notificationLogs.map((log) => (
                <div className="rounded-md bg-white/80 p-3" key={log.createdAt}>
                  <p className="font-semibold text-midnight">
                    {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.createdAt))}
                  </p>
                  <p className="mt-1">Ændringsmail sendt</p>
                  <p className="mt-1 text-xs font-semibold text-ink/60">
                    {log.recipientCount} {log.recipientCount === 1 ? "modtager" : "modtagere"}
                    {log.actorName ? " · sendt af " + log.actorName : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <form
      action={createEventAction}
      autoComplete="off"
      className="grid w-full max-w-full gap-5 overflow-x-hidden sm:gap-6"
      noValidate
      onChange={() => {
        setFormVersion((version) => version + 1);
        writeDraft();
        window.setTimeout(() => {
          showPreview();
          refreshFormValidationState();
        }, 0);
      }}
      onInput={() => {
        setFormVersion((version) => version + 1);
        writeDraft();
        window.setTimeout(() => {
          showPreview();
          refreshFormValidationState();
        }, 0);
      }}
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const isDialogParticipantSubmit = submitter?.name === "notify_participants";
        const submittedStatus = isDialogParticipantSubmit ? pendingSubmitStatus || primarySubmitStatus : submitter?.value;
        const latestMissingInvitationItems = getMissingInvitationItems();
        const latestCanPublish = latestMissingInvitationItems.length === 0 && !coOrganizerBlocksSubmit && !activeLimitBlocksSubmit;

        const isPrimarySubmit =
          submittedStatus === "active" ||
          submittedStatus === "pending_review" ||
          (isEditingPublishedEvent && submittedStatus === primarySubmitStatus);

        if (isPrimarySubmit && activeLimitBlocksSubmit) {
          event.preventDefault();
          return;
        }

        if (isPrimarySubmit && !latestCanPublish) {
          event.preventDefault();
          guideToMissingItem(latestMissingInvitationItems[0]);
          return;
        }

        if (isPrimarySubmit && legalAcceptanceBlocksSubmit) {
          event.preventDefault();
          guideToMissingItem({
            focusSelector: "[name='accepted_organizer_terms']",
            key: "organizer-terms",
            label: "Arrangørvilkår",
            step: steps.length - 1,
            targetId: "event-organizer-terms-field",
          });
          return;
        }

        if (
          isPrimarySubmit &&
          isEditingPublishedEvent &&
          activeBookingCount > 0 &&
          hasActualFormChanges() &&
          !showParticipantNotificationDialog
        ) {
          event.preventDefault();
          setPendingSubmitStatus(submitter?.value ?? primarySubmitStatus);
          setShowParticipantNotificationDialog(true);
          return;
        }

        if (isPrimarySubmit) {
          if (isDialogParticipantSubmit && submitter?.value === "yes") {
            setIsSavingAndSending(true);
          } else {
            setIsSavingWithoutEmail(true);
          }
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target instanceof HTMLElement && event.target.tagName !== "TEXTAREA") {
          event.preventDefault();
        }
      }}
      ref={formRef}
    >
      {draftEvent?.id ? <input name="event_id" type="hidden" value={draftEvent.id} /> : null}
      <input name="current_step" type="hidden" value={currentStep} />
      <input name="current_cover_image_path" type="hidden" value={value(draftEvent?.cover_image_path)} />
      {selectedCoOrganizers.map((coOrganizer) => (
        <input key={coOrganizer.id} name="co_organizer_profile_ids" type="hidden" value={coOrganizer.id} />
      ))}
      {showParticipantNotificationDialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/35 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="event-update-dialog-title">
          <section className="w-full max-w-lg rounded-card bg-white p-5 shadow-lift sm:p-6">
            <h2 className="text-2xl font-semibold text-midnight" id="event-update-dialog-title">Gem ændringer</h2>
            <p className="mt-3 text-sm leading-6 text-ink/72">Vil du give de tilmeldte besked om ændringerne?</p>
            <div className="mt-4 rounded-md bg-[#F7F2FB] p-4 text-sm leading-6 text-ink/72">
              <p>Send kun en mail, hvis ændringerne har betydning for deltagerne – f.eks. ændret dato, tidspunkt, sted, pris eller anden vigtig praktisk information.</p>
              <p className="mt-3">Små rettelser som stavefejl, nye billeder eller mindre tekstændringer behøver normalt ikke en mail.</p>
            </div>
            <label className="mt-5 grid gap-2 text-sm font-semibold text-midnight">
              Personlig besked til deltagerne
              <textarea
                className="min-h-28 rounded-md border border-[#D8CBE4] bg-white px-3 py-3 text-base font-normal text-ink outline-none transition focus:border-[#7A4EAB] focus:ring-4 focus:ring-[#CDB4EA]"
                maxLength={500}
                name="participant_update_message"
                placeholder="Skriv eventuelt en kort besked om ændringen..."
              />
            </label>
            <input name="status" type="hidden" value={pendingSubmitStatus || primarySubmitStatus} />
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                className="inline-flex h-11 items-center justify-center rounded-button bg-[#7A5D91] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmittingEventUpdate}
                name="notify_participants"
                type="submit"
                value="no"
              >
                {isSavingWithoutEmail ? "Gemmer..." : "Gem uden at sende mail"}
              </button>
              <button
                className="inline-flex h-11 items-center justify-center rounded-button border border-[#7A4EAB]/30 bg-white px-4 text-sm font-semibold text-[#7A4EAB] disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmittingEventUpdate}
                name="notify_participants"
                type="submit"
                value="yes"
              >
                {isSavingAndSending ? "Sender..." : "Gem og send besked"}
              </button>
            </div>
            <button
              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-button border border-midnight/10 bg-white px-4 text-sm font-semibold text-ink/70 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmittingEventUpdate}
              onClick={() => {
                setShowParticipantNotificationDialog(false);
                setPendingSubmitStatus("");
                setIsSavingWithoutEmail(false);
                setIsSavingAndSending(false);
              }}
              type="button"
            >
              Annuller
            </button>
          </section>
        </div>
      ) : null}
      <div className="grid min-w-0 max-w-full gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="grid min-w-0 max-w-full gap-5">
          {renderStepAccordionHeader(0)}
      <section className={isStepOpen(0) ? "grid w-full min-w-0 max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        <div className="grid min-w-0 gap-4 md:grid-cols-2 md:gap-x-5 md:gap-y-4">
          <div
            className={
              "rounded-[20px] border p-4 transition md:col-span-2 " +
              titleBoxStateClass +
              " " +
              (highlightedMissingKey === "title" ? "ring-4 ring-[#D89A94]/35" : "")
            }
            id="event-title-field"
          >
            <div className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#B56F8A] shadow-sm">
              Start her
            </div>
            <TextInput
              autoFocus={!titleValue}
              defaultValue={titleValue}
              help="Giv eventet et kort og tydeligt navn. Det bliver deltagernes første indtryk."
              highlightWhenEmpty
              id="event-title-input"
              label="Hvad kalder du dit event?"
              maxLength={80}
              name="title"
              onValueChange={setTitleValue}
              placeholder="Giv dit event et navn"
              required
            />
          </div>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span>
              Startdato<span className="ml-1 text-[#B56F8A]">*</span>
            </span>
            <input
              autoComplete="off"
              className={"h-12 w-full min-w-0 cursor-pointer rounded-card border px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA] " + fieldStateClass(startDate)}
              name="start_date"
              onChange={(event) => updateStartDate(event.target.value)}
              required
              type="date"
              value={startDate}
            />
          </label>

          <TimeSelect defaultValue="19:00" label="Starttidspunkt" name="start_time" onChange={setStartTime} required value={startTime} />

          {!showEndDateTime ? <input name="end_date" type="hidden" value={startDate} /> : null}

          <TimeSelect defaultValue="21:00" label="Sluttidspunkt" name="end_time" onChange={setEndTime} required value={endTime} />

          {!showEndDateTime ? (
            <button
              className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#7A5D91] transition hover:text-[#6E5285] md:col-span-2"
              onClick={() => {
                setEndDate(startDate);
                setShowEndDateTime(true);
              }}
              type="button"
            >
              <Plus className="size-4" aria-hidden="true" />
              Anden slutdato
            </button>
          ) : null}

          {showEndDateTime ? (
            <label className="grid gap-2 text-sm font-medium text-ink/72 md:col-span-2 md:max-w-[calc(50%-0.625rem)]">
              <span>
                Slutdato<span className="ml-1 text-[#B56F8A]">*</span>
              </span>
              <input
                autoComplete="off"
                className={"h-12 w-full min-w-0 cursor-pointer rounded-card border px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA] " + fieldStateClass(endDate)}
                min={startDate}
                name="end_date"
                onChange={(event) => setEndDate(event.target.value)}
                required
                type="date"
                value={endDate}
              />
            </label>
          ) : null}

          {durationLabel && (
            <div
              className={
                durationLabel.startsWith("Vælg") || durationLabel.startsWith("VÃ¦lg") || durationLabel.startsWith("VÃƒÂ¦lg")
                  ? "rounded-card border border-[#E6B8B8] bg-[#FBEAEA] px-4 py-3 text-sm font-semibold text-[#9A3F3F] md:col-span-2"
                  : "rounded-card border border-[#E8E0D2] bg-[#FAF6EF] px-4 py-3 text-sm font-semibold text-[#6E6475] md:col-span-2"
              }
            >
              {durationLabel}
            </div>
          )}
        </div>
        <div className={"rounded-[20px] transition " + highlightMissingClass("description")} id="event-description-field">
          <EventDescriptionField defaultValue={value(draftEvent?.long_description || draftEvent?.short_description)} />
        </div>
        <section className="grid min-w-0 gap-4 rounded-[22px] border border-[#E5D4F7] bg-[#FAF8FC] p-4 md:p-5">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold text-midnight">Afholder du eventet sammen med andre?</h3>
            <p className="text-sm leading-6 text-ink/68">
              Du kan invitere op til to medarrangører med en aktiv profil på SoulEvents. Medarrangøren vises først på eventet, når invitationen er bekræftet.
            </p>
          </div>

          {existingCoOrganizers.length > 0 || selectedCoOrganizers.length > 0 ? (
            <div className="grid gap-3">
              {existingCoOrganizers.map((coOrganizer) => {
                const statusCopy = coOrganizerStatusCopy(coOrganizer.status, coOrganizer.profileIsActive);
                return (
                  <div
                    className={
                      "flex flex-col gap-3 rounded-card border p-3 shadow-sm sm:flex-row sm:items-start " +
                      (coOrganizer.profileIsActive === false ? "border-[#E8D2CC] bg-[#FFF8F6]" : "border-[#E5D4F7] bg-white")
                    }
                    key={coOrganizer.id}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <CoOrganizerAvatar imageUrl={coOrganizer.imageUrl} name={coOrganizer.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-midnight">{coOrganizer.name}</p>
                          <span className={"rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide " + statusCopy.badgeClass}>
                            {statusCopy.label}
                          </span>
                        </div>
                        {coOrganizer.city ? <p className="mt-1 text-sm text-ink/58">{coOrganizer.city}</p> : null}
                        <p className="mt-2 text-sm leading-5 text-ink/62">{statusCopy.description}</p>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                      {coOrganizer.status === "pending" && coOrganizer.profileIsActive !== false ? (
                        <button
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-[#D8CBE4] bg-[#F4F0F7] px-3 text-xs font-semibold text-[#6E5A86] transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
                          disabled={isUpdatingCoOrganizerInvitation}
                          onClick={() => runCoOrganizerInvitationAction(resendCoOrganizerInvitationAction, coOrganizer.id)}
                          type="button"
                        >
                          <Send className="size-3.5" aria-hidden="true" />
                          Send invitation igen
                        </button>
                      ) : null}
                      <button
                        className="inline-flex h-9 items-center justify-center rounded-full border border-midnight/10 bg-white px-3 text-xs font-semibold text-ink/64 transition hover:border-[#B56F8A] hover:text-[#B56F8A]"
                        disabled={isUpdatingCoOrganizerInvitation}
                        onClick={() => runCoOrganizerInvitationAction(cancelCoOrganizerInvitationAction, coOrganizer.id)}
                        type="button"
                      >
                        Fjern invitation
                      </button>
                    </div>
                  </div>
                );
              })}

              {selectedCoOrganizers.map((coOrganizer) => (
                <div className="flex min-w-0 items-start gap-3 rounded-card border border-[#D8CBE4] bg-white p-3 shadow-sm" key={coOrganizer.id}>
                  <CoOrganizerAvatar imageUrl={coOrganizer.imageUrl} name={coOrganizer.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-midnight">{coOrganizer.name}</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#7A5D91]">Inviteres når eventet gemmes</p>
                    {coOrganizer.city ? <p className="mt-1 text-sm text-ink/58">{coOrganizer.city}</p> : null}
                  </div>
                  <button
                    aria-label={"Fjern " + coOrganizer.name}
                    className="grid size-9 place-items-center rounded-full border border-midnight/10 bg-white text-ink/54 transition hover:border-[#B56F8A] hover:text-[#B56F8A]"
                    onClick={() => removeSelectedCoOrganizer(coOrganizer.id)}
                    type="button"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {canAddCoOrganizer ? (
            <div className="grid gap-3">
              {!coOrganizerSearchOpen ? (
                <button
                  className="inline-flex h-11 w-fit items-center gap-2 rounded-button border border-[#7A5D91]/25 bg-white px-4 text-sm font-semibold text-[#6E5A86] transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
                  onClick={() => setCoOrganizerSearchOpen(true)}
                  type="button"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Tilføj medarrangør
                </button>
              ) : (
                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm font-semibold text-midnight">
                    Søg efter medarrangør
                    <input
                      className="h-12 rounded-card border border-[#D8CBE4] bg-white px-4 text-base font-normal outline-none transition focus:border-[#7A4EAB] focus:ring-4 focus:ring-[#CDB4EA]"
                      onChange={(event) => searchCoOrganizers(event.target.value)}
                      placeholder="Søg på profilnavn, by eller speciale"
                      type="search"
                      value={coOrganizerSearchQuery}
                    />
                  </label>
                  {isSearchingCoOrganizers ? <p className="text-sm text-ink/58">Søger...</p> : null}
                  {coOrganizerSearchMessage ? <p className="text-sm font-semibold text-[#6E5A86]">{coOrganizerSearchMessage}</p> : null}
                  {matchingExistingCoOrganizers.length > 0 ? (
                    <div className="grid gap-2 rounded-card border border-[#E7D59D] bg-[#FFF8DF] p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#7A5A15]">Allerede inviteret</p>
                      {matchingExistingCoOrganizers.map((coOrganizer) => {
                        const statusCopy = coOrganizerStatusCopy(coOrganizer.status, coOrganizer.profileIsActive);
                        return (
                          <div className="flex items-start gap-3 rounded-[18px] bg-white/70 p-3" key={"existing-search-" + coOrganizer.id}>
                            <CoOrganizerAvatar imageUrl={coOrganizer.imageUrl} name={coOrganizer.name} />
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-midnight">{coOrganizer.name}</span>
                              <span className="mt-1 block text-sm leading-5 text-ink/62">{statusCopy.description}</span>
                            </span>
                            <span className={"shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide " + statusCopy.badgeClass}>
                              {statusCopy.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {coOrganizerCandidates.length > 0 ? (
                    <div className="grid gap-2">
                      {coOrganizerCandidates.map((candidate) => (
                        <button
                          className="flex items-start gap-3 rounded-card border border-[#E5D4F7] bg-white p-3 text-left shadow-sm transition hover:border-[#7A5D91]"
                          key={candidate.id}
                          onClick={() => addCoOrganizer(candidate)}
                          type="button"
                        >
                          <CoOrganizerAvatar imageUrl={candidate.imageUrl} name={candidate.name} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-midnight">{candidate.name}</span>
                            <span className="block text-sm text-ink/58">{[candidate.city, ...(candidate.categories ?? [])].filter(Boolean).join(" · ")}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-card border border-[#E8E0D2] bg-white px-4 py-3 text-sm font-semibold text-ink/64">
              Maksimum er nået: ét event kan have én primær arrangør og højst to medarrangører.
            </p>
          )}
        </section>
      </section>
{renderStepAccordionHeader(1)}
      <section className={isStepOpen(1) ? "grid w-full min-w-0 max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft transition sm:gap-5 sm:p-6 " + highlightMissingClass(eventFormat === "online" ? "online" : "location") : "hidden"} id="event-location-field">
        {!hasChosenEventFormat ? (
          <p className="rounded-card border border-[#D8CBE4] bg-[#FAF6EF] px-4 py-3 text-sm leading-6 text-ink/64">
            Vælg først fysisk eller online i trinlinjen ovenfor.
          </p>
        ) : null}
        {showAddress ? (
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <TextInput defaultValue={value(draftEvent?.address_line ?? facilitator.addressLine)} label="Adresse" name="address_line" required maxLength={120} />

            <label className="grid min-w-0 gap-2 text-sm font-medium text-ink/72">
              <span>
                {isDanishPhysicalEvent ? "Postnummer" : "Postnummer / ZIP"}<span className="ml-1 text-[#B56F8A]">*</span>
              </span>
              <input
                autoComplete="off"
                className={"h-12 w-full min-w-0 rounded-card border px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] " + fieldStateClass(postalCode, { error: isDanishPhysicalEvent && postalCode.length > 0 && postalCode.length < 4 })}
                inputMode={isDanishPhysicalEvent ? "numeric" : "text"}
                maxLength={isDanishPhysicalEvent ? 4 : undefined}
                name="postal_code"
                onChange={(event) => (isDanishPhysicalEvent ? handlePostalCodeChange(event.target.value) : setPostalCode(event.target.value))}
                pattern={isDanishPhysicalEvent ? "[0-9]{4}" : undefined}
                required
                value={postalCode}
              />
            </label>

            <label className="grid min-w-0 gap-2 text-sm font-medium text-ink/72">
              <span>
                By<span className="ml-1 text-[#B56F8A]">*</span>
              </span>
              <input
                autoComplete="off"
                className={"h-12 w-full min-w-0 rounded-card border px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] " + fieldStateClass(city, { auto: isDanishPhysicalEvent && Boolean(city) })}
                name="city"
                onChange={(event) => setCity(event.target.value)}
                readOnly={isDanishPhysicalEvent}
                required
                value={city}
              />
              {postalCodeMessage && isDanishPhysicalEvent ? <span className="text-xs leading-5 text-[#7A4EAB]">{postalCodeMessage}</span> : null}
            </label>

            <label className="grid min-w-0 gap-2 text-sm font-medium text-ink/72">
              <span>
                Land<span className="ml-1 text-[#B56F8A]">*</span>
              </span>
              <input
                autoComplete="off"
                className={"h-12 w-full min-w-0 rounded-card border px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] " + fieldStateClass(country, { auto: isDanishPhysicalEvent })}
                name="country"
                onChange={(event) => setCountry(event.target.value)}
                placeholder={isForeignLocation ? "Fx Sverige, Spanien eller Indonesien" : undefined}
                readOnly={isDanishPhysicalEvent}
                required
                value={country}
              />
            </label>

            {isDanishPhysicalEvent ? (
              <div className="grid min-w-0 gap-2 text-sm font-medium text-ink/72">
                <span>Område</span>
                <input name="region_id" type="hidden" value={regionId} />
                <div className="flex min-h-12 items-center rounded-card border border-[#D7C4F0] bg-[#F8F3FF] px-4 text-base text-ink">
                  {selectedRegionName || "Område beregnes automatisk ud fra postnummer"}
                </div>
              </div>
            ) : (
              <TextInput label="Region / område" name="foreign_region" placeholder="Fx Skåne, Mallorca eller Bali" help="Valgfrit. Bruges kun som ekstra lokationshjælp ved events uden for Danmark." maxLength={80} />
            )}

            <label className="flex items-start gap-3 rounded-card border border-[#E5D4F7] bg-[#FAF6EF] p-4 text-sm text-ink/72 md:col-span-2">
              <input
                checked={isForeignLocation}
                className="mt-1 size-4 accent-[#7A4EAB]"
                onChange={(event) => {
                  const checked = event.target.checked;
                  setIsForeignLocation(checked);
                  setPostalCodeMessage("");
                  if (checked) {
                    setCountry("");
                    setRegionId("");
                  } else {
                    setCountry("Danmark");
                    if (postalCode.length === 4) {
                      setRegionFromPostalCode(postalCode);
                    }
                  }
                  window.setTimeout(() => {
                    writeDraft();
                    showPreview();
                    refreshFormValidationState();
                  }, 0);
                }}
                type="checkbox"
              />
              <span>
                <span className="block font-semibold text-ink">Lokation udenfor Danmark</span>
                <span className="mt-1 block leading-6">
                  Brug denne, hvis eventet foregår i udlandet. Så kan adresse, postnummer og område udfyldes frit.
                </span>
              </span>
            </label>
          </div>
        ) : null}
        {showOnline ? (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <div className="grid gap-3">
              {sendOnlineLinkLater ? (
                <div className="grid gap-3 rounded-card border border-[#CFE3C8] bg-[#F6FBF3] p-4 text-sm text-ink/72">
                  <input name="online_url_or_note" type="hidden" value={onlineLinkLaterText} />
                  <p className="font-semibold text-[#4B6B45]">{onlineLinkLaterText}</p>
                  <button
                    className="justify-self-start text-sm font-semibold text-[#7A5D91] underline-offset-4 hover:underline"
                    onClick={() => {
                      setSendOnlineLinkLater(false);
                      setFormVersion((version) => version + 1);
                      window.setTimeout(() => {
                        writeDraft();
                        showPreview();
                        refreshFormValidationState();
                      }, 0);
                    }}
                    type="button"
                  >
                    Indsæt link nu i stedet
                  </button>
                </div>
              ) : (
                <TextInput
                  defaultValue={value(draftEvent?.online_url_or_note)}
                  help="Indsæt et direkte link til møderum eller bookingside."
                  label="Online-link"
                  maxLength={500}
                  name="online_url_or_note"
                  placeholder="https://..."
                  required
                  type="url"
                />
              )}
              {!sendOnlineLinkLater ? (
                <button
                  className="inline-flex min-h-12 items-center justify-center rounded-card border border-[#D8CBE4] bg-white px-4 text-center text-sm font-semibold text-[#7A5D91] transition hover:-translate-y-0.5 hover:border-[#7A5D91]"
                  onClick={() => {
                    setSendOnlineLinkLater(true);
                    setFormVersion((version) => version + 1);
                    window.setTimeout(() => {
                      writeDraft();
                      showPreview();
                      refreshFormValidationState();
                    }, 0);
                  }}
                  type="button"
                >
                  {onlineLinkLaterText}
                </button>
              ) : null}
            </div>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              <span>Platform</span>
              <select
                className="h-12 w-full min-w-0 rounded-card border border-midnight/15 bg-white px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA]"
                name="online_platform"
              >
                <option value="">Vælg platform, hvis du vil</option>
                <option value="Zoom">Zoom</option>
                <option value="Teams">Teams</option>
                <option value="Google Meet">Google Meet</option>
                <option value="Andet">Andet</option>
              </select>
            </label>
            <div className="md:col-span-2">
              <TextArea
                defaultValue={value(draftEvent?.online_description)}
                label="Hvordan får deltageren adgang?"
                name="online_description"
                placeholder="Fx Link til online møderum sendes efter tilmelding." maxLength={500}
              />
            </div>
          </div>
        ) : null}
      </section>
          {renderStepAccordionHeader(2)}
      

      
<section className={isStepOpen(2) ? "grid w-full min-w-0 max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft transition sm:gap-5 sm:p-6 " + highlightMissingClass(highlightedMissingKey === "capacity" ? "capacity" : "price-mode") : "hidden"} id="event-price-field">
        {priceMode === "" ? (
          <p className="rounded-card border border-[#D8CBE4] bg-[#FAF6EF] px-4 py-3 text-sm leading-6 text-ink/64">
            Vælg først gratis eller betaling i trinlinjen ovenfor.
          </p>
        ) : null}
        <div className="grid min-w-0 gap-4 md:grid-cols-2 md:items-stretch">
          {priceMode === "paid" ? (
            <label className="grid min-h-[180px] content-start gap-3 rounded-card border border-[#E5D4F7] bg-white p-5 text-sm font-medium text-ink/72 shadow-soft">
              <span>Pris i kr.</span>
              <input
                autoComplete="off"
                className={"h-12 w-full min-w-0 rounded-card border px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] " + fieldStateClass(priceValue)}
                inputMode="numeric"
                maxLength={5}
                name="price"
                onChange={(event) => handlePriceChange(event.currentTarget.value)}
                pattern="[0-9]*"
                type="text"
                value={priceValue}
              />
              <span className="text-xs leading-5 text-ink/52">Pris inklusive moms.</span>
            </label>
          ) : (
            <input name="price" type="hidden" value="0" />
          )}

          {priceMode === "free" ? (
            <div className="grid min-h-[180px] content-start gap-3 rounded-card border border-[#E5D4F7] bg-white p-5 text-sm text-ink/70 shadow-soft">
              <h3 className="text-base font-semibold text-midnight">Gratis</h3>
              <p className="leading-6">Dette event er gratis for deltagerne.</p>
            </div>
          ) : null}

          <label className="grid min-h-[180px] content-start gap-3 rounded-card border border-[#E5D4F7] bg-white p-5 text-sm font-medium text-ink/72 shadow-soft">
            <span className="text-base font-semibold text-midnight">Maks. antal deltagere</span>
            <input
              autoComplete="off"
              className={"h-12 w-full min-w-0 rounded-card border px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] " + fieldStateClass(capacityValue)}
              inputMode="numeric"
              maxLength={3}
              name="capacity"
              onChange={(event) => {
                const normalizedValue = event.currentTarget.value.replace(/\D/g, "").slice(0, 3);
                setCapacityValue(normalizedValue);
              }}
              pattern="[0-9]*"
              type="text"
              value={capacityValue}
            />
            <span className="text-xs leading-5 text-ink/52">Maks. 500 deltagere.</span>
          </label>
        </div>

        <input name="payment_method_source" type="hidden" value={effectivePaymentMethodSource} />
        <input name="payment_mobilepay_number" type="hidden" value={priceMode === "paid" && sendPaymentInfo ? paymentMobilepayNumber : ""} />
        <input name="payment_bank_registration_number" type="hidden" value={priceMode === "paid" && sendPaymentInfo ? paymentBankRegistrationNumber : ""} />
        <input name="payment_bank_account_number" type="hidden" value={priceMode === "paid" && sendPaymentInfo ? paymentBankAccountNumber : ""} />
        <input name="payment_bank_account_name" type="hidden" value={priceMode === "paid" && sendPaymentInfo ? paymentBankAccountName : ""} />
        <input name="payment_external_url" type="hidden" value={priceMode === "paid" && sendPaymentInfo ? paymentExternalUrl : ""} />
        <input name="payment_instructions" type="hidden" value={priceMode === "paid" && sendPaymentInfo ? paymentInstructions : ""} />
        <input name="payment_deadline_days" type="hidden" value={priceMode === "paid" && sendPaymentInfo ? paymentDeadlineDays : ""} />

        {priceMode === "paid" ? (
          <section className="grid min-w-0 gap-4 rounded-card border border-[#E5D4F7] bg-[#FBF8FE] p-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#7A4EAB] shadow-soft">
                <CreditCard className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-midnight">Betalingsoplysninger til bekræftelsesmailen</h3>
                <p className="mt-1 text-sm leading-6 text-ink/62">
                  Disse betalingsoplysninger sendes kun til de deltagere, du bekræfter. De vises ikke på dit event
                  eller din arrangørprofil og kan tilpasses for dette event.
                </p>
              </div>
            </div>

            <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-card border border-midnight/10 bg-white p-4 text-sm text-midnight shadow-soft transition hover:border-[#7A4EAB]/35">
              <input
                checked={sendPaymentInfo}
                className="mt-1 size-5 rounded border-midnight/20 accent-[#7A4EAB]"
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setSendPaymentInfo(checked);
                  if (!checked) {
                    setIsPaymentFormOpen(false);
                  }
                }}
                type="checkbox"
              />
              <span>
                <span className="block font-semibold">Send betalingsoplysninger til deltageren</span>
                <span className="mt-1 block leading-6 text-ink/62">
                  Slå fra, hvis betalingen aftales direkte mellem dig og deltageren.
                </span>
              </span>
            </label>

            {sendPaymentInfo ? (
              <div className="grid min-w-0 gap-4">
                {hasStandardPaymentSettings ? (
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-card border border-sage-700/15 bg-sage-50 px-4 py-3 text-sm text-sage-700">
                    <span className="font-semibold">✓ Standardbetalingsoplysninger anvendes.</span>
                    <button
                      className="inline-flex min-w-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-center text-sm font-semibold text-[#7A4EAB] shadow-soft transition hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(47,36,55,0.10)] focus:outline-none focus:ring-4 focus:ring-[#CDB4EA]"
                      onClick={() => setIsPaymentFormOpen((isOpen) => !isOpen)}
                      type="button"
                    >
                      <span aria-hidden="true">{isPaymentFormOpen ? "▲" : "▼"}</span>
                      Tilpas betalingsoplysninger
                    </button>
                  </div>
                ) : (
                  <div className="grid min-w-0 gap-3 rounded-card border border-[#E5D4F7] bg-white px-4 py-4 text-sm text-ink/68 shadow-soft">
                    <p className="font-semibold text-midnight">Du har endnu ikke opsat standardbetalingsoplysninger.</p>
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <Link
                        className="inline-flex h-11 min-w-0 items-center justify-center rounded-full bg-[#7A4EAB] px-5 text-center text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(122,78,171,0.22)] focus:outline-none focus:ring-4 focus:ring-[#CDB4EA]"
                        href="/facilitator/settings/payment"
                      >
                        Opsæt standardbetaling
                      </Link>
                      <button
                        className="text-sm font-semibold text-[#7A4EAB] underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-[#CDB4EA]"
                        onClick={() => setIsPaymentFormOpen(true)}
                        type="button"
                      >
                        eller udfyld betalingsoplysninger kun for dette event
                      </button>
                    </div>
                  </div>
                )}

                <div
                  className={
                    "grid overflow-hidden transition-all duration-300 ease-out " +
                    (isPaymentFormOpen ? "max-h-[1400px] gap-4 opacity-100" : "max-h-0 gap-0 opacity-0")
                  }
                >
                  {paymentFieldsDifferFromStandard ? (
                    <span className="w-fit rounded-full bg-[#F2ECF8] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#7A4EAB]">
                      Tilpasset til dette event
                    </span>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight">
                    MobilePay
                    <input
                      className="h-12 min-w-0 rounded-card border border-midnight/10 bg-white px-4 text-sm font-normal text-midnight outline-none transition focus:border-[#7A4EAB] focus:ring-4 focus:ring-[#CDB4EA]"
                      maxLength={40}
                      onChange={(event) => {
                        setPaymentFieldsEdited(true);
                        setPaymentMobilepayNumber(event.currentTarget.value);
                      }}
                      placeholder="MobilePay-nummer"
                      value={paymentMobilepayNumber}
                    />
                  </label>
                  <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight">
                    Betalingslink
                    <input
                      className="h-12 min-w-0 rounded-card border border-midnight/10 bg-white px-4 text-sm font-normal text-midnight outline-none transition focus:border-[#7A4EAB] focus:ring-4 focus:ring-[#CDB4EA]"
                      maxLength={300}
                      onChange={(event) => {
                        setPaymentFieldsEdited(true);
                        setPaymentExternalUrl(event.currentTarget.value);
                      }}
                      placeholder="Indsæt betalingslink"
                      value={paymentExternalUrl}
                    />
                  </label>
                  <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight">
                    Registreringsnummer
                    <input
                      className="h-12 min-w-0 rounded-card border border-midnight/10 bg-white px-4 text-sm font-normal text-midnight outline-none transition focus:border-[#7A4EAB] focus:ring-4 focus:ring-[#CDB4EA]"
                      maxLength={20}
                      onChange={(event) => {
                        setPaymentFieldsEdited(true);
                        setPaymentBankRegistrationNumber(event.currentTarget.value);
                      }}
                      placeholder="Registreringsnummer"
                      value={paymentBankRegistrationNumber}
                    />
                  </label>
                  <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight">
                    Kontonummer
                    <input
                      className="h-12 min-w-0 rounded-card border border-midnight/10 bg-white px-4 text-sm font-normal text-midnight outline-none transition focus:border-[#7A4EAB] focus:ring-4 focus:ring-[#CDB4EA]"
                      maxLength={40}
                      onChange={(event) => {
                        setPaymentFieldsEdited(true);
                        setPaymentBankAccountNumber(event.currentTarget.value);
                      }}
                      placeholder="Kontonummer"
                      value={paymentBankAccountNumber}
                    />
                  </label>
                  <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight">
                    Kontohaver
                    <input
                      className="h-12 min-w-0 rounded-card border border-midnight/10 bg-white px-4 text-sm font-normal text-midnight outline-none transition focus:border-[#7A4EAB] focus:ring-4 focus:ring-[#CDB4EA]"
                      maxLength={120}
                      onChange={(event) => {
                        setPaymentFieldsEdited(true);
                        setPaymentBankAccountName(event.currentTarget.value);
                      }}
                      placeholder="Kontohaver"
                      value={paymentBankAccountName}
                    />
                  </label>
                  <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight">
                    Betalingsfrist
                    <select
                      className="h-12 min-w-0 rounded-card border border-midnight/10 bg-white px-4 text-sm font-normal text-midnight outline-none transition focus:border-[#7A4EAB] focus:ring-4 focus:ring-[#CDB4EA]"
                      onChange={(event) => {
                        setPaymentFieldsEdited(true);
                        setPaymentDeadlineDays(event.currentTarget.value);
                      }}
                      value={paymentDeadlineOptions.some((option) => option.value === paymentDeadlineDays) ? paymentDeadlineDays : "14"}
                    >
                      {paymentDeadlineOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight md:col-span-2">
                    Betalingsvejledning
                    <textarea
                      className="min-h-28 min-w-0 resize-y rounded-card border border-midnight/10 bg-white px-4 py-3 text-sm font-normal leading-6 text-midnight outline-none transition focus:border-[#7A4EAB] focus:ring-4 focus:ring-[#CDB4EA]"
                      maxLength={800}
                      onChange={(event) => {
                        setPaymentFieldsEdited(true);
                        setPaymentInstructions(event.currentTarget.value);
                      }}
                      placeholder="Skriv betalingsvejledning til dette event"
                      value={paymentInstructions}
                    />
                  </label>
                  </div>

                  <p className="text-sm leading-6 text-ink/58">
                    Ændringer her gælder kun dette event og ændrer ikke dine standardbetalingsoplysninger.
                  </p>
                </div>
              </div>
            ) : null}

            {!sendPaymentInfo ? (
              <p className="rounded-card bg-white px-4 py-3 text-sm leading-6 text-ink/62">
                Betalingen aftales direkte mellem dig og deltageren. Der sendes ingen betalingsoplysninger.
              </p>
            ) : null}
          </section>
        ) : null}
      </section>

<section className={isStepOpen(2) ? "grid w-full min-w-0 max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        <details className="rounded-card border border-[#E5D4F7] bg-[#FAF6EF] p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[#7A4EAB] [&::-webkit-details-marker]:hidden">
            Tilføj praktiske oplysninger
          </summary>
          <div className="mt-4">
            <TextArea
              label="Særlige oplysninger til deltagere"
              defaultValue={value(draftEvent?.practical_information)}
              name="practical_information"
              placeholder="Medbring yogamåtte. Kom i behageligt tøj. Dørene åbner 15 minutter før."
              help="Valgfrit. Brug kun feltet, hvis der er noget praktisk deltageren skal vide." maxLength={1500}
            />
          </div>
        </details>
      </section>


          {renderStepAccordionHeader(3)}
      <section className={isStepOpen(3) ? "grid w-full min-w-0 max-w-full gap-5 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft transition sm:gap-6 sm:p-6 " + highlightMissingClass("category") : "hidden"} id="event-category-field">
        {draftEvent?.subcategoryIds?.map((subcategoryId) => (
          <input key={subcategoryId} name="subcategory_ids" type="hidden" value={subcategoryId} />
        ))}
        <div>
          <h2 className="text-lg font-semibold text-midnight">Vælg 1-3 kategorier, som bedst beskriver dit event.</h2>
          <p className="mt-1 text-sm leading-6 text-ink/60">Du kan vælge op til 3 kategorier og op til 4 tags.</p>
          {categoryLimitMessage ? (
            <p className="mt-3 rounded-card border border-[#E8D2CC] bg-[#FFF8F6] px-4 py-3 text-sm font-semibold text-[#8B5B68]">
              {categoryLimitMessage}
            </p>
          ) : null}
        </div>
        {mainCategories.length > 0 && (
          <div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mainCategories.map((category, index) => (
                <MainCategoryCard
                  category={category}
                  checked={selectedMainCategoryIds.includes(category.id)}
                  key={category.id}
                  onChange={(checked) => updateMainCategory(category.id, checked)}
                  priority={index < 3}
                />
              ))}
            </div>
          </div>
        )}
        {sortedTags.length > 0 && (
          <details className="rounded-card border border-[#E5D4F7] bg-[#FAF6EF] p-4">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full bg-[#7A5D91] px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-[#6E5285] [&::-webkit-details-marker]:hidden">
              <Tags className="size-4" aria-hidden="true" />
              Tilføj tags (valgfrit)
            </summary>
            <p className="mt-3 text-sm leading-6 text-ink/64">
              Tags er valgfrie ekstra filtre som begynder, gratis, weekend, udendørs eller online.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {sortedTags.map((tag) => (
                <TagPill
                  checked={selectedTagIds.includes(tag.id)}
                  key={tag.id}
                  onChange={(checked) => updateTag(tag.id, checked)}
                  tag={tag}
                />
              ))}
            </div>
          </details>
        )}
      </section>
</div>
        <aside className="mt-8 min-w-0 max-w-full border-t border-[#E5D4F7] pt-8 xl:mt-0 xl:border-t-0 xl:pt-0">
          <div className="w-full max-w-full overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 shadow-soft xl:sticky xl:top-6">
            <div className="border-b border-[#E5D4F7] bg-[#F4F0F7] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Din invitation</p>
              <h2 className="mt-1 font-serif text-xl font-semibold text-midnight">Sådan ser din invitation ud</h2>
            </div>
            <div
              className={"relative h-44 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#F4F0F7_0%,transparent_34%),radial-gradient(circle_at_85%_15%,#DDE8D7_0%,transparent_32%),linear-gradient(135deg,#FAF6EF_0%,#F8F3FA_48%,#EEE7DA_100%)] transition " + highlightMissingClass("cover")}
              id="event-cover-field"
            >
              {currentCoverImageUrl ? (
                <img alt="Preview af eventets forsidebillede" className="h-full w-full object-cover" src={currentCoverImageUrl} />
              ) : null}
              <label className="absolute inset-0 grid cursor-pointer place-items-center bg-midnight/5 transition hover:bg-midnight/10">
                  <input
                  accept={imageUploadAccept}
                  className="sr-only"
                  id="event-cover-file"
                  name="event_cover_file"
                  onChange={handleCoverFileChange}
                  ref={coverFileInputRef}
                  type="file"
                />
                <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#7A5D91] shadow-soft">
                  <ImagePlus className="size-4" aria-hidden="true" />
                  {currentCoverImageUrl ? "Udskift billede" : "Vælg billede"}
                </span>
              </label>
            </div>
            <p className="border-b border-[#E5D4F7] px-5 py-2 text-xs font-semibold text-[#6E6475]">{supportedImageUploadText}</p>
            {coverFileName ? <p className="border-b border-[#E5D4F7] px-5 py-2 text-xs font-semibold text-[#7A4EAB]">Valgt fil: {coverFileName}</p> : null}
            {coverImageErrorMessage ? (
              <p className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold leading-6 text-red-900">{coverImageErrorMessage}</p>
            ) : null}
            <div className="grid gap-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#B56F8A]">
                  {preview?.format || (eventFormat === "online" ? "Virtuelt event" : "Personligt event")}
                </p>
                <h3 className="mt-2 font-serif text-2xl font-semibold leading-tight text-midnight">
                  {preview?.title || "Eventtitel"}
                </h3>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-ink/64">
                  {preview?.description || "Beskrivelsen vises her, mens du udfylder eventet."}
                </p>
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="rounded-card bg-[#FAF6EF] px-3 py-2">
                  <dt className="font-semibold text-ink/55">Dato og tid</dt>
                  <dd className="mt-1 text-midnight">{preview ? preview.date + " · " + preview.time : formatReviewDate(startDate) + " · " + startTime + " - " + endTime}</dd>
                </div>
                <div className="rounded-card bg-[#FAF6EF] px-3 py-2">
                  <dt className="font-semibold text-ink/55">Sted</dt>
                  <dd className="mt-1 text-midnight">{preview?.location || (eventFormat === "online" ? "Online" : city || "Lokation mangler")}</dd>
                </div>
                <div className="rounded-card bg-[#FAF6EF] px-3 py-2">
                  <dt className="font-semibold text-ink/55">Pris</dt>
                  <dd className="mt-1 text-midnight">{preview?.price || (isFree ? "Gratis" : priceValue ? priceValue + " kr." : "Pris mangler")}</dd>
                </div>
              </dl>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Valgte retninger</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(preview?.categories.length ? preview.categories : []).map((category) => (
                    <span className="rounded-full bg-[#F4F0F7] px-3 py-1 text-xs font-semibold text-[#6E5A86]" key={category}>{category}</span>
                  ))}
                  {!preview?.categories.length ? <span className="text-sm text-ink/45">Ingen valgt endnu</span> : null}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {renderSubmitPanel()}

      {coverCrop ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/45 px-4 py-6 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-card border border-[#D8CBE4] bg-white p-4 shadow-lift sm:p-6">
            <div className="grid gap-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Eventbillede</p>
              <h2 className="font-serif text-3xl font-semibold text-midnight">Tilpas dit eventbillede</h2>
              <p className="text-sm leading-6 text-ink/64">
                Træk direkte i billedet med mus eller finger, og brug zoom-knapperne til at finde det rigtige udsnit.
              </p>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="mb-2 text-sm font-semibold text-midnight">Sådan vil dit event se ud</p>
                <div
                  className="relative aspect-video touch-none overflow-hidden rounded-card border-4 border-[#D8CBE4] bg-[#F4F0F7] cursor-grab active:cursor-grabbing"
                  onPointerCancel={stopCoverCropDrag}
                  onPointerDown={startCoverCropDrag}
                  onPointerMove={moveCoverCrop}
                  onPointerUp={stopCoverCropDrag}
                  onTouchCancel={stopCoverCropPinch}
                  onTouchEnd={stopCoverCropPinch}
                  onTouchMove={moveCoverCropPinch}
                  onTouchStart={startCoverCropPinch}
                >
                  {(() => {
                    const preview = getCoverCropPreview(coverCrop);

                    return (
                      <svg
                        aria-label="Beskæring af eventets forsidebillede"
                        className="absolute inset-0 size-full"
                        preserveAspectRatio="none"
                        role="img"
                        viewBox="0 0 1600 900"
                      >
                        <image
                          height={preview.height}
                          href={coverCrop.url}
                          preserveAspectRatio="none"
                          width={preview.width}
                          x={preview.x}
                          y={preview.y}
                        />
                      </svg>
                    );
                  })()}
                  <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-2 ring-white/80 ring-inset" />
                </div>
              </div>
              <div className="grid content-start gap-4 rounded-card bg-[#FAF6EF] p-4">
                <div>
                  <p className="text-sm font-semibold text-midnight">Zoom</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      className="inline-flex h-12 items-center justify-center rounded-button border border-[#D8CBE4] bg-white text-2xl font-semibold text-[#7A5D91]"
                      onClick={() => updateCoverCropZoom("out")}
                      type="button"
                    >
                      {"−"}
                    </button>
                    <button
                      className="inline-flex h-12 items-center justify-center rounded-button border border-[#D8CBE4] bg-white text-2xl font-semibold text-[#7A5D91]"
                      onClick={() => updateCoverCropZoom("in")}
                      type="button"
                    >
                      {"+"}
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink/64">Træk i billedet for at flytte udsnittet.</p>
                </div>
                <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-1">
                  <button
                    className="inline-flex h-11 items-center justify-center rounded-button bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft"
                    onClick={applyCoverCrop}
                    type="button"
                  >
                    Gem beskåret billede
                  </button>
                  <button
                    className="inline-flex h-11 items-center justify-center rounded-button border border-midnight/15 bg-white px-5 text-sm font-semibold text-midnight"
                    onClick={() => {
                      if (coverFileInputRef.current) {
                        coverFileInputRef.current.value = "";
                      }

                      setCoverFileName("");
                      closeCoverCrop();
                    }}
                    type="button"
                  >
                    Vælg andet billede
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

    </form>
  );
}
