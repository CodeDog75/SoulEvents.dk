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
    const showOnCategoryPages = form.querySelector<HTMLInputElement>('input[name="show_on_category_pages"]');
    const categoriesSection = form.querySelector<HTMLElement>("[data-ad-categories-section]");

    function syncCategoryVisibility() {
      const shouldShow = Boolean(showOnCategoryPages?.checked);
      if (categoriesSection) {
        categoriesSection.hidden = !shouldShow;
      }
    }

    syncCategoryVisibility();
    showOnCategoryPages?.addEventListener("change", syncCategoryVisibility);

    function validate(event: SubmitEvent) {
      const showOnHomepage = form?.querySelector<HTMLInputElement>('input[name="show_on_homepage"]');
      const checkedCategories = form?.querySelectorAll<HTMLInputElement>('input[name="main_category_ids"]:checked');
      const currentDesktopPath = form?.querySelector<HTMLInputElement>('input[name="image_path"]')?.value.trim();
      const desktopFile = form?.querySelector<HTMLInputElement>('input[name="image_file"]')?.files?.[0];
      const removeDesktop = form?.querySelector<HTMLInputElement>('input[name="remove_image"]')?.checked;
      const targetUrl = form?.querySelector<HTMLInputElement>('input[name="target_url"]')?.value.trim();
      const startsAt = form?.querySelector<HTMLInputElement>('input[name="starts_at"]')?.value;
      const endsAt = form?.querySelector<HTMLInputElement>('input[name="ends_at"]')?.value;
      const title = form?.querySelector<HTMLInputElement>('input[name="title"]')?.value.trim();

      if (!title) {
        event.preventDefault();
        setMessage("Titel er påkrævet.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
        return;
      }

      if ((!currentDesktopPath || removeDesktop) && !desktopFile) {
        event.preventDefault();
        setMessage("Desktopbanner er påkrævet. Upload et banner i 1600 x 600-format.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector('[data-ad-media-section="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (targetUrl && !/^https?:\/\//i.test(targetUrl) && !/^\/(?!\/)/.test(targetUrl)) {
        event.preventDefault();
        setMessage("Link skal starte med https:// eller være et internt link som /kontakt.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector<HTMLInputElement>('input[name="target_url"]')?.focus();
        return;
      }

      if (startsAt && endsAt && endsAt < startsAt) {
        event.preventDefault();
        setMessage("Slutdato skal være efter startdato.");
        form?.closest("details")?.setAttribute("open", "");
        form?.querySelector<HTMLInputElement>('input[name="ends_at"]')?.focus();
        return;
      }

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
    return () => {
      form.removeEventListener("submit", validate);
      showOnCategoryPages?.removeEventListener("change", syncCategoryVisibility);
    };
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
