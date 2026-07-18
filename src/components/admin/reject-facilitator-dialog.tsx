"use client";

import { useId, useRef, useState } from "react";
import { requestFacilitatorProfileChangesAction } from "@/app/admin/facilitators/actions";

const fieldOptions = [
  ["profile_image", "Profilbillede"],
  ["mood_images", "Stemningsbilleder"],
  ["description", "Beskrivelse"],
  ["work_areas", "Arbejdsområder"],
  ["website", "Hjemmeside"],
  ["social_links", "Sociale medier"],
  ["other", "Andet"],
] as const;

type RequestFacilitatorChangesDialogProps = {
  facilitatorId: string;
  facilitatorName: string;
};

export function RequestFacilitatorChangesDialog({ facilitatorId, facilitatorName }: RequestFacilitatorChangesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const titleId = useId();
  const descriptionId = useId();

  function toggleField(value: string) {
    setSelectedFields((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  return (
    <>
      <button
        className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#E9CED6] bg-white px-3 text-xs font-semibold text-[#8B5B68] transition hover:bg-[#FFF1F5]"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        Anmod om ændringer
      </button>
      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="w-[min(92vw,520px)] rounded-[28px] border border-[#E5DDEA] bg-white p-0 text-[#2F2437] shadow-[0_24px_70px_rgba(47,36,55,0.22)] backdrop:bg-[#2F2437]/35"
        ref={dialogRef}
      >
        <form action={requestFacilitatorProfileChangesAction} className="p-6">
          <input name="facilitator_id" type="hidden" value={facilitatorId} />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#8B5B68]">Kræver ændringer</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight" id={titleId}>
              Anmod om ændringer?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6E6475]" id={descriptionId}>
              Du er ved at bede <strong>{facilitatorName}</strong> om at rette profilen. Arrangøren modtager en e-mail
              med din besked og kan sende profilen til ny godkendelse bagefter.
            </p>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-[#2F2437]">Hvilke områder skal rettes?</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {fieldOptions.map(([value, label]) => (
                <label
                  className="flex min-h-11 items-center gap-2 rounded-[14px] border border-[#E5DDEA] bg-[#FAF8FC] px-3 text-sm font-semibold text-[#2F2437]"
                  key={value}
                >
                  <input
                    checked={selectedFields.includes(value)}
                    className="size-4 accent-[#7A5D91]"
                    name="change_fields"
                    onChange={() => toggleField(value)}
                    type="checkbox"
                    value={value}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-5 grid gap-2 text-sm font-semibold text-[#2F2437]">
            Kommentar til arrangøren
            <textarea
              className="min-h-36 rounded-md border border-[#E5DDEA] p-3 text-sm leading-6 outline-none focus:border-[#7A5D91]"
              maxLength={1000}
              name="change_comment"
              placeholder="Skriv en venlig og konkret besked om, hvad der skal rettes."
              required
            />
          </label>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#E5DDEA] bg-white px-5 text-sm font-semibold text-[#6E6475] transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
              formMethod="dialog"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              Annuller
            </button>
            <button className="inline-flex h-11 items-center justify-center rounded-full bg-[#8B5B68] px-5 text-sm font-semibold text-white transition hover:bg-[#794D59]" type="submit">
              Send anmodning
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
