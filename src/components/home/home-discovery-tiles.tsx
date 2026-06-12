"use client";

import { LocateFixed } from "lucide-react";

export type HomeDiscoveryTile = {
  id: string;
  title: string;
  description: string;
  href: string;
  imageUrl: string | null;
  tileType: "navigation" | "category" | "campaign" | "nearby";
};

function goToNearby() {
  if (!navigator.geolocation) {
    window.location.assign("/#events");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const params = new URLSearchParams({
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
        distance: "50",
      });
      window.location.assign("/?" + params.toString() + "#events");
    },
    () => {
      window.location.assign("/#events");
    },
    { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
  );
}

export function HomeDiscoveryTiles({ tiles }: { tiles: HomeDiscoveryTile[] }) {
  return (
    <section aria-label="Udforsk SoulEvents" className="w-full">
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {tiles.map((tile) => {
          const content = (
            <>
              <div className="absolute inset-0 bg-[#EDE4F7]">
                {tile.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="h-full w-full scale-105 object-cover transition duration-500 group-hover:scale-110" loading="lazy" src={tile.imageUrl} />
                ) : (
                  <div className="grid h-full place-items-center bg-gradient-to-br from-[#EDE4F7] via-[#FAF6EF] to-white text-olive">
                    {tile.tileType === "nearby" ? (
                      <LocateFixed className="size-10 opacity-70" aria-hidden="true" />
                    ) : (
                      <span className="text-4xl" aria-hidden="true">✨</span>
                    )}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#12091B]/95 via-[#2F1642]/70 via-55% to-black/10" />
              <div className="absolute inset-x-0 bottom-0 grid min-h-[132px] content-end p-4 text-left text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] sm:min-h-[142px] sm:p-5">
                <h2 className="line-clamp-2 min-h-[2.5rem] text-lg font-bold leading-tight text-white sm:min-h-[3rem] sm:text-xl">{tile.title}</h2>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs font-medium leading-5 text-white/95 sm:text-sm">{tile.description}</p>
              </div>
            </>
          );

          if (tile.tileType === "nearby") {
            return (
              <button
                className="group relative aspect-square overflow-hidden rounded-[1.75rem] border border-white/70 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                key={tile.id}
                onClick={goToNearby}
                type="button"
              >
                {content}
              </button>
            );
          }

          return (
            <a
              className="relative aspect-square overflow-hidden rounded-[1.5rem] shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              href={tile.href}
              key={tile.id}
            >
              {content}
            </a>
          );
        })}
      </div>
    </section>
  );
}
