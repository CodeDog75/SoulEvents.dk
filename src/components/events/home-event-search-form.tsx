"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LocateFixed, Search } from "lucide-react";
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

const locationFallbackMessage = "Vi kunne ikke finde din placering. Vælg dit område herunder.";

const areaOptions = [
  { label: "Hele Danmark", value: "" },
  { label: "Sjælland & Øerne", value: "sjaelland-og-oerne" },
  { label: "Fyn", value: "fyn" },
  { label: "Sønderjylland", value: "sonderjylland" },
  { label: "Midtjylland", value: "midtjylland" },
  { label: "Nordjylland", value: "nordjylland" },
];

function LotusIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 20c-2.7-2.1-4-4.4-4-6.9 0-2.4 1.4-4.7 4-6.8 2.6 2.1 4 4.4 4 6.8 0 2.5-1.3 4.8-4 6.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M7.9 18.8c-2.9-.6-5-2.5-5.9-5.6 2.7-.8 5.1-.4 7 1.2M16.1 18.8c2.9-.6 5-2.5 5.9-5.6-2.7-.8-5.1-.4-7 1.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 20c-1.1-2.2-1.1-4.4 0-6.7 1.1 2.3 1.1 4.5 0 6.7Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function categoryHref(slug: string) {
  return "/categories/" + slug;
}

export function HomeEventSearchForm({ categoryEventCounts = {}, experienceGroups = [], selected }: HomeEventSearchFormProps) {
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
    }))
;
  const visibleExperienceGroups = sortedExperienceGroups.slice(0, 4);
  const hiddenExperienceGroups = sortedExperienceGroups.slice(4);

  function renderExperienceGroupCard(group: (typeof sortedExperienceGroups)[number]) {
    return (
      <Link
        className="group relative min-h-[132px] overflow-hidden rounded-[22px] border border-[#D9C5EA] p-4 shadow-[0_18px_45px_rgba(47,38,51,0.08)] transition duration-500 hover:-translate-y-0.5 hover:scale-[1.015] hover:border-[#7A4EAB]/45 hover:shadow-[0_24px_60px_rgba(122,78,171,0.18)] sm:min-h-[164px] sm:p-5"
        href={categoryHref(group.slug)}
        key={group.id}
        style={{
          background: group.imageUrl
            ? "linear-gradient(180deg, rgba(47, 38, 51, 0.16), rgba(47, 38, 51, 0.68)), url('" + group.imageUrl + "') center/cover"
            : "radial-gradient(circle at center, rgba(255,255,255,0.88) 0%, " + group.colorHex + "30 54%, " + group.colorHex + "70 100%)",
        }}
      >
        <span
          className={
            group.imageUrl
              ? "absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),rgba(47,38,51,0.28)_62%,rgba(47,38,51,0.52))] transition duration-500 group-hover:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),rgba(47,38,51,0.20)_62%,rgba(47,38,51,0.44))]"
              : "absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.28),transparent_58%)]"
          }
          aria-hidden="true"
        />
        <span className="relative flex h-full min-h-[104px] flex-col justify-between sm:min-h-[124px]">
          <span>
            <span className={
              "block min-h-[2.7rem] break-words font-serif text-[1.3rem] font-medium leading-[1.08] sm:min-h-[3.6rem] sm:text-[1.65rem] " +
              (group.imageUrl ? "text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.72)]" : "text-[#2F1642]")
            }>
              {group.name}
            </span>
            {group.description && (
              <span className={
                "mt-2 block line-clamp-2 text-xs leading-5 sm:text-sm sm:leading-6 " +
                (group.imageUrl ? "font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.82)]" : "text-[#2F2633]/72")
              }>
                {group.description}
              </span>
            )}
          </span>
          <span className="mt-3 flex justify-end">
            <span className="grid size-7 place-items-center rounded-full bg-white/70 text-[#7A4EAB] opacity-0 shadow-soft transition duration-300 group-hover:translate-x-0.5 group-hover:bg-white group-hover:opacity-100">
              <LotusIcon />
            </span>
          </span>
        </span>
      </Link>
    );
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
  }

  function chooseFallbackArea(area: string) {
    const params = new URLSearchParams();

    if (area) params.set("area", area);
    if (selected.categoryLabel) params.set("category_label", selected.categoryLabel);
    if (selected.q) params.set("q", selected.q);
    if (selected.date) params.set("date", selected.date);
    if (selected.format) params.set("format", selected.format);
    if (selected.country) params.set("country", selected.country);

    const query = params.toString();
    router.push(query ? "/?" + query + "#events" : "/#events", { scroll: false });
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
      className="w-full max-w-full rounded-card border border-[#EDE4F7] bg-white/88 p-3 shadow-soft sm:p-5"
      onSubmit={submitForm}
      ref={formRef}
    >
      <input name="latitude" type="hidden" defaultValue={selected.latitude} />
      <input name="longitude" type="hidden" defaultValue={selected.longitude} />

      <section className="grid gap-3">
        <div>
          <button
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-[#7A4EAB] px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            onClick={findNearby}
            type="button"
          >
            <LocateFixed className="size-4 shrink-0" aria-hidden="true" />
            Find events nær dig
          </button>
          {locationMessage && (
            <div className="mt-3 rounded-xl border border-[#7A4EAB]/30 bg-[#EDE4F7] px-4 py-3">
              <p className="text-sm font-semibold leading-6 text-[#2F1642]">{locationMessage}</p>
              {locationMessage === locationFallbackMessage && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {areaOptions.map((option) => {
                    const isSelected = selected.area === option.value || (!selected.area && option.value === "");
                    return (
                      <button
                        className={
                          "rounded-full px-3 py-2 text-xs font-semibold transition " +
                          (isSelected
                            ? "bg-[#7A4EAB] text-white"
                            : "border border-[#7A4EAB]/20 bg-white/80 text-[#2F1642] hover:border-[#7A4EAB]")
                        }
                        key={option.label}
                        onClick={() => chooseFallbackArea(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </section>

      <section className="mt-4" id="categories">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Udforsk oplevelser</p>
          <h2 className="mt-1 text-2xl font-medium text-[#2F2633] sm:text-3xl">Vælg en retning</h2>
        </div>

        {visibleExperienceGroups.length > 0 ? (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
              {visibleExperienceGroups.map((group) => renderExperienceGroupCard(group))}
            </div>

            {hiddenExperienceGroups.length > 0 && (
              <details className="mt-3">
                <summary className="inline-flex cursor-pointer list-none rounded-full border border-[#7A4EAB]/20 bg-white/80 px-4 py-2 text-sm font-semibold text-[#7A4EAB] shadow-soft marker:hidden">
                  Vis flere retninger
                </summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
                  {hiddenExperienceGroups.map((group) => renderExperienceGroupCard(group))}
                </div>
              </details>
            )}
          </>
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

          <section className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-2 text-sm font-semibold text-[#2F2633]">
              Hvad søger du?
              <input
                className="h-12 rounded-input border border-[#7A4EAB]/15 px-4 text-base font-normal outline-none transition focus:border-[#7A4EAB]"
                defaultValue={selected.q}
                name="q"
                placeholder="Søg efter events, kategorier eller steder..."
                type="search"
              />
            </label>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button bg-[#7A4EAB] px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              type="submit"
            >
              <Search className="size-4 shrink-0" aria-hidden="true" />
              Søg
            </button>
          </section>
        </div>
      </details>
    </form>
  );
}
