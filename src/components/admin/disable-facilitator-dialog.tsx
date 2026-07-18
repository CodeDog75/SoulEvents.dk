"use client";

import { useId, useRef, useState } from "react";
import { updateFacilitatorOverviewAction } from "@/app/admin/users/actions";

const deactivationReasons = [
  "Matcher ikke SoulEvents' koncept",
  "Spam eller falsk profil",
  "Dubletprofil",
  "Uacceptabelt indhold",
  "Andet",
] as const;

type DisableFacilitatorDialogProps = {
  activeEventCount?: number;
  facilitatorId: string;
  facilitatorName: string;
  isPendingReview?: boolean;
  returnHref: string;
};

export function DisableFacilitatorDialog({
  activeEventCount = 0,
  facilitatorId,
  facilitatorName,
  isPendingReview = false,
  returnHref,
}: DisableFacilitatorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [reason, setReason] = useState<(typeof deactivationReasons)[number]>(deactivationReasons[0]);
  const [adminMessage, setAdminMessage] = useState("");

  return (
    <>
      <button
        className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border border-[#D9A1A6] bg-white px-3 text-xs font-semibold text-[#8A1F28] transition hover:bg-[#FFF1F2]"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        Deaktivér arrangør
      </button>
      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="w-[min(92vw,520px)] rounded-[28px] border border-[#E5DDEA] bg-white p-0 text-[#2F2437] shadow-[0_24px_70px_rgba(47,36,55,0.22)] backdrop:bg-[#2F2437]/35"
        ref={dialogRef}
      >
        <form action={updateFacilitatorOverviewAction} className="p-6">
          <input name="facilitator_id" type="hidden" value={facilitatorId} />
          <input name="field" type="hidden" value="is_disabled" />
          <input name="return_to" type="hidden" value={returnHref} />
          <input name="value" type="hidden" value="true" />

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#8A1F28]">Deaktivering</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight" id={titleId}>
              Deaktivér denne arrangør?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6E6475]" id={descriptionId}>
              <strong>{facilitatorName}</strong>
              {isPendingReview ? " afventer godkendelse." : " bliver deaktiveret."} Profilen skjules offentligt, og
              arrangøren kan ikke åbne dashboard, redigere profil eller oprette events, før profilen genaktiveres af
              en administrator. Historik, events, tilmeldinger og auditspor bevares.
            </p>
          </div>

          {activeEventCount > 0 ? (
            <div className="mt-5 rounded-[18px] border border-[#FFE2BD] bg-[#FFF7E8] p-4 text-sm font-semibold leading-6 text-[#7A3F11]">
              Arrangøren har {activeEventCount} kommende {activeEventCount === 1 ? "event" : "events"}. Ved
              deaktivering skjules arrangørprofilen og de kommende events straks for offentligheden. Historik og
              tilmeldinger bevares.
            </div>
          ) : null}

          <div className="mt-5 rounded-[18px] border border-[#FFE2BD] bg-[#FFF7E8] p-4 text-sm font-semibold leading-6 text-[#7A3F11]">
            Brug “Anmod om ændringer”, hvis profilen realistisk kan tilpasses. Brug kun “Deaktivér arrangør”, hvis
            profilen ikke bør fortsætte i det normale godkendelsesflow.
          </div>

          <label className="mt-5 grid gap-2 text-sm font-semibold text-[#2F2437]">
            Årsag
            <select
              className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 text-sm outline-none focus:border-[#8A1F28]"
              name="disabled_reason"
              onChange={(event) => setReason(event.target.value as (typeof deactivationReasons)[number])}
              required
              value={reason}
            >
              {deactivationReasons.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          {reason === "Andet" ? (
            <label className="mt-4 grid gap-2 text-sm font-semibold text-[#2F2437]">
              Uddybning
              <textarea
                className="min-h-28 rounded-md border border-[#E5DDEA] p-3 text-sm leading-6 outline-none focus:border-[#8A1F28]"
                maxLength={500}
                name="disabled_reason_detail"
                placeholder="Skriv kort, hvorfor profilen ikke bør fortsætte i godkendelsesflowet."
                required
              />
            </label>
          ) : null}

          <label className="mt-4 grid gap-2 text-sm font-semibold text-[#2F2437]">
            Kort besked til arrangøren (valgfrit)
            <textarea
              className="min-h-32 rounded-md border border-[#E5DDEA] p-3 text-sm leading-6 outline-none focus:border-[#8A1F28]"
              maxLength={500}
              name="disabled_admin_message"
              onChange={(event) => setAdminMessage(event.target.value)}
              value={adminMessage}
            />
            <span className="text-xs font-normal leading-5 text-[#6E6475]">
              Denne besked bliver vist i e-mailen om deaktiveringen. Skriv kort og respektfuldt, hvad der ligger til
              grund for beslutningen.
            </span>
            <span className="text-right text-xs font-normal text-[#8A7C90]">{adminMessage.length}/500</span>
          </label>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#E5DDEA] bg-white px-5 text-sm font-semibold text-[#6E6475] transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Annuller
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#8A1F28] px-5 text-sm font-semibold text-white transition hover:bg-[#731821]"
              type="submit"
            >
              Deaktivér arrangør
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
