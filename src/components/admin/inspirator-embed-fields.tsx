"use client";

import { ArrowDown, ArrowUp, Music2, Trash2 } from "lucide-react";
import { useState } from "react";
import { inspiratorEmbedErrorMessage, maxInspiratorEmbeds, normalizeInspiratorEmbedUrl } from "@/lib/inspiration/embed-links";

export type InspiratorInitialEmbed = {
  id: string;
  sortOrder: number;
  title: string | null;
  url: string;
};

type EmbedSlot = {
  id?: string;
  title: string;
  url: string;
};

function createInitialSlots(initialEmbeds: InspiratorInitialEmbed[] = []) {
  const slots = Array.from({ length: maxInspiratorEmbeds }, () => null) as Array<EmbedSlot | null>;

  initialEmbeds
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, maxInspiratorEmbeds)
    .forEach((embed, index) => {
      slots[index] = {
        id: embed.id,
        title: embed.title ?? "",
        url: embed.url,
      };
    });

  return slots;
}

function emptySlot(): EmbedSlot {
  return {
    title: "",
    url: "",
  };
}

function providerLabel(provider: "spotify" | "youtube") {
  return provider === "spotify" ? "Spotify" : "YouTube";
}

function embedFrameClass(height: "compact" | "tall" | "video") {
  if (height === "video") return "aspect-video w-full";
  return height === "compact" ? "h-[152px] w-full" : "h-[352px] w-full";
}

export function InspiratorEmbedFields({ initialEmbeds = [] }: { initialEmbeds?: InspiratorInitialEmbed[] }) {
  const [slots, setSlots] = useState<Array<EmbedSlot | null>>(() => createInitialSlots(initialEmbeds));

  function updateSlot(index: number, updates: Partial<EmbedSlot>) {
    setSlots((currentSlots) => {
      const nextSlots = [...currentSlots];
      nextSlots[index] = { ...(nextSlots[index] ?? emptySlot()), ...updates };
      return nextSlots;
    });
  }

  function removeSlot(index: number) {
    setSlots((currentSlots) => {
      const nextSlots = [...currentSlots];
      nextSlots[index] = null;
      return nextSlots;
    });
  }

  function moveSlot(index: number, direction: -1 | 1) {
    setSlots((currentSlots) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= currentSlots.length) return currentSlots;
      const nextSlots = [...currentSlots];
      [nextSlots[index], nextSlots[nextIndex]] = [nextSlots[nextIndex], nextSlots[index]];
      return nextSlots;
    });
  }

  return (
    <section className="rounded-2xl border border-[#E5DDEA] bg-[#FAF6EF] p-5">
      <div className="flex items-center gap-2">
        <Music2 className="size-5 text-[#7A5D91]" aria-hidden="true" />
        <h3 className="font-semibold text-[#2F2633]">Musik og videoer</h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#6E6475]">
        Tilføj op til seks Spotify- eller YouTube-links. De vises som afspillere på den offentlige profil.
      </p>

      <div className="mt-4 grid gap-4">
        {slots.map((slot, index) => {
          const normalizedEmbed = slot?.url ? normalizeInspiratorEmbedUrl(slot.url) : null;

          return (
            <div className="rounded-2xl border border-[#E5DDEA] bg-white p-4" key={slot?.id ?? `embed-slot-${index + 1}`}>
              {slot?.id ? <input name={`embed_id_${index + 1}`} type="hidden" value={slot.id} /> : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#2F2633]/75">Indslag {index + 1}</p>
                <div className="flex items-center gap-1">
                  <button className="grid size-8 place-items-center rounded-full text-[#4F4756] transition hover:bg-[#F4F0F7] disabled:text-[#B8B2BE]" disabled={index === 0} onClick={() => moveSlot(index, -1)} type="button">
                    <ArrowUp className="size-4" aria-hidden="true" />
                    <span className="sr-only">Flyt op</span>
                  </button>
                  <button className="grid size-8 place-items-center rounded-full text-[#4F4756] transition hover:bg-[#F4F0F7] disabled:text-[#B8B2BE]" disabled={index === slots.length - 1} onClick={() => moveSlot(index, 1)} type="button">
                    <ArrowDown className="size-4" aria-hidden="true" />
                    <span className="sr-only">Flyt ned</span>
                  </button>
                  <button className="grid size-8 place-items-center rounded-full text-red-700 transition hover:bg-red-50" onClick={() => removeSlot(index)} type="button">
                    <Trash2 className="size-4" aria-hidden="true" />
                    <span className="sr-only">Fjern indslag</span>
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <label className="grid gap-2 text-sm font-semibold text-[#2F2633]/75">
                  Titel <span className="font-normal text-[#6E6475]">Valgfri</span>
                  <input
                    className="h-11 rounded-xl border border-[#D8CBE4] bg-white px-4 text-base outline-none transition focus:border-[#7A5D91]"
                    maxLength={120}
                    name={`embed_title_${index + 1}`}
                    onChange={(event) => updateSlot(index, { title: event.target.value })}
                    placeholder="Fx Nyt album eller Live-session"
                    value={slot?.title ?? ""}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[#2F2633]/75">
                  Spotify- eller YouTube-link
                  <input
                    className="h-11 rounded-xl border border-[#D8CBE4] bg-white px-4 text-base outline-none transition focus:border-[#7A5D91]"
                    maxLength={500}
                    name={`embed_url_${index + 1}`}
                    onChange={(event) => updateSlot(index, { url: event.target.value })}
                    placeholder="https://open.spotify.com/... eller https://youtube.com/watch?v=..."
                    type="url"
                    value={slot?.url ?? ""}
                  />
                </label>
              </div>

              {slot?.url && normalizedEmbed ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5DDEA] bg-[#F4F0F7]">
                  <iframe
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    className={embedFrameClass(normalizedEmbed.height)}
                    loading="lazy"
                    src={normalizedEmbed.embedUrl}
                    title={slot.title || providerLabel(normalizedEmbed.provider)}
                  />
                </div>
              ) : slot?.url ? (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
                  {inspiratorEmbedErrorMessage()}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
