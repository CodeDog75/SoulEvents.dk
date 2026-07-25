"use client";

import { type ChangeEvent, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateBecomeFacilitatorPresentationSectionAction } from "@/app/admin/content/bliv-arrangoer/actions";
import { imageUploadAccept, prepareImageFileForUpload, replaceInputFile } from "@/lib/images/client-image-upload";
import type { BecomeFacilitatorPresentationSection } from "@/lib/become-facilitator-presentation-sections";

type PresentationSectionCardProps = {
  imageSrc: string | null;
  section: BecomeFacilitatorPresentationSection;
};

const inputClass = "h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700";
const textareaClass = "min-h-28 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-11 items-center justify-center rounded-button bg-olive px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-500 disabled:cursor-wait disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? "Gemmer..." : "Gem ændringer"}
    </button>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink/72">
      {label}
      {children}
    </label>
  );
}

export function BecomeFacilitatorPresentationSectionCard({ imageSrc, section }: PresentationSectionCardProps) {
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const currentPreview = removeImage ? null : preview ?? imageSrc;

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];

    if (!selectedFile) {
      setMessage("");
      return;
    }

    setMessage("Klargør billede...");

    try {
      const preparedFile = await prepareImageFileForUpload(selectedFile, { maxDimension: 5000 });
      replaceInputFile(input, preparedFile);

      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(preparedFile));
      setRemoveImage(false);
      setMessage("Billedet er klar til at blive gemt.");
    } catch (error) {
      input.value = "";
      setMessage(error instanceof Error ? error.message : "Billedet kunne ikke klargøres.");
    }
  }

  return (
    <form action={updateBecomeFacilitatorPresentationSectionAction} className="grid gap-5 rounded-card border border-midnight/10 bg-white p-5 shadow-soft">
      <input name="sectionKey" type="hidden" value={section.sectionKey} />
      <input name="imagePath" type="hidden" value={section.imagePath ?? ""} />
      <input name="imageUrl" type="hidden" value={section.imageUrl ?? ""} />
      <input name="removeImage" type="hidden" value={removeImage ? "1" : "0"} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Afsnit {section.sectionKey.replace("section_", "")}</p>
          <h3 className="mt-1 text-lg font-semibold text-midnight">{section.title}</h3>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink/72">
          <input name="isActive" type="hidden" value="0" />
          <input className="size-4 rounded border-midnight/20" defaultChecked={section.isActive} name="isActive" type="checkbox" value="1" />
          Aktiv
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] lg:items-start">
        <div className="grid min-w-0 gap-3">
          {currentPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={section.imageAlt}
              className="max-h-[520px] w-full rounded-md bg-sage-50 object-contain object-top shadow-soft"
              src={currentPreview}
            />
          ) : (
            <div className="grid min-h-80 place-items-center rounded-md bg-sage-50 px-4 text-center text-sm font-semibold text-sage-700">
              Intet præsentationsbillede valgt
            </div>
          )}
          <Field label="Upload/udskift præsentationsbillede">
            <input
              accept={imageUploadAccept}
              className="rounded-md border border-midnight/15 bg-white px-3 py-2 text-sm"
              name="imageFile"
              onChange={(event) => void handleImageChange(event)}
              type="file"
            />
          </Field>
          <button
            className="inline-flex h-10 items-center justify-center rounded-button border border-terracotta/25 bg-white px-4 text-sm font-semibold text-terracotta transition hover:bg-[#FFF8F6]"
            onClick={() => {
              if (currentPreview && window.confirm("Vil du fjerne præsentationsbilledet fra dette afsnit?")) {
                if (preview) URL.revokeObjectURL(preview);
                setPreview(null);
                setRemoveImage(true);
                setMessage("Billedet fjernes, når du gemmer ændringerne.");
              }
            }}
            type="button"
          >
            Fjern billede
          </button>
          {message ? <p className="rounded-md bg-sage-50 px-3 py-2 text-xs font-semibold text-sage-700">{message}</p> : null}
        </div>

        <div className="grid min-w-0 gap-4">
          <Field label="Overskrift">
            <input className={inputClass} defaultValue={section.title} name="title" />
          </Field>
          <Field label="Brødtekst">
            <textarea className={textareaClass} defaultValue={section.body} name="body" />
          </Field>
          <Field label="Alt-tekst til billedet">
            <input className={inputClass} defaultValue={section.imageAlt} name="imageAlt" />
          </Field>
          <Field label="Sorteringsrækkefølge">
            <input className={inputClass} defaultValue={section.sortOrder} min={1} max={3} name="sortOrder" type="number" />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
