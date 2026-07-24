"use client";

import { useEffect } from "react";

type WindowWithInjectedAttributeObserver = Window & {
  __souleventsGcrCleanupFinder?: MutationObserver;
  __souleventsGcrCleanupObservers?: MutationObserver[];
};

const gcrCleanupRootSelector = '[data-soulevents-gcr-cleanup-root="true"]';

function removeInjectedAttributes(element: Element) {
  for (const attribute of Array.from(element.attributes || [])) {
    if (attribute.name.startsWith("__gcr")) {
      element.removeAttribute(attribute.name);
    }
  }
}

function removeInjectedAttributesInRoot(root: Element) {
  removeInjectedAttributes(root);
  root.querySelectorAll("*").forEach(removeInjectedAttributes);
}

function findMarkedRoots(node: Node) {
  if (!(node instanceof Element)) return [];

  const roots: Element[] = [];
  if (node.matches(gcrCleanupRootSelector)) {
    roots.push(node);
  }

  roots.push(...Array.from(node.querySelectorAll(gcrCleanupRootSelector)));
  return roots;
}

export function BrowserInjectedAttributeCleanup() {
  useEffect(() => {
    const windowWithObserver = window as WindowWithInjectedAttributeObserver;
    windowWithObserver.__souleventsGcrCleanupFinder?.disconnect();
    windowWithObserver.__souleventsGcrCleanupObservers?.forEach((observer) => observer.disconnect());
    delete windowWithObserver.__souleventsGcrCleanupFinder;
    delete windowWithObserver.__souleventsGcrCleanupObservers;

    removeInjectedAttributes(document.documentElement);
    if (typeof MutationObserver === "undefined") return undefined;

    // Chrome/Google on iOS can re-add __gcr attributes to <html> and explicitly marked public search/filter forms.
    const observedRoots = new WeakSet<Element>();
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

    // Observe only explicitly marked public search/filter forms and their descendants.
    const formObserver = new MutationObserver((mutations) => {
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

    const observeRoot = (root: Element) => {
      if (observedRoots.has(root)) return;
      observedRoots.add(root);
      removeInjectedAttributesInRoot(root);
      formObserver.observe(root, { attributes: true, subtree: true });
    };

    document.querySelectorAll(gcrCleanupRootSelector).forEach(observeRoot);

    const finderObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          findMarkedRoots(node).forEach(observeRoot);
        });
      }
    });
    finderObserver.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      documentElementObserver.disconnect();
      formObserver.disconnect();
      finderObserver.disconnect();
    };
  }, []);

  return null;
}
