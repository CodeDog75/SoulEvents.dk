"use client";

import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Eye,
  HeartHandshake,
  ImagePlus,
  Mail,
  MapPin,
  MonitorSmartphone,
  Save,
  Send,
  Sparkles,
  Tags,
  Ticket,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createEventAction } from "@/app/facilitator/events/actions";

type Region = {
  id: string;
  name: string;
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
};

type EventFormProps = {
  regions: Region[];
  categories: Category[];
  mainCategories?: MainCategory[];
  subcategories?: Subcategory[];
  tags?: Tag[];
  draftEvent?: DraftEvent | null;
  initialStep?: number;
  message?: string;
  facilitator: {
    contactEmail: string;
    contactPhone: string | null;
    regionId: string | null;
    addressLine: string | null;
    postalCode: string | null;
    city: string | null;
  };
};

type Step = {
  icon: ReactNode;
  label: string;
  title: string;
};

function value(input: string | number | null | undefined) {
  return input === null || input === undefined ? "" : String(input);
}

function fieldStateClass(value: string, options: { auto?: boolean; error?: boolean } = {}) {
  if (options.error) return "border-[#D97A7A] bg-[#FFF3F3]";
  if (value.trim()) return "border-[#D7C4F0] bg-[#F8F3FF]";
  if (options.auto) return "border-[#D7C4F0] bg-[#F8F3FF]";
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
  onChange,
}: {
  category: MainCategory;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const color = category.colorHex || "#7A5D91";
  const categoryBackground = category.imageUrl
    ? "linear-gradient(135deg, rgba(47,36,55,0.48), rgba(122,93,145,0.22)), url(" + category.imageUrl + ") center/cover"
    : "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.76), transparent 42%), linear-gradient(135deg, " + color + "33, #F8F3FF)";

  return (
    <label
      className={
        "group relative min-h-[148px] cursor-pointer overflow-hidden rounded-[24px] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg " +
        (checked
          ? "-translate-y-0.5 border-[3px] border-[#7A5D91] opacity-100 shadow-[0_0_0_4px_rgba(122,93,145,0.15)]"
          : "border border-transparent opacity-65 shadow-soft")
      }
      style={{ background: categoryBackground }}
    >
      <input
        checked={checked}
        className="sr-only"
        name="main_category_ids"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
        value={category.id}
      />
      {!checked ? <span className="pointer-events-none absolute inset-0 bg-[#F4F0F7]/45" /> : null}
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

function TagPill({ checked, index, tag }: { checked?: boolean; index: number; tag: Tag }) {
  const [isChecked, setIsChecked] = useState(Boolean(checked));
  return (
    <label
      className={
        "inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 " +
        (isChecked ? "border-[#7A5D91] bg-[#7A5D91] text-white" : "border-[#D8CBE4] bg-white text-[#6E6475]")
      }
    >
      <input
        checked={isChecked}
        className="sr-only"
        name="tag_ids"
        onChange={(event) => setIsChecked(event.target.checked)}
        type="checkbox"
        value={tag.id}
      />
      {isChecked ? <span aria-hidden="true">{"✓"}</span> : null}
      {tag.name}
    </label>
  );
}

function openNativePicker(input: HTMLInputElement) {
  try {
    (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
  } catch {
    input.focus();
  }
}

const eventDraftStorageKey = "soulevents:event-form-draft:v1";
const maxEventDescriptionLength = 2000;


function getEventImageMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("billedet") || normalized.includes("eventbillede") || normalized.includes("forsidebillede")) {
    return message;
  }

  return "";
}

const quarterHourOptions = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return hours + ":" + minutes;
});

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

  return (
    <label className="grid gap-2 text-sm font-medium text-ink/72">
      <span>
        {label}
        {required ? <span className="ml-1 text-[#B56F8A]">*</span> : null}
      </span>
      <div className="relative">
        <select
          className="h-12 w-full min-w-0 cursor-pointer appearance-none rounded-card border border-midnight/15 bg-white required:valid:bg-[#F8F3FF] required:valid:border-[#D7C4F0] py-0 pl-4 pr-12 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA]"
          name={name}
          onChange={(event) => onChange?.(event.target.value)}
          value={selectedValue ?? defaultValue}
        >
          {quarterHourOptions.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
        <Clock3 className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-midnight/70" aria-hidden="true" />
      </div>
    </label>
  );
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
  "3700": "Rønne",
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

function normalizeRegionName(input: string) {
  return input
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .replaceAll("Å", "aa")
    .replace(/[^a-z0-9]/g, "");
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

function TextInput({
  label,
  name,
  required,
  defaultValue,
  type = "text",
  placeholder,
  help,
  maxLength,
  step,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  help?: string;
  maxLength?: number;
  step?: string;
}) {
  const [inputCharacterCount, setInputCharacterCount] = useState(defaultValue?.length ?? 0);

  return (
    <label className="grid gap-2 text-sm font-medium text-ink/72">
      <span>
        {label}
        {required ? <span className="ml-1 text-[#B56F8A]">*</span> : null}
      </span>
      <input
        className="h-12 w-full min-w-0 rounded-card border border-midnight/15 bg-white required:valid:bg-[#F8F3FF] required:valid:border-[#D7C4F0] px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA]"
        defaultValue={defaultValue}
        maxLength={maxLength}
        name={name}
        onInput={(event) => setInputCharacterCount(event.currentTarget.value.length)}
        placeholder={placeholder}
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
  return (
    <label className="grid gap-2 text-sm font-medium text-ink/72">
      <span>
        {label}
        {required ? <span className="ml-1 text-[#B56F8A]">*</span> : null}
      </span>
      <textarea
        className={minHeight + " w-full min-w-0 rounded-card border border-midnight/15 bg-white required:valid:bg-[#F8F3FF] required:valid:border-[#D7C4F0] p-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA]"}
        defaultValue={defaultValue}
        maxLength={maxLength}
        name={name}
        placeholder={placeholder}
      />
      {help ? <span className="text-xs leading-5 text-ink/52">{help}</span> : null}
    </label>
  );
}

function EventDescriptionField({ defaultValue = "" }: { defaultValue?: string }) {
  const [characterCount, setCharacterCount] = useState(defaultValue.length);
  const remainingCharacters = maxEventDescriptionLength - characterCount;
  const isAtLimit = remainingCharacters <= 0;

  return (
    <label className="grid gap-2 text-sm font-medium text-ink/72">
      <span>
        Beskrivelse af event<span className="ml-1 text-[#B56F8A]">*</span>
      </span>
      <textarea
        className="min-h-40 w-full min-w-0 rounded-card border border-midnight/15 bg-white required:valid:!bg-[#F0E3FF] required:valid:!border-[#B894D6] p-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA]"
        maxLength={maxEventDescriptionLength}
        defaultValue={defaultValue}
        name="event_description"
        onInput={(event) => setCharacterCount(event.currentTarget.value.length)}
        placeholder="Vi mødes til en rolig aften med guidet meditation, nærvær og fællesskab. Eventet er åbent for både begyndere og øvede. Medbring gerne en yogamåtte og behageligt tøj."
        required
      />
      <span className="text-xs leading-5 text-ink/52">
        Fortæl kort, hvad der skal ske, hvem eventet er for, og hvad deltagerne kan forvente. Du kan også nævne, hvis deltagerne skal medbringe noget særligt.
      </span>
      <span className={isAtLimit ? "text-xs font-semibold text-[#9A3F3F]" : "text-xs font-semibold text-[#7A4EAB]"}>
        {remainingCharacters} tegn tilbage
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

function Tip({ children }: { children: ReactNode }) {
  return (
    <details className="rounded-card border border-[#E5D4F7] bg-[#FAF6EF] p-4 text-sm leading-6 text-ink/70">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[#7A4EAB] [&::-webkit-details-marker]:hidden">
        <Sparkles className="size-4" aria-hidden="true" />
        Gode råd
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function EventForm({
  regions,
  mainCategories = [],
  subcategories = [],
  tags = [],
  draftEvent = null,
  initialStep = 0,
  message,
  facilitator,
}: EventFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const draftStart = draftEvent?.starts_at ? new Date(draftEvent.starts_at) : null;
  const draftEnd = draftEvent?.ends_at ? new Date(draftEvent.ends_at) : null;
  const draftStartDate = draftStart ? draftStart.toISOString().slice(0, 10) : today;
  const draftEndDate = draftEnd ? draftEnd.toISOString().slice(0, 10) : draftStartDate;
  const draftStartTime = draftStart ? draftStart.toISOString().slice(11, 16) : "19:00";
  const draftEndTime = draftEnd ? draftEnd.toISOString().slice(11, 16) : "21:00";
  const formRef = useRef<HTMLFormElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentStep, setCurrentStep] = useState(() => Math.min(Math.max(initialStep, 0), 4));
  const [startDate, setStartDate] = useState(draftStartDate);
  const [endDate, setEndDate] = useState(draftEndDate);
  const [startTime, setStartTime] = useState(draftStartTime);
  const [endTime, setEndTime] = useState(draftEndTime);
  const [postalCode, setPostalCode] = useState(value(draftEvent?.postal_code ?? facilitator.postalCode));
  const [city, setCity] = useState(value(draftEvent?.city ?? facilitator.city));
  const [country, setCountry] = useState(value(draftEvent?.country ?? "Danmark") || "Danmark");
  const [regionId, setRegionId] = useState(value(draftEvent?.region_id ?? facilitator.regionId));
  const [postalCodeMessage, setPostalCodeMessage] = useState("");
  const [eventFormat, setEventFormat] = useState<"physical" | "online">(draftEvent?.event_format === "online" ? "online" : "physical");
  const [isFree, setIsFree] = useState((draftEvent?.price_cents ?? 0) === 0);
  const [selectedMainCategoryIds, setSelectedMainCategoryIds] = useState<string[]>(draftEvent?.mainCategoryIds ?? []);
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
  const showAddress = eventFormat === "physical";
  const showOnline = eventFormat === "online";
  const isDanishPhysicalEvent = showAddress && country.trim().toLowerCase() === "danmark";
  const selectedRegionName = regions.find((region) => region.id === regionId)?.name ?? "";
  const currentCoverImageUrl = coverPreviewUrl || draftEvent?.coverImageUrl || "";
  const hasExistingCoverImage = Boolean(draftEvent?.coverImageUrl || draftEvent?.cover_image_path);
  const statusHelp = useMemo(
    () =>
      "Når du gør eventet offentligt, bliver det enten sendt til godkendelse eller publiceret med det samme, hvis du har automatisk godkendelse.",
    [],
  );

  const durationLabel = useMemo(() => {
    const start = new Date(startDate + "T" + startTime + ":00");
    const end = new Date(endDate + "T" + endTime + ":00");
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
  }, [endDate, endTime, startDate, startTime]);

  const steps: Step[] = [
    { icon: <CalendarPlus className="size-4" />, label: "Start", title: "Det starter med en invitation" },
    { icon: <MapPin className="size-4" />, label: "Sted", title: "Beskriv oplevelsen" },
    { icon: <HeartHandshake className="size-4" />, label: "Indhold", title: "Gør eventet synligt" },
    { icon: <Tags className="size-4" />, label: "Kategorier", title: "Praktiske oplysninger" },
    { icon: <Mail className="size-4" />, label: "Gennemgang", title: "Gennemgå dit event" },
  ];

  const stepDescriptions = [
    "Giv dit event en titel, vælg dato og tidspunkt, og fortæl om oplevelsen foregår fysisk eller online. Resten tager vi sammen, trin for trin.",
    "Fortæl deltagerne, hvor eventet foregår, eller hvordan de deltager online.",
    "Beskriv stemningen, hvem eventet er for, og tilføj billeder der gør eventet levende.",
    "Vælg kategorier, pris og deltagerantal, så de rette mennesker kan finde dit event.",
    "Se de vigtigste oplysninger samlet, før du gør eventet offentligt.",
  ];


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
    const file = input.files?.[0];

    if (!file) {
      setCoverFileName("");
      setCoverPreviewUrl("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      input.value = "";
      setCoverFileName("");
      setCoverPreviewUrl("");
      setCoverImageErrorMessage("Vælg et billede i JPG, PNG, WebP eller GIF.");
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
      setIsFree(false);
    }
  }

  function handleFreeChange(checked: boolean) {
    setIsFree(checked);

    if (checked) {
      setPriceValue("0");
    }
  }

  function updateStartDate(nextDate: string) {
    setStartDate(nextDate);
    setEndDate(nextDate);
  }


  function setRegionFromPostalCode(nextPostalCode: string) {
    const regionSlug = regionSlugFromPostalCode(nextPostalCode);

    if (!regionSlug) {
      return;
    }

    const normalizedSlug = normalizeRegionName(regionSlug);
    const matchingRegion = regions.find((region) => normalizeRegionName(region.name) === normalizedSlug);

    if (matchingRegion) {
      setRegionId(matchingRegion.id);
    }
  }

  async function fetchPostalCodeCity(nextPostalCode: string) {
    try {
      const response = await fetch("https://api.dataforsyningen.dk/postnumre/" + nextPostalCode);

      if (!response.ok) {
        setPostalCodeMessage("Postnummeret kunne ikke valideres. Tjek at det består af 4 tal.");
        return;
      }

      const data = (await response.json()) as { navn?: string };

      if (data.navn) {
        setCity(data.navn);
        setPostalCodeMessage("By er opdateret ud fra postnummeret.");
      }
    } catch {
      setPostalCodeMessage("By er foreslået lokalt. Tjek gerne at adressen passer.");
    }
  }

  function handlePostalCodeChange(nextValue: string) {
    if (country.trim().toLowerCase() !== "danmark") {
      setPostalCode(nextValue);
      setPostalCodeMessage("");
      return;
    }

    const normalizedPostalCode = nextValue.replace(/\D/g, "").slice(0, 4);
    setPostalCode(normalizedPostalCode);

    if (normalizedPostalCode.length < 4) {
      setPostalCodeMessage("Skriv et postnummer på 4 tal.");
      return;
    }

    const localCity = postalCodeCities[normalizedPostalCode];

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
    setSelectedMainCategoryIds((current) =>
      checked ? [...current, categoryId] : current.filter((currentCategoryId) => currentCategoryId !== categoryId),
    );
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
    const tagNames = tags
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
    const onlineText = String(data.get("online_url_or_note") ?? data.get("online_description") ?? "").trim();
    const numericPrice = Number(priceValue.replace(",", "."));

    setPreview({
      title,
      description,
      format: eventFormat === "online" ? "Online event" : "Fysisk event",
      price: isFree || numericPrice <= 0 ? "Gratis" : priceValue + " kr.",
      date: startDateValue === endDateValue ? formatReviewDate(startDateValue) : formatReviewDate(startDateValue) + " - " + formatReviewDate(endDateValue),
      time: startTimeValue && endTimeValue ? startTimeValue + " - " + endTimeValue : "Tidspunkt mangler",
      location: eventFormat === "online" ? onlineText || "Online-link eller adgangstekst mangler" : address || "Adresse mangler",
      capacity: String(data.get("capacity") ?? "").trim() || "Ikke angivet",
      categories: categoryNames,
      tags: tagNames,
      coverImageUrl: currentCoverImageUrl,
    });
  }

  function goToStep(index: number) {
    const nextStep = Math.min(Math.max(index, 0), steps.length - 1);

    if (nextStep === steps.length - 1) {
      showPreview();
    }

    setCurrentStep(nextStep);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function readDraft() {
    try {
      const rawDraft = window.localStorage.getItem(eventDraftStorageKey);
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
      eventDraftStorageKey,
      JSON.stringify({
        fields,
        state: {
          city,
          country,
          endDate,
          endTime,
          eventFormat,
          isFree,

          postalCode,
          regionId,
          selectedMainCategoryIds,
          startDate,
          startTime,
        },
        savedAt: new Date().toISOString(),
      }),
    );
    setHasAutosavedDraft(true);
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
    setCountry(draft.state?.country ?? "Danmark");
    setRegionId(draft.state?.regionId ?? "");
    setEventFormat(draft.state?.eventFormat === "online" ? "online" : "physical");
    setIsFree(Boolean(draft.state?.isFree));
    setSelectedMainCategoryIds(Array.isArray(draft.state?.selectedMainCategoryIds) ? draft.state.selectedMainCategoryIds : []);

    window.requestAnimationFrame(() => {
      const form = formRef.current;
      const fields = draft.fields ?? {};

      if (!form) {
        return;
      }

      for (const [name, values] of Object.entries(fields) as Array<[string, string[]]>) {
        const controls = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name='" + name + "']"));

        controls.forEach((control, index) => {
          const valueAtIndex = values[index] ?? values[0] ?? "";

          if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
            control.checked = values.includes(control.value);
          } else {
            control.value = valueAtIndex;
          }
        });
      }
    });


  }

  function clearDraft() {
    window.localStorage.removeItem(eventDraftStorageKey);
    setHasAutosavedDraft(false);
    setAutosaveMessage("");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get("message") ?? "";

    const normalizedMessage = message.toLowerCase();
    const imageMessage = getEventImageMessage(message);

    if (imageMessage) {
      setCoverImageErrorMessage(imageMessage);
      setCurrentStep(2);
    }

    if (normalizedMessage.includes("oprettet") || normalizedMessage.includes("gemt")) {
      window.localStorage.removeItem(eventDraftStorageKey);
      return;
    }

    const hasDraft = Boolean(window.localStorage.getItem(eventDraftStorageKey));
    setHasAutosavedDraft(hasDraft);

    if (message && hasDraft) {
      window.setTimeout(restoreDraft, 0);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(writeDraft, 350);
    return () => window.clearTimeout(timeout);
  }, [city, country, endDate, endTime, eventFormat, isFree, postalCode, regionId, selectedMainCategoryIds, startDate, startTime]);

  return (
    <form
      action={createEventAction}
      className="grid w-full max-w-full gap-5 overflow-x-hidden sm:gap-6"
      noValidate
      onChange={writeDraft}
      onInput={writeDraft}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target instanceof HTMLElement && event.target.tagName !== "TEXTAREA") {
          event.preventDefault();
        }
      }}
      ref={formRef}
    >
      {draftEvent?.id ? <input name="event_id" type="hidden" value={draftEvent.id} /> : null}
      <input name="current_step" type="hidden" value={currentStep} />
      <section className="w-full max-w-full overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:p-5">
        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">
            🌿 Trin {currentStep + 1} af {steps.length}
          </p>
          <div className="grid gap-2">
            <h3 className="text-2xl font-semibold leading-tight text-midnight sm:text-3xl">
              {steps[currentStep].title}
            </h3>
            <p className="max-w-3xl text-sm leading-6 text-ink/68 sm:text-base">
              {stepDescriptions[currentStep]}
            </p>
          </div>
        </div>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#EDE4F7]">
          <div
            className="h-full rounded-full bg-[#7A4EAB] transition-all duration-300 ease-out"
            style={{ width: String((currentStep / (steps.length - 1)) * 100) + "%" }}
          />
        </div>
        <p className="mt-2 text-xs font-semibold text-[#7A4EAB] sm:text-sm">
          {Math.round((currentStep / (steps.length - 1)) * 100)}% gennemført
        </p>
      </section>

      <section className={currentStep === 0 ? "grid w-full max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        <div className="grid gap-4 md:grid-cols-2 md:gap-x-5 md:gap-y-4">
          <TextInput defaultValue={value(draftEvent?.title)} label="Eventtitel" maxLength={80} name="title" placeholder="Fx Fuldmåneceremoni og ro i skoven" required />
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span>
              Startdato<span className="ml-1 text-[#B56F8A]">*</span>
            </span>
            <input
              className="h-12 w-full min-w-0 cursor-pointer rounded-card border border-midnight/15 bg-white required:valid:bg-[#F8F3FF] required:valid:border-[#D7C4F0] px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA]"
              name="start_date"
              onClick={(event) => openNativePicker(event.currentTarget)}
              onChange={(event) => updateStartDate(event.target.value)}
              type="date"
              value={startDate}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span>
              Slutdato<span className="ml-1 text-[#B56F8A]">*</span>
            </span>
            <input
              className="h-12 w-full min-w-0 cursor-pointer rounded-card border border-midnight/15 bg-white required:valid:bg-[#F8F3FF] required:valid:border-[#D7C4F0] px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA]"
              min={startDate}
              name="end_date"
              onClick={(event) => openNativePicker(event.currentTarget)}
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
          <TimeSelect defaultValue="19:00" label="Starttidspunkt" name="start_time" onChange={setStartTime} required value={startTime} />
          <TimeSelect defaultValue="21:00" label="Sluttidspunkt" name="end_time" onChange={setEndTime} required value={endTime} />
          {durationLabel && (
            <div
              className={
                durationLabel.startsWith("Vælg")
                  ? "rounded-card border border-[#E6B8B8] bg-[#FBEAEA] px-4 py-3 text-sm font-semibold text-[#9A3F3F] md:col-span-2"
                  : "rounded-card border border-[#E5D4F7] bg-[#F6EFFF] px-4 py-3 text-sm font-semibold text-[#7A4EAB] md:col-span-2"
              }
            >
              {durationLabel}
            </div>
          )}
        </div>
        <EventDescriptionField defaultValue={value(draftEvent?.long_description || draftEvent?.short_description)} />
      </section>

      <section className={currentStep === 1 ? "grid w-full max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        <div>
          <p className="text-sm font-semibold text-midnight">Hvordan foregår eventet?</p>
          <p className="mt-1 text-sm leading-6 text-ink/64">
            Vælg fysisk event, hvis deltageren skal møde op på en adresse. Vælg online event, hvis det foregår digitalt.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { value: "physical", label: "Fysisk event", help: "Adresse og fremmøde.", icon: MapPin },
              { value: "online", label: "Online event", help: "Via link eller online møderum.", icon: MonitorSmartphone },
            ].map((option) => {
              const selected = eventFormat === option.value;
              const Icon = option.icon;

              return (
                <label
                  className={
                    "grid cursor-pointer gap-2 rounded-card p-4 text-sm font-semibold transition shadow-soft " +
                    (selected
                      ? "border-2 border-[#7A4EAB] bg-[#F6EFFF] text-midnight"
                      : "border border-midnight/15 bg-white text-midnight hover:border-[#D7C4F0] hover:bg-[#FBF7FF]")
                  }
                  key={option.value}
                >
                  <span className="flex items-center gap-3">
                    <input
                      checked={selected}
                      className="size-4 accent-[#7A4EAB]"
                      name="event_format"
                      onChange={() => setEventFormat(option.value as "physical" | "online")}
                      type="radio"
                      value={option.value}
                    />
                    <span
                      className={
                        "grid size-10 place-items-center rounded-full " +
                        (selected ? "bg-[#EDE4F7] text-[#7A4EAB]" : "bg-stone-100 text-ink/45")
                      }
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span>{option.label}</span>
                  </span>
                  <span className="text-xs font-normal leading-5 text-ink/55">{option.help}</span>
                </label>
              );
            })}
          </div>
        </div>
        {showAddress ? (
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput defaultValue={value(draftEvent?.address_line ?? facilitator.addressLine)} label="Adresse" name="address_line" required maxLength={120} />

            <label className="grid gap-2 text-sm font-medium text-ink/72">
              <span>
                Land<span className="ml-1 text-[#B56F8A]">*</span>
              </span>
              <input
                className={"h-12 w-full min-w-0 rounded-card border px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] " + fieldStateClass(country)}
                name="country"
                onChange={(event) => setCountry(event.target.value)}
                required
                value={country}
              />
              <span className="text-xs leading-5 text-ink/52">Skriv Danmark for danske events. Ved udenlandske retreats kan du skrive landet her.</span>
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink/72">
              <span>
                {isDanishPhysicalEvent ? "Postnummer" : "Postnummer / ZIP"}<span className="ml-1 text-[#B56F8A]">*</span>
              </span>
              <input
                className={"h-12 w-full min-w-0 rounded-card border px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] " + fieldStateClass(postalCode, { error: isDanishPhysicalEvent && postalCode.length > 0 && postalCode.length < 4 })}
                inputMode={isDanishPhysicalEvent ? "numeric" : "text"}
                maxLength={isDanishPhysicalEvent ? 4 : undefined}
                name="postal_code"
                onChange={(event) => (isDanishPhysicalEvent ? handlePostalCodeChange(event.target.value) : setPostalCode(event.target.value))}
                pattern={isDanishPhysicalEvent ? "[0-9]{4}" : undefined}
                required
                value={postalCode}
              />
              <span className="text-xs leading-5 text-ink/52">
                {isDanishPhysicalEvent
                  ? "By og område opdateres automatisk, når postnummeret er gyldigt."
                  : "For events uden for Danmark bruges postnummer/ZIP kun sammen med adresse, by og land."}
              </span>
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink/72">
              <span>
                By<span className="ml-1 text-[#B56F8A]">*</span>
              </span>
              <input
                className={"h-12 w-full min-w-0 rounded-card border px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] " + fieldStateClass(city, { auto: isDanishPhysicalEvent && Boolean(city) })}
                name="city"
                onChange={(event) => setCity(event.target.value)}
                readOnly={isDanishPhysicalEvent}
                required
                value={city}
              />
              {postalCodeMessage && isDanishPhysicalEvent ? <span className="text-xs leading-5 text-[#7A4EAB]">{postalCodeMessage}</span> : null}
            </label>

            {isDanishPhysicalEvent ? (
              <div className="grid gap-2 text-sm font-medium text-ink/72">
                <span>Område</span>
                <input name="region_id" type="hidden" value={regionId} />
                <div className="flex min-h-12 items-center rounded-card border border-[#D7C4F0] bg-[#F8F3FF] px-4 text-base text-ink">
                  {selectedRegionName || "Område beregnes automatisk ud fra postnummer"}
                </div>
                <span className="text-xs leading-5 text-ink/52">Område styres automatisk ud fra postnummer, så eventet vises korrekt i søgning og på kort.</span>
              </div>
            ) : (
              <TextInput label="Region / område" name="foreign_region" placeholder="Fx Skåne, Mallorca eller Bali" help="Valgfrit. Bruges kun som ekstra lokationshjælp ved events uden for Danmark." maxLength={80} />
            )}
          </div>
        ) : null}
        {showOnline ? (
          <div className="grid gap-4 md:grid-cols-2">
            <TextArea
              defaultValue={value(draftEvent?.online_url_or_note)}
              help="Linket deles kun med tilmeldte deltagere, hvis du ønsker det."
              label="Online-link / møderum"
              name="online_url_or_note"
              placeholder="Zoom-link, Teams-link eller tekst om at link sendes senere." maxLength={500}
            />
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
        <Tip>
          {showOnline ? (
            <p>Fortæl deltageren, om linket sendes efter tilmelding, eller om de får adgang via et fast møderum. Skriv også gerne, hvis de skal bruge kamera, headset eller have ro omkring sig.</p>
          ) : isDanishPhysicalEvent ? (
            <p>By og område beregnes automatisk ud fra postnummeret, så eventet bliver vist korrekt i søgning og på kort.</p>
          ) : (
            <p>Ved events uden for Danmark bruges adresse, by og land til at finde placeringen på kortet. Hvis kortet ikke rammer rigtigt, kan du justere adressen før publicering.</p>
          )}
        </Tip>
      </section>
      <section className={currentStep === 2 ? "grid w-full max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
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
              help="Valgfrit. Brug kun feltet, hvis der er noget praktisk deltageren skal vide." maxLength={800}
            />
          </div>
        </details>
      </section>

      <section className={currentStep === 2 ? "grid w-full max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        <input name="current_cover_image_path" type="hidden" value={value(draftEvent?.cover_image_path)} />
        <div className="rounded-card border border-[#E5D4F7] bg-[#FAF6EF] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#7A4EAB] shadow-sm">
              <ImagePlus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-midnight">Forsidebillede</p>
              <p className="mt-1 text-sm leading-6 text-ink/64">
                Vælg et billede der afspejler stemningen i dit event. Hvis det er nødvendigt, hjælper vi dig med at tilpasse billedet.
              </p>
            </div>
          </div>
          {currentCoverImageUrl ? (
            <div className="mt-4 overflow-hidden rounded-card border border-[#D8CBE4] bg-white">
              <img
                alt="Uploadet forsidebillede til eventet"
                className="h-52 w-full object-cover sm:h-64"
                src={currentCoverImageUrl}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D8CBE4] px-4 py-3">
                <p className="text-xs leading-5 text-ink/56">Du kan justere udsnittet, hvis billedet ikke sidder helt rigtigt.</p>
                <button
                  className="inline-flex h-10 items-center justify-center rounded-button border border-[#D8CBE4] bg-[#F4F0F7] px-4 text-sm font-semibold text-[#6E5A86] transition hover:bg-[#EFE8F5]"
                  onClick={reopenCoverCropTool}
                  type="button"
                >
                  Tilpas billede igen
                </button>
              </div>
            </div>
          ) : null}
          {hasExistingCoverImage ? (
            <div className="mt-4 rounded-card border border-[#D8CBE4] bg-[#F4F0F7] px-4 py-3 text-sm leading-6 text-[#4D4458]">
              <p className="font-semibold text-[#6E5A86]">Der er allerede valgt et forsidebillede til dette event.</p>
              <p>Hvis du vælger et nyt billede, erstattes det nuværende billede.</p>
            </div>
          ) : null}
          <label className="mt-4 grid gap-2 text-sm font-medium text-ink/72">
            <span>{hasExistingCoverImage ? "Udskift billede" : "Vælg billede"}</span>
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              name="event_cover_file"
              onChange={handleCoverFileChange}
              ref={coverFileInputRef}
              type="file"
            />
            <span className="inline-flex h-11 w-fit cursor-pointer items-center justify-center rounded-button bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-[#6E5285]">
              {hasExistingCoverImage ? "Vælg nyt billede" : "Vælg billede"}
            </span>
            {coverFileName ? <span className="text-xs font-semibold text-[#7A4EAB]">Valgt fil: {coverFileName}</span> : null}
            <span className="text-xs leading-5 text-ink/52">JPG, PNG, WebP eller GIF under 8 MB. Vi hjælper med at beskære billedet, hvis formatet ikke passer.</span>
            {coverImageErrorMessage ? (
              <span className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold leading-6 text-red-900">
                {coverImageErrorMessage}
              </span>
            ) : null}
          </label>
        </div>
      </section>

      <section className={currentStep === 3 ? "grid w-full max-w-full gap-5 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-6 sm:p-6" : "hidden"}>
        {draftEvent?.subcategoryIds?.map((subcategoryId) => (
          <input key={subcategoryId} name="subcategory_ids" type="hidden" value={subcategoryId} />
        ))}
        {mainCategories.length > 0 && (
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Vælg retning</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-midnight">Hvilket univers passer eventet ind i?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/64">
              Vælg en eller flere hovedkategorier. Underkategorier kan finjusteres af admin bagefter, så du ikke skal tage stilling til det hele nu.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mainCategories.map((category) => (
                <MainCategoryCard
                  category={category}
                  checked={selectedMainCategoryIds.includes(category.id)}
                  key={category.id}
                  onChange={(checked) => updateMainCategory(category.id, checked)}
                />
              ))}
            </div>
          </div>
        )}
        {tags.length > 0 && (
          <details className="rounded-card border border-[#E5D4F7] bg-[#FAF6EF] p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[#7A4EAB] [&::-webkit-details-marker]:hidden">
              Tilføj tags, hvis du vil hjælpe deltagerne med at finde eventet
            </summary>
            <p className="mt-3 text-sm leading-6 text-ink/64">
              Tags er valgfrie ekstra filtre som begynder, gratis, weekend, udendørs eller online.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {tags.map((tag, index) => (
                <TagPill checked={draftEvent?.tagIds?.includes(tag.id)} index={index} key={tag.id} tag={tag} />
              ))}
            </div>
          </details>
        )}
      </section>

      <section className={currentStep === 3 ? "grid w-full max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        <div className="grid gap-4 md:grid-cols-3 md:items-start">
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span>Pris i kr.</span>
            <input
              className="h-12 w-full min-w-0 rounded-card border border-midnight/15 bg-white px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA]"
              inputMode="numeric"
              maxLength={5}
              name="price"
              onChange={(event) => handlePriceChange(event.currentTarget.value)}
              pattern="[0-9]*"
              type="text"
              value={priceValue}
            />
            <span className="text-xs leading-5 text-ink/52">Pris inklusive moms. Skriv 0 hvis eventet er gratis.</span>
          </label>
          <TextInput defaultValue={String(draftEvent?.capacity ?? 12)} label="Maks. antal deltagere" name="capacity" type="number" />
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            <span className="hidden md:block">&nbsp;</span>
            <span className="flex h-12 items-center gap-3 rounded-card border border-[#E5D4F7] bg-[#FAF6EF] px-4 text-sm font-semibold text-midnight">
              <input checked={isFree} className="size-4 accent-[#7A4EAB]" onChange={(event) => handleFreeChange(event.target.checked)} type="checkbox" />
              Gratis event
            </span>
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput defaultValue={value(draftEvent?.contact_email ?? facilitator.contactEmail)} label="Kontakt e-mail" name="contact_email" type="email" maxLength={160} />
          <TextInput defaultValue={value(draftEvent?.contact_phone ?? facilitator.contactPhone)} label="Telefonnummer" name="contact_phone" maxLength={20} />
        </div>
        <p className="rounded-card border border-[#D8CBE4] bg-[#FAF6EF] px-4 py-3 text-sm leading-6 text-ink/64">
          Kontaktperson og sociale links hentes fra din arrangørprofil, så eventoprettelsen holdes enkel.
        </p>
      </section>

      <section className={currentStep === 4 ? "grid w-full max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Gennemgang</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-midnight">Gennemgå dit event</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/64">
            Tjek de vigtigste oplysninger, før du gør eventet offentligt. Du kan altid gå tilbage og rette.
          </p>
        </div>
        {preview ? (
          <article className="overflow-hidden rounded-card border border-[#E5D4F7] bg-[#FAF6EF]">
            {preview.coverImageUrl ? (
              <img alt="Forsidebillede til eventet" className="h-56 w-full object-cover sm:h-72" src={preview.coverImageUrl} />
            ) : (
              <div className="grid h-40 place-items-center bg-white text-sm font-semibold text-ink/52">
                Intet forsidebillede valgt endnu
              </div>
            )}
            <div className="grid gap-5 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#B56F8A]">{preview.format}</p>
                <h3 className="mt-2 font-serif text-3xl font-semibold text-midnight">{preview.title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink/70">{preview.description || "Beskrivelse mangler."}</p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-card bg-white p-3">
                  <dt className="font-semibold text-ink/55">Dato</dt>
                  <dd className="mt-1 text-midnight">{preview.date}</dd>
                </div>
                <div className="rounded-card bg-white p-3">
                  <dt className="font-semibold text-ink/55">Tidspunkt</dt>
                  <dd className="mt-1 text-midnight">{preview.time}</dd>
                </div>
                <div className="rounded-card bg-white p-3">
                  <dt className="font-semibold text-ink/55">Pris</dt>
                  <dd className="mt-1 text-midnight">{preview.price}</dd>
                </div>
                <div className="rounded-card bg-white p-3">
                  <dt className="font-semibold text-ink/55">Deltagere</dt>
                  <dd className="mt-1 text-midnight">{preview.capacity} pladser</dd>
                </div>
                <div className="rounded-card bg-white p-3 sm:col-span-2">
                  <dt className="font-semibold text-ink/55">Sted / online</dt>
                  <dd className="mt-1 text-midnight">{preview.location}</dd>
                </div>
              </dl>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Kategorier</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {preview.categories.length > 0 ? preview.categories.map((category) => (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#6E5A86]" key={category}>{category}</span>
                    )) : <span className="text-sm text-ink/55">Ingen kategori valgt endnu</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Tags</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {preview.tags.length > 0 ? preview.tags.map((tag) => (
                      <span className="rounded-full bg-[#7A5D91] px-3 py-1 text-xs font-semibold text-white" key={tag}>✓ {tag}</span>
                    )) : <span className="text-sm text-ink/55">Ingen tags valgt</span>}
                  </div>
                </div>
              </div>
              <p className="rounded-card border border-[#D8CBE4] bg-white px-4 py-3 text-sm leading-6 text-ink/64">{statusHelp}</p>
            </div>
          </article>
        ) : (
          <p className="rounded-card border border-[#D8CBE4] bg-[#FAF6EF] px-4 py-3 text-sm leading-6 text-ink/64">
            Gå til dette trin igen, hvis gennemgangen ikke er opdateret.
          </p>
        )}
      </section>

      {coverCrop ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/45 px-4 py-6 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-card border border-[#D8CBE4] bg-white p-4 shadow-lift sm:p-6">
            <div className="grid gap-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Forsidebillede</p>
              <h2 className="font-serif text-3xl font-semibold text-midnight">Tilpas dit forsidebillede</h2>
              <p className="text-sm leading-6 text-ink/64">
                Vælg det udsnit af billedet, som skal vises på dit event.
              </p>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="mb-2 text-sm font-semibold text-midnight">Sådan vil dit event se ud</p>
                <div className="relative aspect-video overflow-hidden rounded-card border border-[#D8CBE4] bg-[#F4F0F7]">
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
                </div>
              </div>
              <div className="grid content-start gap-4 rounded-card bg-[#FAF6EF] p-4">
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Flyt vandret
                  <input
                    className="accent-[#7A4EAB]"
                    max="100"
                    min="0"
                    onChange={(event) => {
                      const nextValue = Number(event.currentTarget.value);
                      setCoverCrop((current) => current ? { ...current, cropX: nextValue } : current);
                    }}
                    type="range"
                    value={coverCrop.cropX}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Flyt lodret
                  <input
                    className="accent-[#7A4EAB]"
                    max="100"
                    min="0"
                    onChange={(event) => {
                      const nextValue = Number(event.currentTarget.value);
                      setCoverCrop((current) => current ? { ...current, cropY: nextValue } : current);
                    }}
                    type="range"
                    value={coverCrop.cropY}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-midnight">
                  Zoom
                  <input
                    className="accent-[#7A4EAB]"
                    max="2"
                    min="1"
                    onChange={(event) => {
                      const nextValue = Number(event.currentTarget.value);
                      setCoverCrop((current) => current ? { ...current, zoom: nextValue } : current);
                    }}
                    step="0.05"
                    type="range"
                    value={coverCrop.zoom}
                  />
                </label>
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

      <div className="sticky bottom-2 z-30 w-full max-w-full rounded-card border border-[#E5D4F7] bg-white/95 p-2 shadow-lift backdrop-blur sm:bottom-3 sm:p-3">
        {message ? (
          <p className="mb-2 rounded-md border border-[#C7D7BF] bg-[#F3F7F0] px-3 py-2 text-sm font-semibold text-[#4E6A45]">
            {message}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <button
            className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-button border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight sm:h-11 sm:px-4"
            onClick={() => {
              if (currentStep === 0) {
                window.location.href = "/facilitator";
                return;
              }

              goToStep(currentStep - 1);
            }}
            type="button"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {currentStep === 0 ? "Arrangørforside" : "Tilbage"}
          </button>
          <button
            className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-button border border-[#7A4EAB]/30 bg-[#F6EFFF] px-3 text-sm font-semibold text-[#7A4EAB] shadow-soft sm:h-11 sm:px-4"
            name="status"
            type="submit"
            value="draft"
          >
            <Save className="size-4" aria-hidden="true" />
            Gem kladde
          </button>
          {currentStep < steps.length - 1 ? (
            <button
              className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-button bg-[#7A4EAB] px-4 text-sm font-semibold text-white shadow-soft sm:h-11 sm:px-5"
              onClick={(event) => {
                event.preventDefault();
                goToStep(currentStep + 1);
              }}
              type="button"
            >
              Næste
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-button bg-[#7A4EAB] px-4 text-sm font-semibold text-white shadow-soft sm:h-11 sm:px-5"
              name="status"
              type="submit"
              value="pending_review"
            >
              Gør event offentlig
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
