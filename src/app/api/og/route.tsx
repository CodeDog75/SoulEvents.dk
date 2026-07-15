import { ImageResponse } from "next/og";
import { getHomepageOgImageUrl, getOgLogoUrl, ogImageHeight, ogImageWidth, truncateText } from "@/lib/open-graph";

export const runtime = "edge";
export const revalidate = 3600;

function safeUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function textParam(url: URL, key: string, fallback: string, maxLength: number) {
  return truncateText((url.searchParams.get(key) || fallback).replace(/\s+/g, " ").trim(), maxLength);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const title = textParam(url, "title", "SoulEvents.dk", 82);
  const subtitle = textParam(url, "subtitle", "Find events, arrangører og fællesskaber i Danmark.", 130);
  const requestedImageUrl = safeUrl(url.searchParams.get("image"));
  const [fallbackImageUrl, logoUrl] = await Promise.all([getHomepageOgImageUrl(), getOgLogoUrl()]);
  const backgroundImageUrl = requestedImageUrl || fallbackImageUrl;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#FAF6EF",
          color: "#2F2633",
          display: "flex",
          height: "100%",
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        {backgroundImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            src={backgroundImageUrl}
            style={{
              height: "100%",
              objectFit: "cover",
              position: "absolute",
              width: "100%",
            }}
          />
        ) : null}
        <div
          style={{
            background:
              "linear-gradient(90deg, rgba(47,38,51,0.78) 0%, rgba(47,38,51,0.46) 45%, rgba(47,38,51,0.12) 100%), linear-gradient(0deg, rgba(250,246,239,0.20), rgba(250,246,239,0.20))",
            inset: 0,
            position: "absolute",
          }}
        />
        <div
          style={{
            bottom: 54,
            display: "flex",
            flexDirection: "column",
            gap: 22,
            left: 62,
            maxWidth: 780,
            position: "absolute",
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "rgba(255,255,255,0.92)",
              borderRadius: 22,
              display: "flex",
              height: 112,
              justifyContent: "center",
              padding: "16px 22px",
              width: 248,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="SoulEvents"
              src={logoUrl}
              style={{
                maxHeight: 82,
                maxWidth: 204,
                objectFit: "contain",
              }}
            />
          </div>
          <div
            style={{
              color: "white",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              textShadow: "0 3px 24px rgba(0,0,0,0.38)",
            }}
          >
            <h1
              style={{
                fontFamily: "Georgia, serif",
                fontSize: title.length > 56 ? 50 : 60,
                fontWeight: 500,
                letterSpacing: 0,
                lineHeight: 1.06,
                margin: 0,
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.28,
                margin: 0,
                maxWidth: 720,
              }}
            >
              {subtitle}
            </p>
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            background: "rgba(250,246,239,0.92)",
            borderRadius: 999,
            color: "#7A4EAB",
            display: "flex",
            fontSize: 22,
            fontWeight: 700,
            padding: "16px 24px",
            position: "absolute",
            right: 54,
            top: 54,
          }}
        >
          soulevents.dk
        </div>
      </div>
    ),
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
      height: ogImageHeight,
      width: ogImageWidth,
    },
  );
}
