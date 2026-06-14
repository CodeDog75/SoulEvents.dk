"use client";

import { useEffect, useState } from "react";

type AdFormCategoryGuardProps = {
  formId: string;
};

export function AdFormCategoryGuard({ formId }: AdFormCategoryGuardProps) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    function validate(event: SubmitEvent) {
      const showOnHomepage = form?.querySelector<HTMLInputElement>('input[name="show_on_homepage"]');
      const showOnCategoryPages = form?.querySelector<HTMLInputElement>('input[name="show_on_category_pages"]');
      const checkedCategories = form?.querySelectorAll<HTMLInputElement>('input[name="main_category_ids"]:checked');

      if (!showOnHomepage?.checked && !showOnCategoryPages?.checked) {
        event.preventDefault();
        setMessage("Vælg mindst én placering: forsiden eller hovedkategorisider.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector('[data-ad-category-error="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (showOnCategoryPages?.checked && (!checkedCategories || checkedCategories.length === 0)) {
        event.preventDefault();
        setMessage("Vælg mindst én hovedkategori - kun fordi du har valgt, at reklamen også skal vises på hovedkategorisider.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector('[data-ad-category-error="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      setMessage("");
    }

    form.addEventListener("submit", validate);
    return () => form.removeEventListener("submit", validate);
  }, [formId]);

  if (!message) return null;

  return (
    <div
      className="mb-5 rounded-md border border-[#E5D4F7] bg-[#F7F2FB] px-4 py-3 text-sm font-semibold text-[#7A4EAB]"
      data-ad-category-error="true"
      role="alert"
    >
      {message}
    </div>
  );
}
