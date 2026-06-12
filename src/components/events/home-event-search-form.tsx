"use client";

import { LocateFixed, Search } from "lucide-react";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { areaOptions } from "@/lib/regions/areas";

type HomeEventSearchFormProps = {
  categoryEventCounts?: Record<string, number>;
  categories: Array<{ name: string; value: string }>;
  selected: {
    q: string;
    area: string;
    categoryLabel: string;
    date: string;
    distance: string;
    latitude: string;
    longitude: string;
    format?: string;
  };
};

const popularCategoryNames = ["Yoga", "Lydbad", "Saunagus", "Healing", "Breathwork", "Ceremonier"];
const priorityAreas = ["sjaelland-og-oerne", "fyn", "sonderjylland", "midtjylland", "nordjylland"];

function categoryStyle(active: boolean, disabled: boolean) {
  if (disabled) {
    return {
      background: "radial-gradient(circle at center, rgba(255,255,255,0.94) 0%, rgba(241,239,242,0.96) 48%, rgba(219,215,221,0.98) 100%)",
      boxShadow: undefined,
    };
  }

  return {
    background: active
      ? "radial-gradient(circle at center, rgba(255,255,255,0.96) 0%, rgba(237,228,247,0.96) 50%, rgba(122,78,171,0.34) 100%)"
      : "radial-gradient(circle at center, rgba(255,255,255,0.94) 0%, rgba(247,241,250,0.96) 46%, rgba(237,228,247,0.96) 100%)",
    boxShadow: active ? "0 18px 45px rgba(122, 78, 171, 0.22)" : undefined,
  };
}

function categoryClass(active: boolean, disabled: boolean) {
  return [
    "group relative min-h-[104px] overflow-hidden rounded-[22px] border p-4 text-center shadow-[0_18px_45px_rgba(47,38,51,0.08)] transition sm:min-h-[112px] lg:min-h-[116px]",
    "flex items-center justify-center",
    disabled
      ? "cursor-not-allowed border-stone-200 opacity-55 grayscale"
      : "border-[#D9C5EA] bg-[#EDE4F7] hover:-translate-y-0.5 hover:border-[#7A4EAB]/45 hover:shadow-[0_22px_55px_rgba(122,78,171,0.16)]",
    active && !disabled ? "ring-2 ring-[#7A4EAB] ring-offset-2 ring-offset-[#FAF6EF]" : "",
  ].join(" ");
}

export function HomeEventSearchForm({ categoryEventCounts = {}, categories, selected }: HomeEventSearchFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const visibleCategories = [...categories].sort((a, b) => {
    const aCount = categoryEventCounts[a.name] ?? categoryEventCounts[a.value] ?? 0;
    const bCount = categoryEventCounts[b.name] ?? categoryEventCounts[b.value] ?? 0;

    if (aCount > 0 && bCount <= 0) return -1;
    if (aCount <= 0 && bCount > 0) return 1;

    return a.name.localeCompare(b.name, "da-DK");
  });

  function goToResults(form: HTMLFormElement, submitter?: HTMLButtonElement | HTMLInputElement | null, anchor = "events") {
    const formData = new FormData(form);
    const params = new URLSearchParams();
    const area = formData.get("area");
    const latitude = formData.get("latitude");
    const longitude = formData.get("longitude");

    for (const key of ["q", "area", "category_label", "date", "format"]) {
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
    window.location.assign(query ? "/?" + query + "#" + anchor : "/#" + anchor);
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

  function selectAreaAndRefresh() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const latitudeInput = form.elements.namedItem("latitude") as HTMLInputElement | null;
    const longitudeInput = form.elements.namedItem("longitude") as HTMLInputElement | null;

    if (latitudeInput) latitudeInput.value = "";
    if (longitudeInput) longitudeInput.value = "";
    setLocationMessage("");
    goToResults(form, null, "categories");
  }

  function findNearby() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    if (!navigator.geolocation) {
      setLocationMessage("Vi kunne ikke finde din placering. Vælg venligst dit område manuelt.");
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
        setLocationMessage("Vi kunne ikke finde din placering. Vælg venligst dit område manuelt.");
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    );
  }

  return (
    <form
      action="/#events"
      aria-label="Find events"
      className="w-full max-w-full rounded-card border border-[#EDE4F7] bg-white/88 p-4 shadow-soft sm:p-6"
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
            <p className="mt-3 rounded-xl border border-[#7A4EAB]/30 bg-[#EDE4F7] px-4 py-3 text-sm font-semibold leading-6 text-[#2F1642]">
              {locationMessage}
            </p>
          )}
        </div>

        <div className="mt-3 grid gap-2 sm:mt-4">
          <label className="grid gap-2 text-sm font-semibold text-[#2F2633]">
            Område
            <select
              className={
                "h-12 rounded-input bg-white px-4 text-base font-normal outline-none transition focus:border-[#7A4EAB] " +
                (locationMessage
                  ? "border-2 border-[#7A4EAB] shadow-[0_0_0_4px_rgba(122,78,171,0.12)]"
                  : "border border-olive/15")
              }
              defaultValue={selected.area}
              name="area"
              onChange={selectAreaAndRefresh}
            >
              <option value="">Hele Danmark</option>
              {areaOptions
                .filter((area) => priorityAreas.includes(area.value))
                .map((area) => (
                  <option key={area.value} value={area.value}>
                    {area.label}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </section>

      <section className="mt-6" id="categories">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Populære kategorier</p>
          <h2 className="mt-1 text-2xl font-medium text-[#2F2633]">Find det, der kalder</h2>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {visibleCategories.map((category) => {
            const active = selected.categoryLabel === category.value;
            const eventCount = categoryEventCounts[category.name] ?? categoryEventCounts[category.value] ?? 0;
            const disabled = eventCount <= 0;
            return (
              <button
                className={categoryClass(active, disabled)}
                disabled={disabled}
                key={category.name}
                name="category_label"
                style={categoryStyle(active, disabled)}
                type="submit"
                value={category.value}
              >
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(122,78,171,0.10),transparent_54%)]" aria-hidden="true" />
                {eventCount > 0 && (
                  <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-[#EDE4F7] text-xs font-semibold text-[#7A4EAB] shadow-soft sm:size-8 sm:text-sm">
                    {eventCount}
                  </span>
                )}
                <span className="relative grid gap-1">
                  <span className={disabled ? "block max-w-[9.5rem] break-words text-center font-serif text-[1.15rem] font-medium leading-tight text-stone-500 sm:text-[1.25rem] lg:text-[1.35rem]" : "block max-w-[9.5rem] break-words text-center font-serif text-[1.15rem] font-medium leading-tight text-[#2F1642] sm:text-[1.25rem] lg:text-[1.35rem]"}>
                    {category.name}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <details
        className="mt-6 rounded-[1.25rem] border border-[#7A4EAB]/12 bg-white/62 p-4"
        open={Boolean(selected.q || selected.date || selected.format)}
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
                <option value="hybrid">Hybrid events</option>
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
