"use client";

import { LocateFixed, MapPinned, Search } from "lucide-react";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { areaOptions } from "@/lib/regions/areas";

type HomeEventSearchFormProps = {
  categories: Array<{
    name: string;
  }>;
};

const distanceOptions = [
  { label: "Indenfor 25 km", value: "25" },
  { label: "Indenfor 50 km", value: "50" },
  { label: "Indenfor 100 km", value: "100" },
];

export function HomeEventSearchForm({ categories }: HomeEventSearchFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [locationMode, setLocationMode] = useState<"area" | "nearby">("area");
  const [locationMessage, setLocationMessage] = useState("");

  function submitWithLocation(event: FormEvent<HTMLFormElement>) {
    const form = formRef.current;

    if (!form || locationMode !== "nearby") {
      return;
    }

    const latitude = (form.elements.namedItem("latitude") as HTMLInputElement | null)?.value;
    const longitude = (form.elements.namedItem("longitude") as HTMLInputElement | null)?.value;

    if (latitude && longitude) {
      return;
    }

    event.preventDefault();

    if (!navigator.geolocation) {
      setLocationMessage("Din browser understøtter ikke placering.");
      return;
    }

    setLocationMessage("Finder din placering...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitudeInput = form.elements.namedItem("latitude") as HTMLInputElement | null;
        const longitudeInput = form.elements.namedItem("longitude") as HTMLInputElement | null;

        if (latitudeInput && longitudeInput) {
          latitudeInput.value = String(position.coords.latitude);
          longitudeInput.value = String(position.coords.longitude);
        }

        form.requestSubmit();
      },
      () => {
        setLocationMessage("Placering kunne ikke hentes. Tillad placering i browseren og prøv igen.");
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    );
  }

  return (
    <form
      action="/events"
      aria-label="Søg events"
      className="grid gap-4 rounded-card bg-white p-4 shadow-soft lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-end"
      onSubmit={submitWithLocation}
      ref={formRef}
    >
      <input name="latitude" type="hidden" />
      <input name="longitude" type="hidden" />

      <label className="grid gap-2 text-sm font-semibold text-olive">
        Søgeord
        <input
          className="h-14 rounded-input border border-olive/15 px-4 text-base font-normal outline-none transition focus:border-rose"
          name="q"
          placeholder="Yoga, retreat, healing..."
          type="search"
        />
      </label>

      <div className="grid gap-2 text-sm font-semibold text-olive">
        Lokation
        <div className="grid grid-cols-2 rounded-input border border-olive/15 bg-cream p-1">
          <button
            className={`flex h-12 items-center justify-center gap-2 rounded-[14px] px-3 text-sm transition ${
              locationMode === "area" ? "bg-white text-olive shadow-soft" : "text-ink/64 hover:text-olive"
            }`}
            onClick={() => setLocationMode("area")}
            type="button"
          >
            <MapPinned className="size-4" aria-hidden="true" />
            Område
          </button>
          <button
            className={`flex h-12 items-center justify-center gap-2 rounded-[14px] px-3 text-sm transition ${
              locationMode === "nearby" ? "bg-white text-olive shadow-soft" : "text-ink/64 hover:text-olive"
            }`}
            onClick={() => setLocationMode("nearby")}
            type="button"
          >
            <LocateFixed className="size-4" aria-hidden="true" />
            Min placering
          </button>
        </div>
      </div>

      {locationMode === "area" ? (
        <label className="grid gap-2 text-sm font-semibold text-olive">
          Lokation efter område
          <select
            className="h-14 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-rose"
            name="area"
          >
            <option value="">Hele Danmark</option>
            {areaOptions.map((area) => (
              <option key={area.value} value={area.value}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="grid gap-2 text-sm font-semibold text-olive">
          Lokation efter min placering
          <select
            className="h-14 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-rose"
            name="distance"
          >
            {distanceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="grid gap-2 text-sm font-semibold text-olive">
        Kategori
        <select
          className="h-14 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-rose"
          name="category_label"
        >
          <option>Alle kategorier</option>
          {categories.map((category) => (
            <option key={category.name}>{category.name}</option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-olive">
        Periode
        <select
          className="h-14 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-rose"
          name="date"
        >
          <option value="">Alle kommende</option>
          <option value="today">I dag</option>
          <option value="week">Denne uge</option>
          <option value="month">Denne måned</option>
        </select>
      </label>

      <button
        className="inline-flex h-14 items-center justify-center gap-2 rounded-button bg-rose px-7 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
        type="submit"
      >
        <Search className="size-4" aria-hidden="true" />
        Søg events
      </button>

      {locationMessage && <p className="text-sm font-semibold text-olive lg:col-span-full">{locationMessage}</p>}
    </form>
  );
}





