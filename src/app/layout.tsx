import type { Metadata } from "next";
import Script from "next/script";
import { BrowserInjectedAttributeCleanup } from "@/components/browser-injected-attribute-cleanup";
import { CookieConsentManager } from "@/components/cookie-consent-manager";
import { getSiteFaviconUrl } from "@/lib/brand-logo";
import { createPageMetadata, getHomepageOgImageUrl, siteBaseUrl } from "@/lib/open-graph";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const [faviconUrl, homepageImageUrl] = await Promise.all([getSiteFaviconUrl(), getHomepageOgImageUrl()]);
  const metadata = createPageMetadata({
    title: "SoulEvents.dk",
    description: "Find events, arrangører og fællesskaber i Danmark.",
    imageTitle: "SoulEvents.dk",
    imageSubtitle: "Find events, arrangører og fællesskaber i Danmark.",
    imageUrl: homepageImageUrl,
    path: "/",
  });

  return {
    ...metadata,
    icons: faviconUrl ? { icon: [{ url: faviconUrl }] } : undefined,
    metadataBase: new URL(siteBaseUrl()),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <head>
        <Script
          id="soulevents-gcr-attribute-cleanup"
          src="/browser-injected-attribute-cleanup.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        {children}
        <CookieConsentManager />
        <BrowserInjectedAttributeCleanup />
      </body>
    </html>
  );
}
