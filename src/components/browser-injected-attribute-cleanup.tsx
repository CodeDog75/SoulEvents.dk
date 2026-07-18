"use client";

import { useEffect } from "react";

function removeInjectedAttributes() {
  const elements = [
    document.documentElement,
    document.body,
    ...document.querySelectorAll("[__gcruniqueid], [__gcrremoteframetoken]"),
  ].filter(Boolean);

  for (const element of elements) {
    for (const attribute of Array.from(element.attributes || [])) {
      if (attribute.name.startsWith("__gcr")) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

export function BrowserInjectedAttributeCleanup() {
  useEffect(() => {
    removeInjectedAttributes();

    if (typeof MutationObserver === "undefined") return undefined;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.target instanceof Element && mutation.attributeName?.startsWith("__gcr")) {
          mutation.target.removeAttribute(mutation.attributeName);
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
