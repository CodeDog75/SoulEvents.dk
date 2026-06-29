"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin, Search, SlidersHorizontal } from "lucide-react";
import type { FormEvent } from "react";
import { useRef, useState } from "react";

type ExperienceGroup = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  colorHex: string;
  imageUrl: string | null;
  subcategories: Array<{ id: string; name: string; value: string }>;
};

type HomeEventSearchFormProps = {
  categoryEventCounts?: Record<string, number>;
  experienceGroupEventCounts?: Record<string, number>;
  experienceGroups?: ExperienceGroup[];
  selected: {
    q: string;
    area: string;
    categoryLabel: string;
    date: string;
    distance: string;
    latitude: string;
    longitude: string;
    format?: string;
    country?: string;
  };
};

const locationFallbackMessage = "Vi kunne ikke finde din placering. Vælg område i feltet herunder.";

const areaOptions = [
  { label: "Hele Danmark", value: "" },
  { label: "Sjælland & Øerne", value: "sjaelland-og-oerne" },
  { label: "Fyn", value: "fyn" },
  { label: "Sønderjylland", value: "sonderjylland" },
  { label: "Midtjylland", value: "midtjylland" },
  { label: "Nordjylland", value: "nordjylland" },
];

function categoryHref(slug: string) {
  return "/categories/" + slug;
}

function categoryEmoji(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("yoga") || normalized.includes("bevægelse") || normalized.includes("krop")) return "🧘";
  if (normalized.includes("sauna") || normalized.includes("velvære")) return "🔥";
  if (normalized.includes("meditation") || normalized.includes("nærvær")) return "🌙";
  if (normalized.includes("healing") || normalized.includes("energi")) return "🌿";
  if (normalized.includes("lyd") || normalized.includes("musik")) return "🎶";
  if (normalized.includes("ceremoni") || normalized.includes("ritual")) return "✨";
  if (normalized.includes("retreat") || normalized.includes("rejse")) return "🌄";
  return "🌸";
}

