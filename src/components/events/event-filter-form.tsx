"use client";

import { Search } from "lucide-react";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { areaOptions } from "@/lib/regions/areas";

type Category = {
  id: string;
  name: string;
};

type EventFilterFormProps = {
  categories: Category[];
  selected: {
    q: string;
    area: string;
    category: string;
    price: string;
    date: string;
    distance: string;
    latitude: string;
    longitude: string;
  };
};

const priceOptions = [
  { label: "Alle priser", value: "" },
  { label: "Gratis", value: "free" },
  { label: "Under 250 kr.", value: "under-250" },
  { label: "250-500 kr.", value: "250-500" },
  { label: "500-1000 kr.", value: "500-1000" },
  { label: "Over 1000 kr.", value: "over-1000" },
];

const dateOptions = [
  { label: "Alle kommende", value: "" },
  { label: "I dag", value: "today" },
  { label: "Denne uge", value: "week" },
  { label: "Denne måned", value: "month" },
];

const distanceOptions = [
  { label: "Hele Danmark", value: "" },
  { label: "Indenfor 25 km", value: "25" },
  { label: "Indenfor 50 km", value: "50" },
  { label: "Indenfor 100 km", value: "100" },
];

export function EventFilterForm({ categories, selected }: EventFilterFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [locationMessage, setLocationMessage] = useState("");

  function submitWithLocation(event?: FormEvent<HTMLFormElement>) {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const distance = formData.get("distance");
    const latitude = formData.get("latitude");
    const longitude = formData.get("longitude");

    if (!distance || (latitude && longitude)) {
      return;
    }

    event?.preventDefault();

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
    <form className="rounded-card bg-white p-5 shadow-soft" onSubmit={submitWithLocation} ref={formRef}>
      <input name="latitude" type="hidden" defaultValue={selected.latitude} />
      <input name="longitude" type="hidden" defaultValue={selected.longitude} />

      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-sage-50 text-olive">
          <Search className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-3xl font-medium text-olive">Find begivenheder</h2>
          <p className="text-sm text-ink/64">Filtrer efter område, afstand, kategori, pris og periode.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_1fr_auto]">
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Søgeord
          <input
            className="h-12 rounded-input border border-olive/15 px-4 text-base outline-none transition focus:border-rose"
            defaultValue={selected.q}
            name="q"
            placeholder="Meditation, retreat, lydbad..."
            type="search"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Lokation efter område
          <select
            className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base outline-none transition focus:border-rose"
            defaultValue={selected.area}
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

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Lokation efter min placering
          <select
            className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base outline-none transition focus:border-rose"
            defaultValue={selected.distance}
            name="distance"
          >
            {distanceOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Kategori
          <select
            className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base outline-none transition focus:border-rose"
            defaultValue={selected.category}
            name="category"
          >
            <option value="">Alle kategorier</option>
            {[...categories].sort((a, b) => a.name.localeCompare(b.name, "da-DK")).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Pris
          <select
            className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base outline-none transition focus:border-rose"
            defaultValue={selected.price}
            name="price"
          >
            {priceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Periode
          <select
            className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base outline-none transition focus:border-rose"
            defaultValue={selected.date}
            name="date"
          >
            {dateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            className="h-12 w-full rounded-button bg-rose px-5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            type="submit"
          >
            Søg
          </button>
        </div>
      </div>

      {locationMessage && <p className="mt-3 text-sm font-semibold text-olive">{locationMessage}</p>}
    </form>
  );
}







