"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPinned } from "lucide-react";

type MapEvent = {
  id: string;
  title: string;
  startsAt: string;
  priceCents: number;
  latitude: number | null;
  longitude: number | null;
  facilitatorName: string;
  categoryName: string | null;
  categoryColor: string | null;
};

type EventMapProps = {
  events: MapEvent[];
  mapboxToken: string;
};

function formatPrice(priceCents: number) {
  if (priceCents === 0) {
    return "Gratis";
  }

  return `${new Intl.NumberFormat("da-DK").format(priceCents / 100)} kr.`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markerColor(color: string | null) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#D89A94";
}

function popupHtml(event: MapEvent) {
  const categoryName = event.categoryName ? escapeHtml(event.categoryName) : "";
  const title = escapeHtml(event.title);
  const facilitatorName = escapeHtml(event.facilitatorName);
  const color = markerColor(event.categoryColor);

  return `
    <div style="font-family: Arial, sans-serif; color: #17243b; min-width: 220px;">
      ${
        categoryName
          ? `<div style="display:inline-block; background:${color}; color:white; border-radius:4px; padding:3px 7px; font-size:11px; font-weight:700; margin-bottom:8px;">${categoryName}</div>`
          : ""
      }
      <h3 style="font-size:15px; margin:0 0 6px; line-height:1.3;">${title}</h3>
      <p style="font-size:12px; margin:0 0 8px; color:#4b5563;">${facilitatorName}</p>
      <p style="font-size:12px; margin:0 0 8px;">${new Intl.DateTimeFormat("da-DK", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(event.startsAt))}</p>
      <p style="font-size:12px; margin:0 0 10px; font-weight:700;">${formatPrice(event.priceCents)}</p>
      <a href="/events/${event.id}" style="font-size:12px; color:#b96e52; font-weight:700;">Se event</a>
    </div>
  `;
}

export function EventMap({ events, mapboxToken }: EventMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapError, setMapError] = useState("");

  const mappableEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          typeof event.latitude === "number" &&
          typeof event.longitude === "number" &&
          Number.isFinite(event.latitude) &&
          Number.isFinite(event.longitude),
      ),
    [events],
  );

  useEffect(() => {
    if (!containerRef.current || !mapboxToken || mappableEvents.length === 0) {
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [10.2, 56.1],
      zoom: 5.9,
      cooperativeGestures: true,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");

    const bounds = new mapboxgl.LngLatBounds();
    const markers: mapboxgl.Marker[] = [];

    mappableEvents.forEach((event) => {
      if (event.longitude === null || event.latitude === null) {
        return;
      }

      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.setAttribute("aria-label", event.title);
      markerElement.style.width = "18px";
      markerElement.style.height = "18px";
      markerElement.style.borderRadius = "999px";
      markerElement.style.border = "2px solid white";
      markerElement.style.background = markerColor(event.categoryColor);
      markerElement.style.boxShadow = "0 8px 18px rgba(23,36,59,.25)";
      markerElement.style.cursor = "pointer";

      const marker = new mapboxgl.Marker({ element: markerElement })
        .setLngLat([event.longitude, event.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(popupHtml(event)))
        .addTo(map);

      markers.push(marker);
      bounds.extend([event.longitude, event.latitude]);
    });

    map.on("load", () => {
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: 70,
          maxZoom: 9,
          duration: 0,
        });
      }
    });

    map.on("error", () => {
      setMapError("Kortet kunne ikke indlæses. Tjek Mapbox-token.");
    });

    return () => {
      markers.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, mappableEvents]);

  if (!mapboxToken) {
    return (
      <section className="rounded-card bg-white p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <MapPinned className="mt-1 size-5 text-terracotta" aria-hidden="true" />
          <div>
            <h2 className="text-3xl font-medium text-olive">Danmarkskort</h2>
            <p className="mt-1 text-sm leading-6 text-ink/64">
              Tilføj `NEXT_PUBLIC_MAPBOX_TOKEN` i `.env` for at aktivere kortet.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (mappableEvents.length === 0) {
    return (
      <section className="rounded-card bg-white p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <MapPinned className="mt-1 size-5 text-sage-700" aria-hidden="true" />
          <div>
            <h2 className="text-3xl font-medium text-olive">Danmarkskort</h2>
            <p className="mt-1 text-sm leading-6 text-ink/64">
              Ingen af de viste events har kortplacering endnu. Tjek at eventet har adresse, postnummer og by, og at
              Mapbox-token er sat op.
            </p>
          </div>
        </div>
        {events.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {events.slice(0, 6).map((event) => (
              <Link className="rounded-button bg-sage-50 px-3 py-2 text-sm font-semibold text-sage-700" href={`/events/${event.id}`} key={event.id}>
                {event.title}
              </Link>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-card bg-white shadow-soft" id="map">
      <div className="border-b border-olive/10 px-6 py-5">
        <h2 className="text-3xl font-medium text-olive">Danmarkskort</h2>
        <p className="mt-1 text-sm text-ink/64">Markører er farvekodet efter eventets første kategori.</p>
        {mapError && <p className="mt-2 text-sm font-semibold text-terracotta">{mapError}</p>}
      </div>
      <div className="h-[620px] w-full" ref={containerRef} />
    </section>
  );
}
