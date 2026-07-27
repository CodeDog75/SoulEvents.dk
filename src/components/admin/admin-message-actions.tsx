"use client";

import { useState } from "react";
import { ArchiveX, Trash2 } from "lucide-react";
import {
  clearAdminConversationFromAdminInboxAction,
  hideAdminMessageFromAdminInboxAction,
} from "@/app/admin/facilitators/actions";

export function AdminMessageRemoveAction({ messageId, returnTo }: { messageId: string; returnTo: string }) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <button
        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-[#8B6B75] transition hover:bg-[#FFF8FA] hover:text-[#6E3648] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A5D91]"
        onClick={() => setIsConfirming(true)}
        type="button"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        Fjern fra Beskedcenter
      </button>
    );
  }

  return (
    <div className="rounded-[14px] border border-[#E9CED6] bg-[#FFF8FA] p-3 text-xs text-[#6E3648]">
      <p className="font-semibold">Vil du fjerne denne besked fra adminens Beskedcenter? Den fjernes ikke hos arrangøren.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="inline-flex h-9 items-center justify-center rounded-full border border-[#E9CED6] bg-white px-4 font-semibold text-[#6E3648]"
          onClick={() => setIsConfirming(false)}
          type="button"
        >
          Annuller
        </button>
        <form action={hideAdminMessageFromAdminInboxAction}>
          <input name="message_id" type="hidden" value={messageId} />
          <input name="return_to" type="hidden" value={returnTo} />
          <button className="inline-flex h-9 items-center justify-center rounded-full bg-[#6E3648] px-4 font-semibold text-white" type="submit">
            Fjern besked
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminClearConversationAction({ facilitatorId, returnTo }: { facilitatorId: string; returnTo: string }) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[#D8CBE4] bg-white px-4 text-xs font-semibold text-[#7A5D91] transition hover:bg-[#F4F0F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A5D91]"
        onClick={() => setIsConfirming(true)}
        type="button"
      >
        <ArchiveX className="size-4" aria-hidden="true" />
        Ryd samtale
      </button>
    );
  }

  return (
    <div className="rounded-[14px] border border-[#E9CED6] bg-[#FFF8FA] p-3 text-xs text-[#6E3648]">
      <p className="font-semibold">
        Vil du fjerne alle beskeder i denne samtale fra adminens Beskedcenter? Beskederne forbliver synlige for arrangøren.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="inline-flex h-9 items-center justify-center rounded-full border border-[#E9CED6] bg-white px-4 font-semibold text-[#6E3648]"
          onClick={() => setIsConfirming(false)}
          type="button"
        >
          Annuller
        </button>
        <form action={clearAdminConversationFromAdminInboxAction}>
          <input name="facilitator_id" type="hidden" value={facilitatorId} />
          <input name="return_to" type="hidden" value={returnTo} />
          <button className="inline-flex h-9 items-center justify-center rounded-full bg-[#6E3648] px-4 font-semibold text-white" type="submit">
            Ryd samtale
          </button>
        </form>
      </div>
    </div>
  );
}