export function HomeEventSearchForm({
  categoryEventCounts = {},
  experienceGroupEventCounts = {},
  experienceGroups = [],
  selected,
}: HomeEventSearchFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const groupedExperiences = experienceGroups.length > 0 ? experienceGroups : [];
  const sortedExperienceGroups = groupedExperiences
    .map((group) => ({
      ...group,
      subcategories: [...group.subcategories].sort((a, b) => {
        const aCount = categoryEventCounts[a.name] ?? categoryEventCounts[a.value] ?? 0;
        const bCount = categoryEventCounts[b.name] ?? categoryEventCounts[b.value] ?? 0;

        if (aCount > 0 && bCount <= 0) return -1;
        if (aCount <= 0 && bCount > 0) return 1;

        return a.name.localeCompare(b.name, "da-DK");
      }),
    }));

  function renderExperienceGroupCard(group: (typeof sortedExperienceGroups)[number]) {
    const eventCount = experienceGroupEventCounts[group.id] ?? 0;

    return (
      <Link
        className="group grid min-h-[112px] w-[145px] shrink-0 content-between rounded-[20px] border border-[#E9DDF2] bg-white/94 p-3.5 shadow-[0_10px_26px_rgba(47,38,51,0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-[#7A4EAB]/30 hover:shadow-[0_14px_34px_rgba(122,78,171,0.11)] sm:w-auto sm:p-4"
        href={categoryHref(group.slug)}
        key={group.id}
      >
        <span className="grid gap-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#FAF6EF] text-xl shadow-soft" aria-hidden="true">
            {categoryEmoji(group.name)}
          </span>
          <span className="min-w-0">
            <span className="block break-words text-base font-bold leading-tight text-[#2F2633] sm:font-serif sm:text-xl sm:font-semibold">
              {group.name}
            </span>
            <span className="mt-1 block text-sm font-semibold text-[#2F2633]/62">
              {eventCount} {eventCount === 1 ? "event" : "events"}
            </span>
          </span>
        </span>
        <span className="mt-3 hidden text-sm font-semibold text-[#7A4EAB] transition group-hover:text-[#2F2633] sm:inline-flex">
          Se events
        </span>
      </Link>
    );
  }

  function scrollToAnchor(anchor: string) {
    window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function goToResults(form: HTMLFormElement, submitter?: HTMLButtonElement | HTMLInputElement | null, anchor = "events") {
    const formData = new FormData(form);
    const params = new URLSearchParams();
    const area = formData.get("area");
    const latitude = formData.get("latitude");
    const longitude = formData.get("longitude");

    for (const key of ["q", "area", "category_label", "date", "format", "country"]) {
      const value = formData.get(key);

      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
      }
    }

    if (submitter?.name && submitter.value) {
      params.set(submitter.name, submitter.value);
    }

    if (!area && typeof latitude === "string" && latitude && typeof longitude === "string" && longitude) {
      params.set("latitude", latitude);
      params.set("longitude", longitude);
      params.set("distance", "50");
    }

    const query = params.toString();
    router.push(query ? "/?" + query + "#" + anchor : "/#" + anchor, { scroll: false });
    scrollToAnchor(anchor);
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;

    if (form) {
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      goToResults(
        form,
        submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : null,
      );
    }
  }

  function findNearby() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    if (!navigator.geolocation) {
      setLocationMessage(locationFallbackMessage);
      return;
    }

    setLocationMessage("Finder din placering...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitudeInput = form.elements.namedItem("latitude") as HTMLInputElement | null;
        const longitudeInput = form.elements.namedItem("longitude") as HTMLInputElement | null;
        const areaInput = form.elements.namedItem("area") as HTMLSelectElement | null;

        if (latitudeInput && longitudeInput) {
          latitudeInput.value = String(position.coords.latitude);
          longitudeInput.value = String(position.coords.longitude);
        }

        if (areaInput) {
          areaInput.value = "";
        }

        goToResults(form);
      },
      () => {
        setLocationMessage(locationFallbackMessage);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    );
  }

  return (
    <form
      action="/#events"
      aria-label="Find events"
      className="w-full max-w-full"
      onSubmit={submitForm}
      ref={formRef}
    >
      <input name="latitude" type="hidden" defaultValue={selected.latitude} />
      <input name="longitude" type="hidden" defaultValue={selected.longitude} />

      <section className="grid gap-3 md:rounded-card md:border md:border-[#EDE4F7] md:bg-white/88 md:p-5 md:shadow-soft">
        <section className="rounded-[26px] bg-white/96 p-2 shadow-[0_18px_46px_rgba(47,38,51,0.13)] md:rounded-[22px] md:border md:border-[#7A4EAB]/12 md:bg-white/70 md:shadow-none">
          <label className="flex min-h-16 items-center gap-3 rounded-[22px] px-3 text-sm font-semibold text-[#2F2633] md:min-h-12 md:rounded-input md:border md:border-[#7A4EAB]/15 md:bg-white md:px-4">
            <Search className="size-6 shrink-0 text-[#7A4EAB] md:size-5" aria-hidden="true" />
            <span className="sr-only">Hvad søger du?</span>
            <input
              className="min-w-0 flex-1 bg-transparent text-base font-normal outline-none placeholder:text-[#2F2633]/54 md:text-sm"
              defaultValue={selected.q}
              name="q"
              placeholder="Hvad søger du?"
              type="search"
            />
            <button
              className="grid size-11 shrink-0 place-items-center rounded-full bg-[#FAF6EF] text-[#7A4EAB] transition hover:bg-[#EDE4F7] md:bg-[#7A4EAB] md:text-white"
              type="submit"
            >
              <SlidersHorizontal className="size-5" aria-hidden="true" />
              <span className="sr-only">Søg events</span>
            </button>
          </label>
        </section>

        <section className="rounded-[24px] bg-white/94 p-4 shadow-[0_14px_36px_rgba(47,38,51,0.08)] md:grid md:grid-cols-[1fr_auto] md:items-center md:gap-4 md:rounded-[22px] md:border md:border-[#7A4EAB]/12 md:shadow-none">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#F4ECFA] text-[#7A4EAB]" aria-hidden="true">
              <MapPin className="size-6" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#2F2633]">Events nær dig</h3>
              <p className="mt-0.5 text-sm font-semibold text-[#7A4EAB]">
                {areaOptions.find((option) => option.value === selected.area)?.label ?? "Vælg område"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] md:mt-0">
            <label className="sr-only" htmlFor="home-area-select">
              Vælg område
            </label>
            <select
              className="h-12 min-w-0 rounded-input border border-[#7A4EAB]/15 bg-white px-4 text-sm font-semibold text-[#2F2633] outline-none transition focus:border-[#7A4EAB]"
              defaultValue={selected.area}
              id="home-area-select"
              name="area"
            >
              {areaOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button border border-[#7A4EAB]/20 bg-white/86 px-4 py-3 text-sm font-semibold text-[#7A4EAB] transition hover:-translate-y-0.5 hover:border-[#7A4EAB]/40"
              onClick={findNearby}
              type="button"
            >
              <LocateFixed className="size-4 shrink-0" aria-hidden="true" />
              Find nær mig
            </button>
          </div>

          <button
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-button bg-[#7A4EAB] px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift md:hidden"
            type="submit"
          >
            Søg i valgt område
          </button>

          {locationMessage && (
            <div className="mt-3 rounded-xl border border-[#7A4EAB]/20 bg-[#FAF6EF]/80 px-4 py-3 md:col-span-2">
              <p className="text-sm font-semibold leading-6 text-[#2F1642]">{locationMessage}</p>
            </div>
          )}
        </section>
      </section>

      <section className="mt-4" id="categories">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Udforsk oplevelser</p>
            <h2 className="mt-1 text-2xl font-medium text-[#2F2633] sm:text-3xl">Udforsk retninger</h2>
          </div>
          <Link className="shrink-0 text-sm font-bold text-[#7A4EAB] transition hover:text-[#2F2633]" href="/#events">
            Se alle
          </Link>
        </div>

        {sortedExperienceGroups.length > 0 ? (
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {sortedExperienceGroups.map((group) => renderExperienceGroupCard(group))}
          </div>
        ) : (
          <div className="mt-3 rounded-[22px] border border-[#E5D4F7] bg-white/80 p-5 shadow-soft">
            <p className="text-base font-semibold text-[#2F2633]">Der er endnu ikke planlagt events i dette område.</p>
            <p className="mt-1 text-sm leading-6 text-[#2F2633]/68">
              Prøv Hele Danmark, eller kig forbi igen senere.
            </p>
          </div>
        )}
      </section>

      <details
        className="mt-4 rounded-[1.25rem] border border-[#7A4EAB]/12 bg-white/62 p-4"
        open={Boolean(selected.q || selected.date || selected.format || selected.country)}
      >
        <summary className="cursor-pointer list-none text-sm font-semibold text-[#7A4EAB] marker:hidden">
          Avanceret søgning
          <span className="ml-2 text-[#2F2633]/45">▾</span>
        </summary>

        <div className="mt-4 grid gap-4">
          <section className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#2F2633]">
              Hvornår?
              <select
                className="h-12 rounded-input border border-[#7A4EAB]/15 bg-white px-4 text-base font-normal outline-none transition focus:border-[#7A4EAB]"
                defaultValue={selected.date}
                name="date"
              >
                <option value="">Alle kommende events</option>
                <option value="today">I dag</option>
                <option value="weekend">Denne weekend</option>
                <option value="next_week">Næste uge</option>
                <option value="month">Denne måned</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#2F2633]">
              Online eller fysisk?
              <select
                className="h-12 rounded-input border border-[#7A4EAB]/15 bg-white px-4 text-base font-normal outline-none transition focus:border-[#7A4EAB]"
                defaultValue={selected.format ?? ""}
                name="format"
              >
                <option value="">Alle formater</option>
                <option value="physical">Fysiske events</option>
                <option value="online">Online events</option>
              </select>
            </label>
          </section>

        </div>
      </details>
    </form>
  );
}
