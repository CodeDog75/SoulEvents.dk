"use client";

import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
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
};

type MainCategory = Category;
type Subcategory = Category & {
  mainCategoryIds?: string[];
};
type Tag = Category;

type EventFormProps = {
  regions: Region[];
  categories: Category[];
  mainCategories?: MainCategory[];
  subcategories?: Subcategory[];
  tags?: Tag[];
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

function openNativePicker(input: HTMLInputElement) {
  try {
    (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
  } catch {
    input.focus();
  }
}

const eventDraftStorageKey = "soulevents:event-form-draft:v1";
const maxEventDescriptionLength = 2000;

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
    .replaceAll("Ã¦", "ae")
    .replaceAll("Ã¸", "oe")
    .replaceAll("Ã¥", "aa")
    .replaceAll("Ã…", "aa")
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
  step,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  help?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink/72">
      <span>
        {label}
        {required ? <span className="ml-1 text-[#B56F8A]">*</span> : null}
      </span>
      <input
        className="h-12 w-full min-w-0 rounded-card border border-midnight/15 bg-white required:valid:bg-[#F8F3FF] required:valid:border-[#D7C4F0] px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA]"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        step={step}
        type={type}
      />
      {help ? <span className="text-xs leading-5 text-ink/52">{help}</span> : null}
    </label>
  );
}

function TextArea({
  label,
  name,
  placeholder,
  required,
  minHeight = "min-h-28",
  help,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  minHeight?: string;
  help?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink/72">
      <span>
        {label}
        {required ? <span className="ml-1 text-[#B56F8A]">*</span> : null}
      </span>
      <textarea
        className={minHeight + " w-full min-w-0 rounded-card border border-midnight/15 bg-white required:valid:bg-[#F8F3FF] required:valid:border-[#D7C4F0] p-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA]"}
        name={name}
        placeholder={placeholder}
      />
      {help ? <span className="text-xs leading-5 text-ink/52">{help}</span> : null}
    </label>
  );
}

