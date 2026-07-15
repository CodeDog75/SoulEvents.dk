import type { Metadata } from "next";
import Script from "next/script";
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

const browserInjectedAttributeCleanup = `
(() => {
  const removeInjectedAttributes = () => {
    const elements = [document.documentElement, document.body, ...document.querySelectorAll("[__gcruniqueid], [__gcrremoteframetoken]")].filter(Boolean);

    for (const element of elements) {
      for (const attribute of Array.from(element.attributes || [])) {
        if (attribute.name.startsWith("__gcr")) {
          element.removeAttribute(attribute.name);
        }
      }
    }
  };

  removeInjectedAttributes();

  if (typeof MutationObserver !== "undefined") {
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName?.startsWith("__gcr")) {
          mutation.target.removeAttribute(mutation.attributeName);
        }
      }
    }).observe(document.documentElement, { attributes: true, subtree: true });
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da" suppressHydrationWarning>
      <body>
        {children}
        <CookieConsentManager />
        <Script
          dangerouslySetInnerHTML={{ __html: browserInjectedAttributeCleanup }}
          id="browser-injected-attribute-cleanup"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
