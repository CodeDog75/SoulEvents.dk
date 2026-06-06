"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

const steps = [
  {
    description: "Vi sender dig en e-mail med et bekræftelseslink (husk også at tjekke spam-mappen).",
    marker: "①",
    title: "Bekræft din e-mail",
  },
  {
    description: "Fortæl lidt om dig selv, dit virke og de oplevelser, du ønsker at dele med andre.",
    marker: "②",
    title: "Færdiggør din profil",
  },
  {
    description:
      "Mens vi gennemgår din profil, kan du allerede oprette dit første event og gøre det klar til offentliggørelse.",
    marker: "③",
    title: "Opret dit første event",
  },
];

export function SignupSteps() {
  const [openStep, setOpenStep] = useState<number | null>(null);

  return (
    <div className="mt-3 divide-y divide-sage-700/15">
      {steps.map((step, index) => {
        const isOpen = openStep === index;

        return (
          <div className="py-2.5" key={step.title}>
            <button
              className="flex w-full items-center justify-between gap-4 text-left"
              onClick={() => setOpenStep(isOpen ? null : index)}
              type="button"
            >
              <span className="flex items-center gap-3 font-semibold text-midnight">
                <span className="text-lg text-sage-700" aria-hidden="true">
                  {step.marker}
                </span>
                {step.title}
              </span>
              <ChevronDown className={`size-5 shrink-0 text-sage-700 transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {isOpen ? <p className="mt-2 pl-8 text-sm leading-6 text-ink/68">{step.description}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
