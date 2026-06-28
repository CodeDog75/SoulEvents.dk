"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { CalendarDays, HeartHandshake, MapPinned } from "lucide-react";

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
  imageUrl?: string | null;
  eventFormat?: string | null;
  distanceKm?: number | null;
};

type MapServiceProvider = {
  id: string;
  name: string;
  serviceTitles: string[];
  city: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
};

type EventMapProps = {
  events: MapEvent[];
  mapboxToken: string;
  mapboxStyleUrl?: string;
  serviceProviders?: MapServiceProvider[];
};

type MapViewMode = "events" | "providers";

type EventGroup = {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  events: MapEvent[];
};

const popupCss = `
.mapboxgl-popup.soulevents-map-popup {
  z-index: 20;
}
.mapboxgl-popup.soulevents-map-popup .mapboxgl-popup-content {
  background: #F6F1E7;
  border: 1px solid rgba(127, 148, 102, 0.2);
  border-radius: 18px;
  box-shadow: 0 18px 45px rgba(47, 79, 62, 0.22);
  color: #2F4F3E;
  max-width: min(330px, calc(100vw - 32px));
  padding: 0;
  max-height: min(340px, calc(100vh - 140px));
  overflow: hidden;
}
.mapboxgl-popup.soulevents-map-popup .mapboxgl-popup-tip {
  border-top-color: #F6F1E7;
  border-bottom-color: #F6F1E7;
}
.mapboxgl-popup.soulevents-map-popup .mapboxgl-popup-close-button {
  align-items: center;
  background: rgba(246, 241, 231, 0.94);
  border-radius: 999px;
  color: #2F4F3E;
  display: flex;
  font-size: 30px;
  font-weight: 400;
  height: 40px;
  justify-content: center;
  line-height: 1;
  right: 7px;
  top: 7px;
  width: 40px;
  z-index: 3;
}
.mapboxgl-popup.soulevents-map-popup .mapboxgl-popup-close-button:hover,
.mapboxgl-popup.soulevents-map-popup .mapboxgl-popup-close-button:focus-visible {
  background: rgba(127, 148, 102, 0.16);
  outline: none;
}
@media (max-width: 640px) {
  .mapboxgl-popup.soulevents-map-popup .mapboxgl-popup-content {
    max-width: min(310px, calc(100vw - 28px));
    max-height: min(300px, calc(100vh - 150px));
  }
}
`;

function distanceInMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadiusM = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDistance = toRadians(to.latitude - from.latitude);
  const longitudeDistance = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const a =
    Math.sin(latitudeDistance / 2) * Math.sin(latitudeDistance / 2) +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDistance / 2) * Math.sin(longitudeDistance / 2);

  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function uniqueEventsById(events: MapEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function markerColor(color: string | null) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#7F9466";
}

function groupEventsByLocation(events: MapEvent[]) {
  const groups: EventGroup[] = [];
  const groupingRadiusMeters = 35;

  for (const event of uniqueEventsById(events)) {
    if (
      event.eventFormat === "online" ||
      typeof event.latitude !== "number" ||
      typeof event.longitude !== "number" ||
      !Number.isFinite(event.latitude) ||
      !Number.isFinite(event.longitude)
    ) {
      continue;
    }

    const matchingGroup = groups.find(
      (group) =>
        distanceInMeters(
          { latitude: group.latitude, longitude: group.longitude },
          { latitude: event.latitude as number, longitude: event.longitude as number },
        ) <= groupingRadiusMeters,
    );

    if (matchingGroup) {
      matchingGroup.events.push(event);
      const count = matchingGroup.events.length;
      matchingGroup.latitude = matchingGroup.latitude + ((event.latitude as number) - matchingGroup.latitude) / count;
      matchingGroup.longitude = matchingGroup.longitude + ((event.longitude as number) - matchingGroup.longitude) / count;
    } else {
      groups.push({
        id: event.latitude.toFixed(6) + "," + event.longitude.toFixed(6),
        latitude: event.latitude,
        longitude: event.longitude,
        color: markerColor(event.categoryColor),
        events: [event],
      });
    }
  }

  return groups.map((group) => ({
    ...group,
    id: group.events.map((event) => event.id).sort().join("|"),
    events: group.events.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
  }));
}