function EventDescriptionField() {
  const [characterCount, setCharacterCount] = useState(0);
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
        checked={checked}
        className="size-4 accent-[#7A4EAB]"
        name={name}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
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
  facilitator,
}: EventFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("21:00");
  const [postalCode, setPostalCode] = useState(value(facilitator.postalCode));
  const [city, setCity] = useState(value(facilitator.city));
  const [regionId, setRegionId] = useState(value(facilitator.regionId));
  const [postalCodeMessage, setPostalCodeMessage] = useState("");
  const [eventFormat, setEventFormat] = useState<"physical" | "online">("physical");
  const [isFree, setIsFree] = useState(false);
  const [selectedMainCategoryIds, setSelectedMainCategoryIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ title: string; teaser: string; format: string; price: string } | null>(null);
  const [hasAutosavedDraft, setHasAutosavedDraft] = useState(false);
  const [autosaveMessage, setAutosaveMessage] = useState("");
  const showAddress = eventFormat === "physical";
  const showOnline = eventFormat === "online";
  const relevantSubcategories = subcategories.filter((subcategory) => {
    if (selectedMainCategoryIds.length === 0) return false;
    if (!subcategory.mainCategoryIds || subcategory.mainCategoryIds.length === 0) return false;
    return subcategory.mainCategoryIds.some((mainCategoryId) => selectedMainCategoryIds.includes(mainCategoryId));
  });
  const statusHelp = useMemo(
    () =>
      "Gem som kladde hvis du vil arbejde videre. Publicer sender eventet videre til visning/godkendelse efter platformens regler.",
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
    { icon: <Mail className="size-4" />, label: "Publicering", title: "Klar til at dele" },
  ];

  const stepDescriptions = [
    "Giv dit event en titel, vælg dato og tidspunkt, og fortæl om oplevelsen foregår fysisk eller online. Resten tager vi sammen, trin for trin.",
    "Fortæl deltagerne, hvor eventet foregår, eller hvordan de deltager online.",
    "Beskriv stemningen, hvem eventet er for, og tilføj billeder der gør eventet levende.",
    "Vælg kategorier, pris og deltagerantal, så de rette mennesker kan finde dit event.",
    "Forhåndsvis dit event og publicer det, når du er klar.",
  ];

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
    setPreview({
      title: String(data.get("title") ?? "Eventtitel"),
      teaser: String(data.get("event_description") ?? ""),
      format: eventFormat === "online" ? "Online event" : "Fysisk event",
      price: isFree ? "Gratis" : String(data.get("price") ?? "0") + " kr.",
    });
  }

  function goToStep(index: number) {
    setCurrentStep(Math.min(Math.max(index, 0), steps.length - 1));
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
      if (key === "status") {
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
  }, [city, endDate, endTime, eventFormat, isFree, postalCode, regionId, selectedMainCategoryIds, startDate, startTime]);

  return (
    <form
      action={createEventAction}
      className="grid w-full max-w-full gap-5 overflow-x-hidden sm:gap-6"
      noValidate
      onChange={writeDraft}
      onInput={writeDraft}
      ref={formRef}
    >
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
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Eventtitel" name="title" placeholder="Fx Fuldmåneceremoni og ro i skoven" required />
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
        <EventDescriptionField />
      </section>

      <section className={currentStep === 1 ? "grid w-full max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        <div>
          <p className="text-sm font-semibold text-midnight">Hvordan foregår eventet?</p>
          <p className="mt-1 text-sm leading-6 text-ink/64">Vælg fysisk event, hvis deltageren skal møde op på en adresse. Vælg online event, hvis det foregår digitalt.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { value: "physical", label: "Fysisk event", help: "Adresse og fremmøde." },
              { value: "online", label: "Online event", help: "Via link eller online møderum." },
            ].map((option) => (
              <label className="grid gap-2 rounded-card border border-[#E5D4F7] bg-white p-4 text-sm font-semibold text-midnight shadow-soft" key={option.value}>
                <span className="flex items-center gap-3">
                  <input
                    checked={eventFormat === option.value}
                    className="size-4 accent-[#7A4EAB]"
                    name="event_format"
                    onChange={() => setEventFormat(option.value as "physical" | "online")}
                    type="radio"
                    value={option.value}
                  />
                  {option.label}
                </span>
                <span className="text-xs font-normal leading-5 text-ink/55">{option.help}</span>
              </label>
            ))}
          </div>
        </div>
        {showAddress ? (
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput defaultValue={value(facilitator.addressLine)} label="Adresse" name="address_line" required />
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              <span>Postnummer<span className="ml-1 text-[#B56F8A]">*</span></span>
              <input
                className="h-12 w-full min-w-0 rounded-card border border-midnight/15 bg-white required:valid:bg-[#F8F3FF] required:valid:border-[#D7C4F0] px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA]"
                inputMode="numeric"
                maxLength={4}
                name="postal_code"
                required
                onChange={(event) => handlePostalCodeChange(event.target.value)}
                pattern="[0-9]{4}"
                value={postalCode}
              />
              <span className="text-xs leading-5 text-ink/52">By og region opdateres automatisk, når postnummeret er gyldigt.</span>
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              <span>By<span className="ml-1 text-[#B56F8A]">*</span></span>
              <input
                className="h-12 w-full min-w-0 rounded-card border border-midnight/15 bg-white required:valid:bg-[#F8F3FF] required:valid:border-[#D7C4F0] px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA]"
                name="city"
                required
                onChange={(event) => setCity(event.target.value)}
                value={city}
              />
              {postalCodeMessage ? <span className="text-xs leading-5 text-[#7A4EAB]">{postalCodeMessage}</span> : null}
            </label>
            <TextInput defaultValue="Danmark" label="Land" name="country" required />
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              <span>Region<span className="ml-1 text-[#B56F8A]">*</span></span>
              <select
                className="h-12 w-full min-w-0 rounded-card border border-midnight/15 bg-white required:valid:bg-[#F8F3FF] required:valid:border-[#D7C4F0] px-4 text-base outline-none transition focus:!border-[#7A4EAB] focus:!ring-4 focus:!ring-[#CDB4EA] focus:!outline-none focus-visible:!outline-none focus:invalid:!border-[#7A4EAB] focus:invalid:!ring-4 focus:invalid:!ring-[#CDB4EA]"
                name="region_id"
                required
                onChange={(event) => setRegionId(event.target.value)}
                value={regionId}
              >
                <option value="">Vælg region</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>{region.name}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        {showOnline ? (
          <div className="grid gap-4 md:grid-cols-2">
            <TextArea label="Online-link eller tekst" name="online_url_or_note" placeholder="Zoom-link, Teams-link eller tekst om at link sendes senere." />
            <TextArea label="Hvordan får deltageren adgang?" name="online_description" placeholder="Fx Link til online møderum sendes efter tilmelding." />
          </div>
        ) : null}
        <Tip>
          <p>Hvis adressen er privat, kan du nøjes med by og praktisk information. Deltageren kan få den præcise adresse efter bekræftelse.</p>
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
              name="practical_information"
              placeholder="Medbring yogamåtte. Kom i behageligt tøj. Dørene åbner 15 minutter før."
              help="Valgfrit. Brug kun feltet, hvis der er noget praktisk deltageren skal vide."
            />
          </div>
        </details>
      </section>

      <section className={currentStep === 2 ? "grid w-full max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        <TextInput
          label="Eventbillede"
          name="cover_image_path"
          placeholder="events/forside.jpg"
          help="Brug et varmt og roligt billede i vandret format. Undgå plakater med meget tekst."
        />
        <div className="rounded-card bg-[#FAF6EF] p-4">
          <div className="flex items-start gap-3">
            <ImagePlus className="mt-1 size-5 shrink-0 text-[#7A4EAB]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-midnight">Stemningsbilleder</p>
              <p className="mt-1 text-sm leading-6 text-ink/64">
                Vælg billeder der viser stemning, sted, materialer eller fællesskab.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="grid gap-3 rounded-md border border-[#E5D4F7] bg-white p-4 md:grid-cols-2" key={index}>
                <TextInput label={"Galleri-billede " + (index + 1)} name="event_image_paths" placeholder="events/galleri.jpg" />
                <TextInput label="Billedtekst" name="event_alt_texts" placeholder="Fx Meditation i lyse omgivelser" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={currentStep === 3 ? "grid w-full max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        {mainCategories.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-midnight">Hovedkategori *</p>
            <p className="mt-1 text-sm leading-6 text-ink/64">Vælg én eller flere brede retninger, eventet hører hjemme i.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mainCategories.map((category) => (
                <CheckboxPill
                  checked={selectedMainCategoryIds.includes(category.id)}
                  key={category.id}
                  label={category.name}
                  name="main_category_ids"
                  onChange={(checked) => updateMainCategory(category.id, checked)}
                  value={category.id}
                />
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-midnight">Underkategori / eventform *</p>
          <p className="mt-1 text-sm leading-6 text-ink/64">
            Underkategorierne vises ud fra de hovedkategorier, du vælger.
          </p>
          {selectedMainCategoryIds.length === 0 ? (
            <div className="mt-3 rounded-card border border-dashed border-[#E5D4F7] bg-[#FAF6EF] p-4 text-sm leading-6 text-ink/64">
              Vælg mindst én hovedkategori for at se relevante eventformer.
            </div>
          ) : relevantSubcategories.length > 0 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relevantSubcategories.map((subcategory) => (
                <CheckboxPill key={subcategory.id} label={subcategory.name} name="subcategory_ids" value={subcategory.id} />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-card border border-dashed border-[#E5D4F7] bg-[#FAF6EF] p-4 text-sm leading-6 text-ink/64">
              Der er endnu ikke koblet underkategorier til den valgte hovedkategori. Det kan rettes under admin.
            </div>
          )}
        </div>
        {tags.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-midnight">Tags</p>
            <p className="mt-1 text-sm leading-6 text-ink/64">Tags er ekstra filtre som begynder, gratis, weekend eller udendørs.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tags.map((tag) => (
                <CheckboxPill key={tag.id} label={tag.name} name="tag_ids" value={tag.id} />
              ))}
            </div>
          </div>
        )}
        <Tip>
          <p>Hovedkategori er den brede retning. Underkategori er den konkrete oplevelse. Tags hjælper brugeren med at finde mere præcist.</p>
        </Tip>
      </section>

      <section className={currentStep === 3 ? "grid w-full max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput defaultValue={isFree ? "0" : "0"} label="Pris i kr." name="price" type="number" help="Skriv 0 hvis eventet er gratis." />
          <TextInput defaultValue="12" label="Maks. antal deltagere" name="capacity" type="number" />
          <label className="flex h-12 items-center gap-3 rounded-card border border-[#E5D4F7] bg-[#FAF6EF] p-3 text-sm font-semibold text-midnight">
            <input checked={isFree} className="size-4 accent-[#7A4EAB]" onChange={(event) => setIsFree(event.target.checked)} type="checkbox" />
            Gratis event
          </label>
        </div>
      </section>

      <section className={currentStep === 4 ? "grid w-full max-w-full gap-4 overflow-hidden rounded-card border border-[#E5D4F7] bg-white/95 p-4 shadow-soft sm:gap-5 sm:p-6" : "hidden"}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Kontaktperson" name="contact_name" placeholder="Navn på kontaktperson" />
          <TextInput defaultValue={facilitator.contactEmail} label="E-mail" name="contact_email" type="email" />
          <TextInput defaultValue={value(facilitator.contactPhone)} label="Telefonnummer" name="contact_phone" />
          <TextInput label="Facebook" name="facebook_url" type="url" />
          <TextInput label="Instagram" name="instagram_url" type="url" />
        </div>
        {preview && (
          <article className="rounded-card bg-[#FAF6EF] p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#B56F8A]">{preview.format}</p>
            <h3 className="mt-2 text-3xl font-medium text-olive">{preview.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/70">{preview.teaser || "Kort teaser vises her."}</p>
            <p className="mt-4 text-sm font-semibold text-olive">{preview.price}</p>
          </article>
        )}
        <p className="text-sm leading-6 text-ink/64">{statusHelp}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-midnight/15 bg-white px-5 text-sm font-semibold text-midnight" onClick={showPreview} type="button">
            <Eye className="size-4" aria-hidden="true" />
            Forhåndsvis
          </button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-midnight px-5 text-sm font-semibold text-white" name="status" type="submit" value="draft">
            <Save className="size-4" aria-hidden="true" />
            Gem som kladde
          </button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#7A4EAB] px-5 text-sm font-semibold text-white shadow-soft" name="status" type="submit" value="pending_review">
            <Send className="size-4" aria-hidden="true" />
            Publicer
          </button>
        </div>
      </section>

      <div className="sticky bottom-2 z-30 w-full max-w-full rounded-card border border-[#E5D4F7] bg-white/95 p-2 shadow-lift backdrop-blur sm:bottom-3 sm:p-3">
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
            {currentStep === 0 ? "Værtsforside" : "Tilbage"}
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
              onClick={() => goToStep(currentStep + 1)}
              type="button"
            >
              Næste
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-button border border-[#7A4EAB] bg-[#F6EFFF] px-4 text-sm font-semibold text-[#7A4EAB] sm:h-11 sm:px-5"
              onClick={() => goToStep(0)}
              type="button"
            >
              Gennemgå igen
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
