"use client";

import { useEffect } from "react";

export function EventDraftSubmitGuard() {
  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      const submitter = event.submitter;

      if (!(form instanceof HTMLFormElement) || !(submitter instanceof HTMLButtonElement)) return;
      if (submitter.name !== "status" || submitter.value !== "draft") return;

      if (form.dataset.souleventsDraftSubmitting === "true") {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      form.dataset.souleventsDraftSubmitting = "true";

      const draftButtons = form.querySelectorAll<HTMLButtonElement>('button[name="status"][value="draft"]');
      draftButtons.forEach((button) => {
        button.setAttribute("aria-disabled", "true");
        button.style.pointerEvents = "none";
        button.style.opacity = "0.65";
        button.style.cursor = "wait";

        const labelNodes = Array.from(button.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
        const labelNode = labelNodes.find((node) => node.textContent?.includes("Gem kladde"));
        if (labelNode) labelNode.textContent = " Gemmer kladde…";
      });
    }

    document.addEventListener("submit", handleSubmit, true);
    return () => document.removeEventListener("submit", handleSubmit, true);
  }, []);

  return null;
}