function formatPrice(priceCents: number) {
  if (priceCents === 0) return "Gratis";
  return new Intl.NumberFormat("da-DK").format(priceCents / 100) + " kr.";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function eventPopupItem(event: MapEvent, isFirst: boolean, compact = false) {
  const title = escapeHtml(event.title);
  const facilitatorName = escapeHtml(event.facilitatorName);
  const categoryName = event.categoryName ? escapeHtml(event.categoryName) : "";
  const date = new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.startsAt));
  const distance =
    typeof event.distanceKm === "number"
      ? "<p style=\"font-size:12px; margin:6px 0 0; color:#5f734d; font-weight:700;\">📍 " + Math.round(event.distanceKm) + " km væk</p>"
      : "";
  const categoryBadge = categoryName
    ? "<div style=\"display:inline-flex; width:max-content; max-width:100%; background:#7F9466; color:white; border-radius:999px; padding:5px 10px; font-size:11px; font-weight:700; margin-bottom:8px;\">" + categoryName + "</div>"
    : "";

  if (compact) {
    return [
      "<div style=\"display:flex; gap:10px; padding:" + (isFirst ? "0 0 12px" : "12px 0") + "; border-top:" + (isFirst ? "0" : "1px solid rgba(127,148,102,.18)") + ";\">",
      "<span aria-hidden=\"true\" style=\"display:block; width:9px; height:9px; flex:0 0 auto; margin-top:7px; border-radius:999px; background:#7F9466; box-shadow:0 0 0 4px rgba(127,148,102,.15);\"></span>",
      "<div style=\"min-width:0; flex:1;\">",
      "<h3 style=\"font-size:14px; margin:0 34px 4px 0; line-height:1.25; color:#2F4F3E; font-weight:800;\">" + title + "</h3>",
      "<p style=\"font-size:12px; margin:0 0 3px; color:#526456; font-weight:600;\">" + facilitatorName + "</p>",
      "<p style=\"font-size:12px; margin:0 0 8px; color:#2F4F3E;\">" + date + "</p>",
      "<a href=\"/events/" + event.id + "\" style=\"display:inline-flex; min-height:32px; align-items:center; justify-content:center; border-radius:999px; background:transparent; color:#2F4F3E; border:1px solid #2F4F3E; padding:7px 12px; font-size:12px; font-weight:800; text-decoration:none;\">Se event</a>",
      "</div>",
      "</div>",
    ].join("");
  }

  return [
    "<div style=\"display:flex; gap:10px; padding:" + (isFirst ? "0 0 12px" : "14px 0 12px") + "; border-top:" + (isFirst ? "0" : "1px solid rgba(127,148,102,.18)") + ";\">",
    "<span aria-hidden=\"true\" style=\"display:block; width:10px; height:10px; flex:0 0 auto; margin-top:8px; border-radius:999px; background:#7F9466; box-shadow:0 0 0 4px rgba(127,148,102,.15);\"></span>",
    "<div style=\"min-width:0; flex:1;\">",
    categoryBadge,
    "<h3 style=\"font-size:16px; margin:0 34px 6px 0; line-height:1.25; color:#2F4F3E; font-weight:700;\">" + title + "</h3>",
    "<p style=\"font-size:13px; margin:0 0 6px; color:#526456; font-weight:600;\">" + facilitatorName + "</p>",
    "<p style=\"font-size:13px; margin:0 0 6px; color:#2F4F3E;\">" + date + "</p>",
    distance,
    "<p style=\"font-size:13px; margin:8px 0 12px; color:#2F4F3E; font-weight:800;\">" + formatPrice(event.priceCents) + "</p>",
    "<a href=\"/events/" + event.id + "\" style=\"display:inline-flex; min-height:36px; align-items:center; justify-content:center; border-radius:999px; background:transparent; color:#2F4F3E; border:1px solid #2F4F3E; padding:8px 14px; font-size:13px; font-weight:800; text-decoration:none;\">Se event</a>",
    "</div>",
    "</div>",
  ].join("");
}

