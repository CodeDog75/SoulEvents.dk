"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { PartnerAdCarousel, type PartnerAd } from "@/components/ads/partner-ad-carousel";
import { PublicEventList, type PublicEvent } from "@/components/events/public-event-list";

type Subcategory = {
  id: string;
  name: string;
  slug: string;
};

type CategoryEventExplorerProps = {
  allSubcategorySlugs: string[];
  events: PublicEvent[];
  initialSelectedSlugs: string[];
  mainCategoryName: string;
  partnerAds: PartnerAd[];
  returnTo: string;
  selectedArea: string;
  subcategories: Subcategory[];
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function eventMatchesSubcategory(event: PublicEvent, selectedSlugs: string[], subcategories: Subcategory[]) {
  if (selectedSlugs.length === 0) return true;

  const selectedSubcategories = subcategories.filter((subcategory) => selectedSlugs.includes(subcategory.slug));
  const selectedNames = selectedSubcategories.map((subcategory) => normalize(subcategory.name));
  const selectedSlugSet = new Set(selectedSlugs);
  const eventSubcategories = event.event_subcategories ?? [];
  const eventCategories =
    event.event_categories
      ?.map((row) => first(row.categories))
      .filter((category): category is NonNullable<typeof category> => Boolean(category)) ?? [];

  const matchesSubcategorySlug = eventSubcategories.some((row) => {
    const subcategory = first(row.subcategories);
    return Boolean(subcategory?.slug && selectedSlugSet.has(subcategory.slug));
  });

  if (matchesSubcategorySlug) return true;

  const eventNames = [
    ...eventSubcategories.map((row) => first(row.subcategories)?.name).filter((name): name is string => Boolean(name)),
    ...eventCategories.map((category) => category.name),
  ].map(normalize);

  return eventNames.some((eventName) => selectedNames.some((selectedName) => eventName.includes(selectedName) || selectedName.includes(eventName)));
}

export function CategoryEventExplorer({
  allSubcategorySlugs,
  events,
  initialSelectedSlugs,
  mainCategoryName,
  partnerAds,
  returnTo: initialReturnTo,
  selectedArea,
  subcategories,
}: CategoryEventExplorerProps) {
  const initialSelection = initialSelectedSlugs.length > 0 ? initialSelectedSlugs : allSubcategorySlugs;
  const [selectedSlugs, setSelectedSlugs] = useState(initialSelection);
  const [returnTo, setReturnTo] = useState(initialReturnTo);
  const selectedSet = new Set(selectedSlugs);
  const allSelected = selectedSlugs.length === allSubcategorySlugs.length;
  const filteredEvents = useMemo(
    () => (allSelected ? events : events.filter((event) => eventMatchesSubcategory(event, selectedSlugs, subcategories))),
    [allSelected, events, selectedSlugs, subcategories],
  );
  const adInsertIndex = Math.min(6, filteredEvents.length);
  const eventsBeforeAd = filteredEvents.slice(0, adInsertIndex);
  const eventsAfterAd = filteredEvents.slice(adInsertIndex);
  const showPartnerAd = partnerAds.length > 0 && filteredEvents.length > 0;

  function updateUrl(nextSelectedSlugs: string[]) {
    const params = new URLSearchParams();
    if (nextSelectedSlugs.length !== allSubcategorySlugs.length) {
      params.set("sub", nextSelectedSlugs.join(","));
    }
    if (selectedArea) {
      params.set("area", selectedArea);
    }

    const query = params.toString();
    const nextPath = window.location.pathname + (query ? "?" + query : "");
    window.history.replaceState(null, "", nextPath);
    setReturnTo(nextPath);
  }

  function toggleSubcategory(slug: string) {
    const next = selectedSet.has(slug)
      ? selectedSlugs.filter((selectedSlug) => selectedSlug !== slug)
      : [...selectedSlugs, slug];
    const normalizedNext = next.length > 0 ? next : allSubcategorySlugs;
    setSelectedSlugs(normalizedNext);
    updateUrl(normalizedNext);
  }

  function selectAll() {
    setSelectedSlugs(allSubcategorySlugs);
    updateUrl(allSubcategorySlugs);
  }

  return (
    <>
      {subcategories.length > 0 && (
        <section className="mt-6 rounded-card border border-[#EDE4F7] bg-white/88 p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Filtrer emner</p>
              <h2 className="mt-2 text-2xl font-medium text-[#2F2633]">Vælg underkategorier</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/64">
                Filtreringen sker med det samme, så du kan udforske retningen uden at siden hopper.
              </p>
            </div>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#7A4EAB]/18 bg-white px-4 text-sm font-semibold text-[#7A4EAB] transition hover:border-[#7A4EAB]"
              onClick={selectAll}
              type="button"
            >
              Vis alle
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {subcategories.map((subcategory) => {
              const active = selectedSet.has(subcategory.slug);
              return (
                <button
                  aria-pressed={active}
                  className={
                    active
                      ? "rounded-full border border-[#7A4EAB] bg-[#7A4EAB] px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5"
                      : "rounded-full border border-[#7A4EAB]/18 bg-white px-4 py-2 text-sm font-semibold text-[#2F1642] opacity-70 transition hover:opacity-100"
                  }
                  key={subcategory.id}
                  onClick={() => toggleSubcategory(subcategory.slug)}
                  type="button"
                >
                  {subcategory.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Events</p>
            <h2 className="mt-2 text-3xl font-medium text-[#2F2633]">Oplevelser i {mainCategoryName}</h2>
            {selectedArea && <p className="mt-2 text-sm font-semibold text-[#7A4EAB]">Filtreret efter valgt område</p>}
          </div>
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-olive shadow-soft">
            <Sparkles className="size-4 text-[#7A4EAB]" aria-hidden="true" />
            {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
          </p>
        </div>
        {filteredEvents.length > 0 ? (
          <div className="grid gap-8">
            <PublicEventList events={eventsBeforeAd} returnTo={returnTo} />
            {showPartnerAd && <PartnerAdCarousel ads={partnerAds} />}
            {eventsAfterAd.length > 0 && <PublicEventList events={eventsAfterAd} returnTo={returnTo} />}
          </div>
        ) : (
          <section className="rounded-card bg-white p-8 text-center shadow-soft">
            <Sparkles className="mx-auto size-8 text-[#7A4EAB]" aria-hidden="true" />
            <h3 className="mt-4 text-3xl font-medium text-[#2F2633]">Der er endnu ingen events, der matcher dine valg.</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ink/64">
              Prøv at vælge flere emner eller gå tilbage og udforsk en anden retning.
            </p>
          </section>
        )}
      </section>
    </>
  );
}
