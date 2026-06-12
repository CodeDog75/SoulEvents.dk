"use client";

import { X } from "lucide-react";
import { useState } from "react";

type LegalDocument = {
  body: string;
  slug: string;
  title: string;
};

type LegalConsentLinksProps = {
  documents: LegalDocument[];
};

const fallbackDocuments: LegalDocument[] = [
  {
    body: "Handelsbetingelserne er endnu ikke lagt ind.",
    slug: "handelsbetingelser",
    title: "handelsbetingelser",
  },
  {
    body: "Privatlivspolitikken er endnu ikke lagt ind.",
    slug: "privatlivspolitik",
    title: "privatlivspolitik",
  },
  {
    body: "SoulEvents.dk's retningslinjer er endnu ikke lagt ind.",
    slug: "platformens-retningslinjer",
    title: "SoulEvents.dk's retningslinjer",
  },
];

function findDocument(documents: LegalDocument[], slug: string) {
  return documents.find((document) => document.slug === slug) ?? fallbackDocuments.find((document) => document.slug === slug);
}

export function LegalConsentLinks({ documents }: LegalConsentLinksProps) {
  const [activeDocument, setActiveDocument] = useState<LegalDocument | undefined>();

  function openDocument(slug: string) {
    setActiveDocument(findDocument(documents, slug));
  }

  return (
    <>
      Jeg accepterer{" "}
      <button
        className="font-semibold text-sage-700 underline-offset-4 hover:text-terracotta hover:underline"
        onClick={() => openDocument("handelsbetingelser")}
        type="button"
      >
        handelsbetingelser
      </button>
      ,{" "}
      <button
        className="font-semibold text-sage-700 underline-offset-4 hover:text-terracotta hover:underline"
        onClick={() => openDocument("privatlivspolitik")}
        type="button"
      >
        privatlivspolitik
      </button>{" "}
      og{" "}
      <button
        className="font-semibold text-sage-700 underline-offset-4 hover:text-terracotta hover:underline"
        onClick={() => openDocument("platformens-retningslinjer")}
        type="button"
      >
        SoulEvents retningslinjer
      </button>
      .
      {activeDocument ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/70 p-4">
          <section className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-card bg-white p-6 shadow-lift">
            <button
              className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-sage-50 text-midnight transition hover:bg-sage-100"
              onClick={() => setActiveDocument(undefined)}
              type="button"
            >
              <X className="size-5" aria-label="Luk" />
            </button>
            <h2 className="pr-12 text-3xl font-medium text-olive">{activeDocument.title}</h2>
            <div className="mt-5 whitespace-pre-line text-sm leading-7 text-ink/72">{activeDocument.body}</div>
            <div className="mt-6 flex justify-end">
              <button
                className="inline-flex h-10 items-center rounded-button bg-olive px-4 text-sm font-semibold text-white transition hover:bg-sage-500"
                onClick={() => setActiveDocument(undefined)}
                type="button"
              >
                Luk
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
