"use client";

import { useSearchParams } from "next/navigation";

export function FacilitatorReminderMessage() {
  const searchParams = useSearchParams();
  const reminderMessage = searchParams.get("reminder_message");

  if (!reminderMessage) {
    return null;
  }

  return (
    <p className="mt-4 rounded-[20px] border border-[#D8CBE4] bg-white/75 px-4 py-3 text-sm font-semibold text-[#6E6475]">
      {reminderMessage}
    </p>
  );
}
