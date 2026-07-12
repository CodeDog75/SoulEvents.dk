import type { Metadata } from "next";
import { CookieConsentManager } from "@/components/cookie-consent-manager";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoulEvents.dk",
  description: "Find events, arrangører og fællesskaber i Danmark.",
};

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
        <script dangerouslySetInnerHTML={{ __html: browserInjectedAttributeCleanup }} />
      </body>
    </html>
  );
}
