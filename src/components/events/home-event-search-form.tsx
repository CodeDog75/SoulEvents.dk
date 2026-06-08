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
  };
};

const popularCategoryNames = ["Yoga", "Lydbad", "Saunagus", "Healing", "Breathwork", "Ceremonier"];
const categoryStyles: Record<string, { emoji: string; className: string }> = {
  Yoga: { emoji: "\ud83e\uddd8", className: "bg-sage-50 text-olive border-sage-700/15" },
  Lydbad: { emoji: "\ud83d\udd14", className: "bg-cream text-olive border-olive/15" },
  Saunagus: { emoji: "\ud83d\udd25", className: "bg-rose/10 text-olive border-rose/20" },
  Healing: { emoji: "\u2728", className: "bg-white text-olive border-sage-700/15" },
  Breathwork: { emoji: "\ud83c\udf2c\ufe0f", className: "bg-sage-50/70 text-olive border-sage-700/15" },
  Ceremonier: { emoji: "\ud83c\udf15", className: "bg-cream text-olive border-olive/15" },
};

const priorityAreas = ["sjaelland-og-oerne", "fyn", "sonderjylland", "midtjylland", "nordjylland"];

function categoryClass(active: boolean, categoryName: string) {
  const style = categoryStyles[categoryName]?.className ?? "bg-white text-olive border-olive/15";

  return [
    "group min-h-[92px] rounded-2xl border p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift",
    active ? "border-olive bg-olive text-white" : style,
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

    for (const key of ["q", "area", "category_label"]) {
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
      className="w-full max-w-full rounded-card bg-white p-4 shadow-soft sm:p-6"
      onSubmit={submitForm}
      ref={formRef}
    >
      <input name="latitude" type="hidden" defaultValue={selected.latitude} />
      <input name="longitude" type="hidden" defaultValue={selected.longitude} />

      <section className="grid gap-3">
        <div>
          <button
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-rose px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            onClick={findNearby}
            type="button"
          >
            <LocateFixed className="size-4 shrink-0" aria-hidden="true" />
            Find events i nærheden
          </button>
          {locationMessage && <p className="mt-2 text-sm font-semibold text-olive">{locationMessage}</p>}
        </div>

        <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="grid gap-2 text-sm font-semibold text-olive">
            Område
            <select
              className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-rose"
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
            className="inline-flex min-h-12 items-center justify-center rounded-button bg-olive px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            type="submit"
          >
            Søg i valgt område
          </button>
        </div>
      </section>

      <section className="mt-6" id="categories">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-rose">Populære kategorier</p>
            <h2 className="mt-1 text-2xl font-medium text-olive">Find det, der kalder</h2>
          </div>
          <button
            className="shrink-0 text-sm font-semibold text-olive transition hover:text-rose"
            onClick={() => setShowAllCategories((current) => !current)}
            type="button"
          >
            {showAllCategories ? "Vis færre" : "Se alle kategorier"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {visibleCategories.map((category) => {
            const emoji = categoryStyles[category.name]?.emoji ?? "\u2728";

            return (
              <button
                className={categoryClass(selected.categoryLabel === category.value, category.name)}
                key={category.name}
                name="category_label"
                type="submit"
                value={category.value}
              >
                <span className="block text-2xl" aria-hidden="true">
                  {emoji}
                </span>
                <span className="mt-3 block break-words text-sm font-semibold leading-snug">{category.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-7 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-semibold text-olive">
          Søg mere specifikt
          <input
            className="h-12 rounded-input border border-olive/15 px-4 text-base font-normal outline-none transition focus:border-rose"
            defaultValue={selected.q}
            name="q"
            placeholder="Søg efter events, facilitatorer eller steder..."
            type="search"
          />
        </label>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button bg-olive px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
          type="submit"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          Søg
        </button>
      </section>
    </form>
  );
}