function servicePopupHtml(provider: MapServiceProvider) {
  const title = escapeHtml(provider.name);
  const serviceTitle = provider.serviceTitles[0] ? escapeHtml(provider.serviceTitles[0]) : "Tilbud og sessioner";
  const place = [provider.city, provider.area].filter(Boolean).map((value) => escapeHtml(String(value))).join(", ");

  return [
    "<div style=\"font-family: Arial, sans-serif; color:#2F4F3E; padding:18px; width:100%;\">",
    "<p style=\"font-size:11px; margin:0 34px 8px 0; color:#7A4EAB; font-weight:800; letter-spacing:.02em; text-transform:uppercase;\">Ydelse</p>",
    "<h3 style=\"font-size:16px; margin:0 34px 6px 0; line-height:1.25; color:#2F4F3E; font-weight:800;\">" + title + "</h3>",
    "<p style=\"font-size:13px; margin:0 0 6px; color:#526456; font-weight:700;\">" + serviceTitle + "</p>",
    place ? "<p style=\"font-size:12px; margin:0 0 12px; color:#526456;\">" + place + "</p>" : "",
    "<a href=\"/facilitators/" + provider.id + "\" style=\"display:inline-flex; min-height:34px; align-items:center; justify-content:center; border-radius:999px; background:transparent; color:#2F4F3E; border:1px solid #2F4F3E; padding:8px 14px; font-size:12px; font-weight:800; text-decoration:none;\">Se profil</a>",
    "</div>",
  ].join("");
}

function popupHtml(group: EventGroup) {
  const firstEvent = group.events[0];
  const image =
    group.events.length === 1 && firstEvent.imageUrl
      ? "<img alt=\"\" src=\"" + escapeHtml(firstEvent.imageUrl) + "\" style=\"width:100%; height:104px; object-fit:cover; display:block;\" />"
      : "";
  const heading =
    group.events.length > 1
      ? "<div style=\"padding:18px 18px 4px;\"><p style=\"font-size:12px; margin:0 34px 8px 0; color:#5f734d; font-weight:800; letter-spacing:.02em; text-transform:uppercase;\">" +
        group.events.length +
        " events her</p><h3 style=\"font-size:17px; margin:0 34px 4px 0; line-height:1.25; color:#2F4F3E;\">Events på samme sted</h3><p style=\"font-size:12px; margin:0; color:#526456;\">Vælg et event herunder.</p></div>"
      : "";

  return [
    "<div style=\"font-family: Arial, sans-serif; color:#2F4F3E; width:100%;\">",
    image,
    heading,
    "<div style=\"padding:" + (group.events.length > 1 ? "6px 18px 10px" : "18px 18px 8px") + "; max-height:" + (group.events.length > 1 ? "185px" : "none") + "; overflow-y:" + (group.events.length > 1 ? "auto" : "visible") + ";\">",
    group.events.map((event, index) => eventPopupItem(event, index === 0, group.events.length > 1)).join(""),
    "</div>",
    "</div>",
  ].join("");
}

function mapHeaderText(mode: MapViewMode) {
  if (mode === "providers") {
    return {
      title: "Ydelser på kort",
      description: "Find behandlere, terapeuter, coaches og andre inspiratorer nær dig.",
    };
  }

  return {
    title: "Alle events på kort",
    description: "Find oplevelser tæt på dig. Klik på markører eller grupper for at se events.",
  };
}

