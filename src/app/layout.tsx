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
      <body>
        <Script id="soulevents-gcr-attribute-cleanup" strategy="beforeInteractive">
          {`
            (() => {
              // Chrome/Google on iOS can inject private __gcr* attributes into
              // <html> and into public search/filter forms before React hydrates,
              // which creates a real hydration mismatch. Keep this cleanup limited
              // to explicitly marked surfaces and remove only those injected private attributes.
              const rootSelector = '[data-soulevents-gcr-cleanup-root="true"]';
              const observedRoots = new WeakSet();
              const observers = [];
              const clean = (element) => {
                if (!(element instanceof Element)) return;

                for (const attribute of Array.from(element.attributes || [])) {
                  if (attribute.name.startsWith("__gcr")) {
                    element.removeAttribute(attribute.name);
                  }
                }
              };

              const cleanRoot = (root) => {
                if (!(root instanceof Element)) return;
                clean(root);
                root.querySelectorAll("*").forEach(clean);
              };

              const attachRootObserver = (root) => {
                if (!(root instanceof Element) || observedRoots.has(root)) return;
                observedRoots.add(root);
                cleanRoot(root);

                if (typeof MutationObserver === "undefined") return;

                const observer = new MutationObserver((mutations) => {
                  for (const mutation of mutations) {
                    if (
                      mutation.type === "attributes" &&
                      mutation.target instanceof Element &&
                      mutation.attributeName?.startsWith("__gcr")
                    ) {
                      mutation.target.removeAttribute(mutation.attributeName);
                    }
                  }
                });
                observer.observe(root, { attributes: true, subtree: true });
                observers.push(observer);
              };

              const attachMarkedRoots = () => {
                document.querySelectorAll(rootSelector).forEach(attachRootObserver);
              };

              clean(document.documentElement);

              window.__souleventsGcrCleanupObservers?.forEach?.((observer) => observer.disconnect());
              window.__souleventsGcrCleanupObservers = observers;

              attachMarkedRoots();

              if (typeof MutationObserver === "undefined") return;

              const documentElementObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                  if (
                    mutation.type === "attributes" &&
                    mutation.target === document.documentElement &&
                    mutation.attributeName?.startsWith("__gcr")
                  ) {
                    document.documentElement.removeAttribute(mutation.attributeName);
                  }
                }
              });
              documentElementObserver.observe(document.documentElement, { attributes: true });
              observers.push(documentElementObserver);

              const finder = new MutationObserver(() => {
                attachMarkedRoots();
              });

              finder.observe(document.documentElement, { childList: true, subtree: true });
              window.__souleventsGcrCleanupFinder?.disconnect?.();
              window.__souleventsGcrCleanupFinder = finder;

              window.addEventListener(
                "DOMContentLoaded",
                () => {
                  attachMarkedRoots();
                  finder.disconnect();
                  if (window.__souleventsGcrCleanupFinder === finder) {
                    delete window.__souleventsGcrCleanupFinder;
                  }
                },
                { once: true }
              );
            })();
          `}
        </Script>
        {children}
        <CookieConsentManager />
        <BrowserInjectedAttributeCleanup />
      </body>
    </html>
  );
}
