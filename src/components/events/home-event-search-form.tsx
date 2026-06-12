"use client";

import { LocateFixed, Search } from "lucide-react";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { areaOptions } from "@/lib/regions/areas";

type HomeEventSearchFormProps = {
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

function categoryStyle(active: boolean) {
  return {
    background: active
      ? "radial-gradient(circle at center, rgba(255,255,255,0.96) 0%, rgba(237,228,247,0.96) 50%, rgba(122,78,171,0.34) 100%)"
      : "radial-gradient(circle at center, rgba(255,255,255,0.94) 0%, rgba(247,241,250,0.96) 46%, rgba(237,228,247,0.96) 100%)",
    boxShadow: active ? "0 18px 45px rgba(122, 78, 171, 0.22)" : undefined,
  };
}

function categoryClass(active: boolean) {
  return [
    "group relative min-h-[108px] overflow-hidden rounded-[1.35rem] border p-4 text-center shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift",
    "flex items-center justify-center",
    active ? "border-[#7A4EAB]/45 ring-2 ring-[#7A4EAB]/25" : "border-[#7A4EAB]/15",
  ].join(" ");
}

export function HomeEventSearchForm({ categories, selected }: HomeEventSearchFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const popularCategories = categories.filter((category) => popularCategoryNames.includes(category.name));
  const visibleCategories = showAllCategories
    ? [...categories].sort((a, b) => a.name.localeCompare(b.name, "da-DK"))
    : popularCategories.sort((a, b) => popularCategoryNames.indexOf(a.name) - popularCategoryNames.indexOf(b.name));

  function goToResults(form: HTMLFormElement, submitter?: HTMLButtonElement | HTMLInputElement | null) {
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
    window.location.assign(query ? "/?" + query + "#events" : "/#events");
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

  function clearLocationWhenAreaIsSelected() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const latitudeInput = form.elements.namedItem("latitude") as HTMLInputElement | null;
    const longitudeInput = form.elements.namedItem("longitude") as HTMLInputElement | null;

    if (latitudeInput) latitudeInput.value = "";
    if (longitudeInput) longitudeInput.value = "";
    setLocationMessage("");
  }

  function findNearby() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    if (!navigator.geolocation) {
      setLocationMessage("Din browser understøtter ikke placering. Vælg et område og tryk Søg i valgt område.");
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
        setLocationMessage("Placering kunne ikke hentes. Vælg et område og tryk Søg i valgt område.");
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
          {locationMessage && <p className="mt-4 text-sm font-semibold text-[#2F2633]">{locationMessage}</p>}
        </div>

        <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="grid gap-2 text-sm font-semibold text-[#2F2633]">
            Område
            <select
              className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-[#7A4EAB]"
              defaultValue=""
              name="area"
              onChange={clearLocationWhenAreaIsSelected}
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

          <button
            className="inline-flex min-h-12 items-center justify-center rounded-button bg-[#7A4EAB] px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            type="submit"
          >
            Søg i valgt område
          </button>
        </div>
      </section>

      <section className="mt-6" id="categories">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Populære kategorier</p>
            <h2 className="mt-1 text-2xl font-medium text-[#2F2633]">Find det, der kalder</h2>
          </div>
          <button
            className="shrink-0 text-sm font-semibold text-[#2F2633] transition hover:text-[#7A4EAB]"
            onClick={() => setShowAllCategories((current) => !current)}
            type="button"
          >
            {showAllCategories ? "Vis færre" : "Se alle kategorier"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {visibleCategories.map((category) => {
            const active = selected.categoryLabel === category.value;

            return (
              <button
                className={categoryClass(active)}
                key={category.name}
                name="category_label"
                style={categoryStyle(active)}
                type="submit"
                value={category.value}
              >
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(122,78,171,0.10),transparent_54%)]" aria-hidden="true" />
                <span className="relative block max-w-[10rem] break-words font-serif text-[1.45rem] font-medium leading-tight text-[#2F1642] sm:text-[1.75rem]">
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex justify-center">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#7A4EAB]/25 bg-white/85 px-5 text-sm font-semibold text-[#7A4EAB] shadow-soft transition hover:-translate-y-0.5 hover:bg-[#EDE4F7]"
            onClick={() => setShowAllCategories((current) => !current)}
            type="button"
          >
            {showAllCategories ? "Vis færre kategorier" : "Se alle kategorier"}
          </button>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
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

      <section className="mt-7 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-semibold text-[#2F2633]">
          Hvad søger du?
          <input
            className="h-12 rounded-input border border-olive/15 px-4 text-base font-normal outline-none transition focus:border-[#7A4EAB]"
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
    </form>
  );
}
