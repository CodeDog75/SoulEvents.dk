"use client";

import Link from "next/link";
import { Minus, Plus, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { createBookingAction } from "@/app/events/[id]/actions";
import { AuthMessage } from "@/components/auth/auth-message";

type BookingFormProps = {
  eventId: string;
  availableSeats: number;
  message?: string;
  messageVariant?: "notice" | "success";
};

const inputClass =
  "h-11 rounded-md border border-[#e5d4f7] bg-white px-3 text-base outline-none transition focus:border-[#b98be8] focus:ring-2 focus:ring-[#e5d4f7]";
const textareaClass =
  "min-h-28 rounded-md border border-[#e5d4f7] bg-white px-3 py-3 text-base outline-none transition focus:border-[#b98be8] focus:ring-2 focus:ring-[#e5d4f7]";

function cleanPhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizePhoneInput(value: string) {
  let digits = 0;
  let next = "";

  for (const character of value) {
    if (/\d/.test(character)) {
      if (digits >= 8) {
        continue;
      }
      digits += 1;
      next += character;
    } else if (character === " ") {
      next += character;
    }
  }

  return next.replace(/\s{2,}/g, " ").trimStart();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function BookingForm({ eventId, availableSeats, message, messageVariant = "notice" }: BookingFormProps) {
  const isSoldOut = availableSeats <= 0;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [seats, setSeats] = useState(1);
  const [acceptedGuidelines, setAcceptedGuidelines] = useState(false);

  const nameComplete = Boolean(name.trim());
  const emailComplete = validEmail(email.trim());
  const phoneValid = useMemo(() => !phone.trim() || (/^[\d\s]+$/.test(phone) && cleanPhone(phone).length === 8), [phone]);
  const maxSeats = Math.max(availableSeats, 1);
  const canDecreaseSeats = seats > 1 && !isSoldOut;
  const canIncreaseSeats = seats < maxSeats && !isSoldOut;

  return (
    <form action={createBookingAction} className="rounded-card border border-[#e5d4f7] bg-[#f6efff] p-6 shadow-[0_18px_45px_rgba(90,59,122,0.16)]">
      <input name="event_id" type="hidden" value={eventId} />
      <h2 className="text-3xl font-semibold text-olive">Tilmeld dig</h2>
      <p className="mt-1 text-sm text-ink/65">
        {isSoldOut ? "Der er ikke flere ledige pladser." : availableSeats + " ledige pladser."}
      </p>

      <div className="mt-4 rounded-md border border-white/70 bg-white/70 px-3 py-3 text-sm leading-6 text-ink/72 shadow-soft">
        <p className="font-semibold text-midnight">{"\ud83d\udc9c Vigtigt f\u00f8r du tilmelder dig"}</p>
        <p className="mt-2">
          {"Din tilmelding sendes som en foresp\u00f8rgsel til arrangøren. Din plads er f\u00f8rst reserveret, n\u00e5r du har modtaget en bekr\u00e6ftelse."}
        </p>
        <p className="mt-2 italic">
          {"SoulEvents.dk hj\u00e6lper deltagere og arrangører med at finde hinanden. Det er den enkelte arrangør, der st\u00e5r for eventet og h\u00e5ndterer tilmeldinger."}
        </p>
      </div>

      <div className="mt-6 grid gap-4 [&_input::placeholder]:text-sm [&_input::placeholder]:font-normal [&_input::placeholder]:text-ink/45 [&_textarea::placeholder]:text-sm [&_textarea::placeholder]:font-normal [&_textarea::placeholder]:text-ink/45">
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Navn *
          <input
            autoComplete="name"
            className={inputClass}
            disabled={isSoldOut}
            maxLength={120}
            name="participant_name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Dit fulde navn"
            required
            value={name}
          />
          {!nameComplete && name.length > 0 && (
            <span className="text-xs font-semibold text-terracotta">Navn skal udfyldes.</span>
          )}
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          E-mail *
          <input
            autoComplete="email"
            className={inputClass}
            disabled={isSoldOut}
            maxLength={160}
            name="participant_email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="din@mail.dk"
            required
            type="email"
            value={email}
          />
          {email.length > 0 && !emailComplete && (
            <span className="text-xs font-semibold text-terracotta">Indtast en gyldig e-mailadresse.</span>
          )}
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Telefon
          <input
            autoComplete="tel"
            className={inputClass}
            disabled={isSoldOut}
            inputMode="tel"
            maxLength={15}
            name="participant_phone"
            onChange={(event) => setPhone(normalizePhoneInput(event.target.value))}
            pattern="[0-9 ]*"
            placeholder="Valgfrit"
            title={"Telefonnummer skal best\u00e5 af 8 cifre. Mellemrum er tilladt."}
            value={phone}
          />
          {!phoneValid && (
            <span className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-[#8B1E2D] shadow-soft">
              Telefonnummer skal være 8 cifre – eller lad feltet være tomt.
            </span>
          )}
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Antal pladser *
          <div className="grid grid-cols-[3rem_1fr_3rem] overflow-hidden rounded-md border border-[#e5d4f7] bg-white focus-within:border-[#b98be8] focus-within:ring-2 focus-within:ring-[#e5d4f7]">
            <button
              aria-label="Vælg færre pladser"
              className="grid h-12 place-items-center border-r border-[#e5d4f7] text-olive transition hover:bg-[#FAF7F2] disabled:cursor-not-allowed disabled:text-ink/25"
              disabled={!canDecreaseSeats}
              onClick={() => setSeats((currentSeats) => Math.max(1, currentSeats - 1))}
              type="button"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <input
              aria-label="Antal pladser"
              className="h-12 border-0 bg-white px-3 text-center text-base font-semibold text-midnight outline-none"
              disabled={isSoldOut}
              inputMode="numeric"
              max={maxSeats}
              min={1}
              name="seats"
              onChange={(event) => {
                const numericValue = Number(event.target.value.replace(/\D/g, ""));
                setSeats(Number.isInteger(numericValue) ? Math.min(Math.max(numericValue, 1), maxSeats) : 1);
              }}
              required
              type="number"
              value={seats}
            />
            <button
              aria-label="Vælg flere pladser"
              className="grid h-12 place-items-center border-l border-[#e5d4f7] text-olive transition hover:bg-[#FAF7F2] disabled:cursor-not-allowed disabled:text-ink/25"
              disabled={!canIncreaseSeats}
              onClick={() => setSeats((currentSeats) => Math.min(maxSeats, currentSeats + 1))}
              type="button"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Besked
          <textarea
            className={textareaClass}
            disabled={isSoldOut}
            maxLength={1200}
            name="message"
            placeholder="Valgfrit - maks. 200 ord"
          />
        </label>

        <label className="flex items-start gap-3 rounded-md border border-[#e5d4f7] bg-white/80 p-4 text-sm leading-6 text-ink/72">
          <input
            className="mt-1 size-4 accent-sage-700"
            checked={acceptedGuidelines}
            disabled={isSoldOut}
            name="accepted_guidelines"
            onChange={(event) => setAcceptedGuidelines(event.target.checked)}
            required
            type="checkbox"
            value="yes"
          />
          <span>
            {"Jeg accepterer SoulEvents.dk's retningslinjer og forst\u00e5r, at min tilmelding f\u00f8rst er g\u00e6ldende, n\u00e5r arrangøren har bekr\u00e6ftet den."}
          </span>
        </label>
      </div>

      <button
        className="mt-6 h-12 w-full rounded-button bg-rose px-4 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift disabled:cursor-not-allowed disabled:bg-rose/40"
        disabled={isSoldOut || !phoneValid}
        type="submit"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <Send className="size-4" aria-hidden="true" />
          Send tilmelding
        </span>
      </button>

      {message && (
        <div id="booking-response" className="mt-4 grid scroll-mt-8 gap-3">
          <AuthMessage message={message} variant={messageVariant} />
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-sage-700/25 bg-white px-4 text-sm font-semibold text-sage-700 transition hover:border-sage-700 hover:bg-sage-50"
            href="/"
          >
            Tilbage til forsiden
          </Link>
        </div>
      )}
    </form>
  );
}
