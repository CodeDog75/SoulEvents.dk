"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { sendContactMessageStateAction, type ContactFormState } from "@/app/contact/actions";

const initialState: ContactFormState = {
  status: "idle",
  message: "",
};

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(sendContactMessageStateAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-[24px] border border-olive/10 bg-white p-5 shadow-soft sm:p-6">
      {state.message && (
        <p
          className={
            "rounded-input px-4 py-3 text-sm font-semibold " +
            (state.status === "success" ? "bg-sage-50 text-olive" : "bg-rose/10 text-terracotta")
          }
        >
          {state.message}
        </p>
      )}

      <label className="grid gap-2 text-sm font-semibold text-[#2F2633]">
        Navn
        <input
          className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-[#7A4EAB] focus:ring-2 focus:ring-[#7A4EAB]/20"
          maxLength={120}
          name="name"
          placeholder="Dit navn"
          required
          type="text"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#2F2633]">
        E-mail
        <input
          className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-[#7A4EAB] focus:ring-2 focus:ring-[#7A4EAB]/20"
          maxLength={160}
          name="email"
          placeholder="din@mail.dk"
          required
          type="email"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#2F2633]">
        Telefon
        <input
          className="h-12 rounded-input border border-olive/15 bg-white px-4 text-base font-normal outline-none transition focus:border-[#7A4EAB] focus:ring-2 focus:ring-[#7A4EAB]/20"
          maxLength={40}
          name="phone"
          placeholder="Kan udfyldes, hvis du ønsker at blive ringet op"
          type="tel"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#2F2633]">
        Besked
        <textarea
          className="min-h-40 rounded-input border border-olive/15 bg-white px-4 py-3 text-base font-normal outline-none transition focus:border-[#7A4EAB] focus:ring-2 focus:ring-[#7A4EAB]/20"
          maxLength={500}
          name="message"
          placeholder="Skriv kort, hvad vi kan hjælpe dig med"
          required
        />
        <span className="text-xs font-medium text-ink/60">Maks. 500 tegn.</span>
      </label>

      <button
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button bg-[#7A4EAB] px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        type="submit"
      >
        <Send className="size-4" aria-hidden="true" />
        {isPending ? "Sender..." : "Send besked"}
      </button>
    </form>
  );
}
