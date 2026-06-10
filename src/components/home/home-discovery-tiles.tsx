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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map((tile) => {
          const content = (
            <>
              <div className="absolute inset-0 bg-sage-50">
                {tile.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="h-full w-full object-cover" src={tile.imageUrl} />
                ) : (
                  <div className="grid h-full place-items-center bg-gradient-to-br from-sage-50 via-cream to-white text-olive">
                    {tile.tileType === "nearby" ? (
                      <LocateFixed className="size-10 opacity-70" aria-hidden="true" />
                    ) : (
                      <span className="text-4xl" aria-hidden="true">✨</span>
                    )}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-ink/72 via-ink/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 grid min-h-[118px] content-end p-4 text-left text-white sm:min-h-[128px]">
                <h2 className="line-clamp-2 min-h-[2.5rem] text-lg font-semibold leading-tight sm:min-h-[3rem] sm:text-xl">{tile.title}</h2>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-white/82 sm:text-sm">{tile.description}</p>
              </div>
            </>
          );

          if (tile.tileType === "nearby") {
            return (
              <button
                className="relative aspect-square overflow-hidden rounded-[1.25rem] shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
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
              className="relative aspect-square overflow-hidden rounded-[1.25rem] shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
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