function setMapLayerVisibility(map: mapboxgl.Map, mode: MapViewMode) {
  const eventVisibility = mode === "events" ? "visible" : "none";
  const providerVisibility = mode === "providers" ? "visible" : "none";

  for (const layerId of ["event-clusters", "event-cluster-count", "event-points", "same-place-count"]) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", eventVisibility);
    }
  }

  if (map.getLayer("service-provider-points")) {
    map.setLayoutProperty("service-provider-points", "visibility", providerVisibility);
  }
}

export function EventMap({ events, mapboxToken, mapboxStyleUrl, serviceProviders = [] }: EventMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const viewModeRef = useRef<MapViewMode>("events");
  const [mapError, setMapError] = useState("");
  const [viewMode, setViewMode] = useState<MapViewMode>("events");

  const eventGroups = useMemo(() => groupEventsByLocation(events), [events]);
  const localServiceProviders = useMemo(
    () =>
      serviceProviders.filter(
        (provider) =>
          typeof provider.latitude === "number" &&
          typeof provider.longitude === "number" &&
          Number.isFinite(provider.latitude) &&
          Number.isFinite(provider.longitude),
      ),
    [serviceProviders],
  );
  const visibleEventGroups = useMemo(() => (viewMode === "events" ? eventGroups : []), [eventGroups, viewMode]);
  const visibleServiceProviders = useMemo(
    () => (viewMode === "providers" ? localServiceProviders : []),
    [localServiceProviders, viewMode],
  );
  const hasVisibleMarkers = visibleEventGroups.length > 0 || visibleServiceProviders.length > 0;
  const hasAnyMarkers = eventGroups.length > 0 || localServiceProviders.length > 0;
  const headerText = mapHeaderText(viewMode);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    if (document.getElementById("soulevents-map-popup-style")) return;
    const style = document.createElement("style");
    style.id = "soulevents-map-popup-style";
    style.textContent = popupCss;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !mapboxToken || !hasAnyMarkers) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapboxStyleUrl || "mapbox://styles/mapbox/light-v11",
      center: [10.2, 56.1],
      zoom: 5.9,
      cooperativeGestures: true,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");

    const features = eventGroups.map((group) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [group.longitude, group.latitude],
      },
      properties: {
        id: group.id,
        color: "#D89A94",
        event_count: group.events.length,
        same_place_count: group.events.length,
        same_place_label: group.events.length > 1 ? String(group.events.length) : "",
      },
    }));

    const groupById = new Map(eventGroups.map((group) => [group.id, group]));
    const serviceById = new Map(localServiceProviders.map((provider) => [provider.id, provider]));
    const serviceFeatures = localServiceProviders.map((provider) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [provider.longitude as number, provider.latitude as number],
      },
      properties: { id: provider.id },
    }));

    map.on("load", () => {
      if (features.length > 0) {
        map.addSource("events", {
          type: "geojson",
          data: { type: "FeatureCollection", features },
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 46,
          clusterProperties: {
            event_count_sum: ["+", ["get", "event_count"]],
          },
        });

        map.addLayer({
          id: "event-clusters",
          type: "circle",
          source: "events",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#D89A94",
            "circle-radius": ["step", ["get", "event_count_sum"], 19, 10, 24, 30, 30],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
          },
          layout: { visibility: "visible" },
        });

        map.addLayer({
          id: "event-cluster-count",
          type: "symbol",
          source: "events",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["to-string", ["get", "event_count_sum"]],
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12,
            visibility: "visible",
          },
          paint: { "text-color": "#ffffff" },
        });

        map.addLayer({
          id: "event-points",
          type: "circle",
          source: "events",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": ["case", [">", ["get", "same_place_count"], 1], 13, 9],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
          },
          layout: { visibility: "visible" },
        });

        map.addLayer({
          id: "same-place-count",
          type: "symbol",
          source: "events",
          filter: ["all", ["!", ["has", "point_count"]], [">", ["get", "same_place_count"], 1]],
          layout: {
            "text-field": ["get", "same_place_label"],
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 11,
            visibility: "visible",
          },
          paint: { "text-color": "#ffffff" },
        });
      }

      if (serviceFeatures.length > 0) {
        map.addSource("service-providers", {
          type: "geojson",
          data: { type: "FeatureCollection", features: serviceFeatures },
        });

        map.addLayer({
          id: "service-provider-points",
          type: "circle",
          source: "service-providers",
          layout: { visibility: "none" },
          paint: {
            "circle-color": "#97A184",
            "circle-radius": 9,
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.95,
          },
        });
      }

      if (features.length > 0) {
        map.on("click", "event-clusters", (event) => {
          const featuresAtClick = map.queryRenderedFeatures(event.point, { layers: ["event-clusters"] });
          const clickedFeature = featuresAtClick[0];
          const clusterId = clickedFeature?.properties?.cluster_id;
          const source = map.getSource("events") as mapboxgl.GeoJSONSource;
          if (clusterId === undefined) return;

          source.getClusterExpansionZoom(clusterId, (error, zoom) => {
            if (error || zoom === null || zoom === undefined) return;
            if (!clickedFeature) return;
            const coordinates = (clickedFeature.geometry as GeoJSON.Point).coordinates as [number, number];
            map.easeTo({ center: coordinates, zoom });
          });
        });

        map.on("click", "event-points", (event) => {
          const feature = event.features?.[0];
          const id = feature?.properties?.id;
          const selected = typeof id === "string" ? groupById.get(id) : null;
          if (!selected || !feature) return;
          const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
          const mapCanvas = map.getCanvas();
          const anchor = event.point.y < mapCanvas.clientHeight * 0.48 ? "top" : "bottom";
          const popup = new mapboxgl.Popup({ anchor, offset: 18, className: "soulevents-map-popup", maxWidth: "330px" })
            .setLngLat(coordinates)
            .setHTML(popupHtml(selected))
            .addTo(map);

          requestAnimationFrame(() => {
            const popupElement = popup.getElement();
            if (!popupElement) return;
            const popupBox = popupElement.getBoundingClientRect();
            const mapBox = mapCanvas.getBoundingClientRect();
            let shiftX = 0;
            let shiftY = 0;
            const padding = 14;

            if (popupBox.left < mapBox.left + padding) {
              shiftX = popupBox.left - mapBox.left - padding;
            } else if (popupBox.right > mapBox.right - padding) {
              shiftX = popupBox.right - mapBox.right + padding;
            }

            if (popupBox.top < mapBox.top + padding) {
              shiftY = popupBox.top - mapBox.top - padding;
            } else if (popupBox.bottom > mapBox.bottom - padding) {
              shiftY = popupBox.bottom - mapBox.bottom + padding;
            }

            if (shiftX !== 0 || shiftY !== 0) {
              map.panBy([shiftX, shiftY], { duration: 180 });
            }
          });
        });
      }

      if (serviceFeatures.length > 0) {
        map.on("click", "service-provider-points", (event) => {
          const feature = event.features?.[0];
          const id = feature?.properties?.id;
          const selected = typeof id === "string" ? serviceById.get(id) : null;
          if (!selected || !feature) return;
          const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
          new mapboxgl.Popup({ offset: 16, className: "soulevents-map-popup", maxWidth: "300px" })
            .setLngLat(coordinates)
            .setHTML(servicePopupHtml(selected))
            .addTo(map);
        });
      }

      for (const layerId of ["event-clusters", "event-points", "service-provider-points"]) {
        if (!map.getLayer(layerId)) continue;
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      setMapLayerVisibility(map, viewModeRef.current);

      const initialBounds = new mapboxgl.LngLatBounds();
      if (viewModeRef.current === "providers") {
        localServiceProviders.forEach((provider) => initialBounds.extend([provider.longitude as number, provider.latitude as number]));
      } else {
        eventGroups.forEach((group) => initialBounds.extend([group.longitude, group.latitude]));
      }

      if (!initialBounds.isEmpty()) {
        map.fitBounds(initialBounds, { padding: 70, maxZoom: 9, duration: 0 });
      }
    });

    map.on("error", () => {
      setMapError("Kortet kunne ikke indlæses. Tjek Mapbox-token.");
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, mapboxStyleUrl, hasAnyMarkers, eventGroups, localServiceProviders]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    document.querySelectorAll(".soulevents-map-popup").forEach((element) => element.remove());

    if (map.loaded()) {
      setMapLayerVisibility(map, viewMode);
      return;
    }

    map.once("load", () => {
      setMapLayerVisibility(map, viewMode);
    });
  }, [viewMode]);

  const viewToggle = (
    <div
      className="mt-4 inline-grid w-full max-w-[360px] grid-cols-2 rounded-full border border-rose/35 bg-[#FFF9F5] p-1 shadow-[0_10px_26px_rgba(216,154,148,0.16)] sm:mt-0 sm:w-auto"
      aria-label="Vælg kortvisning"
    >
      {(["events", "providers"] as const).map((mode) => {
        const isSelected = viewMode === mode;
        const Icon = mode === "events" ? CalendarDays : HeartHandshake;
        return (
          <button
            aria-pressed={isSelected}
            className={
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-rose/45 sm:min-h-10 sm:px-5 " +
              (isSelected
                ? "bg-olive text-white shadow-[0_0_0_4px_rgba(216,154,148,0.34)]"
                : "text-olive hover:bg-white hover:text-[#7A4EAB]")
            }
            key={mode}
            onClick={() => setViewMode(mode)}
            type="button"
          >
            <Icon className="size-4" aria-hidden="true" />
            {mode === "events" ? "Events" : "Ydelser"}
          </button>
        );
      })}
    </div>
  );

  if (!mapboxToken) {
    return (
      <section className="rounded-card bg-white p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <MapPinned className="mt-1 size-5 text-terracotta" aria-hidden="true" />
          <div>
            <h2 className="text-3xl font-medium text-olive">Danmarkskort</h2>
            <p className="mt-1 text-sm leading-6 text-ink/64">
              Tilføj NEXT_PUBLIC_MAPBOX_TOKEN i .env.local for at aktivere kortet.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!hasVisibleMarkers) {
    return (
      <section className="rounded-card bg-white p-6 shadow-soft" id="map">
        <div className="flex items-start gap-3">
          <MapPinned className="mt-1 size-5 text-sage-700" aria-hidden="true" />
          <div>
            <h2 className="text-3xl font-medium text-olive">{headerText.title}</h2>
            <p className="mt-1 text-sm leading-6 text-ink/64">{headerText.description}</p>
            {viewToggle}
            <p className="mt-4 text-sm leading-6 text-ink/64">
              {viewMode === "events"
                ? "Ingen af de viste fysiske events har kortplacering endnu. Online events vises ikke som markører på kortet."
                : "Der er endnu ingen ydelser med lokation i denne visning."}
            </p>
          </div>
        </div>
        {viewMode === "events" && events.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {events.slice(0, 6).map((event) => (
              <Link className="rounded-button bg-sage-50 px-3 py-2 text-sm font-semibold text-sage-700" href={"/events/" + event.id} key={event.id}>
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
      <div className="border-b border-olive/10 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-3xl font-medium leading-tight text-olive sm:text-4xl">{headerText.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/64">{headerText.description}</p>
          </div>
          {viewToggle}
        </div>
        {mapError && <p className="mt-2 text-sm font-semibold text-terracotta">{mapError}</p>}
      </div>
      <div className="h-[58vh] min-h-[360px] w-full sm:h-[62vh] sm:min-h-[440px]" ref={containerRef} />
    </section>
  );
}
