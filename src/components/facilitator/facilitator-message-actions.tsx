"use client";

import { useState } from "react";
import { ArchiveX, Reply, Trash2 } from "lucide-react";
import {
  clearFacilitatorAdminMessagesAction,
  hideFacilitatorAdminMessageAction,
} from "@/app/facilitator/actions";

export function FacilitatorMessageRemoveAction({ messageId }: { messageId: string }) {
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
      <p className="font-semibold">Vil du fjerne denne besked fra dit Beskedcenter? Den kan ikke gendannes herfra.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="inline-flex h-9 items-center justify-center rounded-full border border-[#E9CED6] bg-white px-4 font-semibold text-[#6E3648]"
          onClick={() => setIsConfirming(false)}
          type="button"
        >
          Annuller
        </button>
        <form action={hideFacilitatorAdminMessageAction}>
          <input name="message_id" type="hidden" value={messageId} />
          <button className="inline-flex h-9 items-center justify-center rounded-full bg-[#6E3648] px-4 font-semibold text-white" type="submit">
            Fjern besked
          </button>
        </form>
      </div>
    </div>
  );
}

export function FacilitatorMessageReplyAction() {
  function handleReplyClick() {
    const messageField = document.getElementById("facilitator-support-message");
    messageField?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });

    if (messageField instanceof HTMLTextAreaElement) {
      messageField.focus();
    }
  }

  return (
    <button
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-[#7A5D91] transition hover:bg-[#F4F0F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A5D91]"
      onClick={handleReplyClick}
      type="button"
    >
      <Reply className="size-3.5" aria-hidden="true" />
      Besvar
    </button>
  );
}

export function FacilitatorClearMessagesAction() {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[#D8CBE4] bg-white px-4 text-xs font-semibold text-[#7A5D91] transition hover:bg-[#F4F0F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A5D91]"
        onClick={() => setIsConfirming(true)}
        type="button"
      >
        <ArchiveX className="size-4" aria-hidden="true" />
        Ryd Beskedcenter
      </button>
    );
  }

  return (
    <div className="rounded-[14px] border border-[#E9CED6] bg-[#FFF8FA] p-3 text-xs text-[#6E3648]">
      <p className="font-semibold">Vil du fjerne alle beskeder fra dit Beskedcenter? Handlingen kan ikke fortrydes.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="inline-flex h-9 items-center justify-center rounded-full border border-[#E9CED6] bg-white px-4 font-semibold text-[#6E3648]"
          onClick={() => setIsConfirming(false)}
          type="button"
        >
          Annuller
        </button>
        <form action={clearFacilitatorAdminMessagesAction}>
          <button className="inline-flex h-9 items-center justify-center rounded-full bg-[#6E3648] px-4 font-semibold text-white" type="submit">
            Ryd Beskedcenter
          </button>
        </form>
      </div>
    </div>
  );
}
