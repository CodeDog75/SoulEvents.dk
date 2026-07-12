"use client";

import Link from "next/link";
import { Minus, Plus, Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createBookingAction } from "@/app/events/[id]/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { CapacityBadge } from "@/components/events/capacity-badge";
import { maxSeatsPerBooking } from "@/lib/bookings/limits";

type BookingFormProps = {
  eventId: string;
  availableSeats: number;
  capacity?: number | null;
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

export function BookingForm({ eventId, availableSeats, capacity, message, messageVariant = "notice" }: BookingFormProps) {
  const isSoldOut = availableSeats <= 0;
  const formRef = useRef<HTMLFormElement>(null);
  const highSeatSubmitConfirmedRef = useRef(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [seats, setSeats] = useState(1);
  const [acceptedGuidelines, setAcceptedGuidelines] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [showHighSeatConfirmation, setShowHighSeatConfirmation] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  const nameComplete = Boolean(name.trim());
  const emailComplete = validEmail(email.trim());
  const phoneValid = useMemo(() => /^[\d\s]+$/.test(phone) && cleanPhone(phone).length === 8, [phone]);
  const maxSeats = Math.max(Math.min(availableSeats, maxSeatsPerBooking), 1);
  const canDecreaseSeats = seats > 1 && !isSoldOut && !isSubmittingBooking;
  const canIncreaseSeats = seats < maxSeats && !isSoldOut && !isSubmittingBooking;
  const showPhoneError = (attemptedSubmit || phone.length > 0) && !phoneValid;
  const showSeatLimitMessage = !isSoldOut && availableSeats > maxSeatsPerBooking && seats >= maxSeatsPerBooking;
  const highSeatPersonLabel = seats === 1 ? "person" : "personer";

  return (
    <form
      ref={formRef}
      action={createBookingAction}
      className="rounded-card border border-[#e5d4f7] bg-[#f6efff] p-6 shadow-[0_18px_45px_rgba(90,59,122,0.16)]"
      onSubmit={(event) => {
        setAttemptedSubmit(true);
        if (!phoneValid) {
          event.preventDefault();
          setIsSubmittingBooking(false);
          return;
        }

        if (seats >= 4 && !highSeatSubmitConfirmedRef.current) {
          event.preventDefault();
          setShowHighSeatConfirmation(true);
          setIsSubmittingBooking(false);
          return;
        }

        setIsSubmittingBooking(true);
      }}
    >
      <input name="event_id" type="hidden" value={eventId} />
      <h2 className="text-3xl font-semibold text-olive">Tilmeld dig</h2>
      <CapacityBadge availableSeats={availableSeats} capacity={capacity} className="mt-2" />

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
          Dit navn *
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
          Din e-mailadresse *
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
          Dit telefonnummer *
          <input
            aria-describedby="participant-phone-help participant-phone-error"
            aria-invalid={showPhoneError}
            autoComplete="tel"
            className={inputClass}
            disabled={isSoldOut}
            id="participant-phone"
            inputMode="tel"
            maxLength={15}
            name="participant_phone"
            onChange={(event) => {
              event.currentTarget.setCustomValidity("");
              setPhone(normalizePhoneInput(event.target.value));
            }}
            onInvalid={(event) => {
              event.currentTarget.setCustomValidity("Indtast et gyldigt telefonnummer på 8 cifre.");
              setAttemptedSubmit(true);
            }}
            pattern="[0-9 ]{8,15}"
            placeholder="1234 5678"
            required
            title="Indtast et gyldigt telefonnummer på 8 cifre."
            value={phone}
          />
          <span className="text-xs leading-5 text-ink/58" id="participant-phone-help">
            Dit telefonnummer deles kun med arrangøren og bruges kun, hvis der opstår ændringer eller en akut aflysning.
          </span>
          {showPhoneError && (
            <span className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-[#8B1E2D] shadow-soft" id="participant-phone-error">
              Indtast et gyldigt telefonnummer på 8 cifre.
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
              onClick={() => {
                setSeats((currentSeats) => Math.max(1, currentSeats - 1));
                highSeatSubmitConfirmedRef.current = false;
              }}
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
                highSeatSubmitConfirmedRef.current = false;
              }}
              required
              type="number"
              value={seats}
            />
            <button
              aria-label="Vælg flere pladser"
              className="grid h-12 place-items-center border-l border-[#e5d4f7] text-olive transition hover:bg-[#FAF7F2] disabled:cursor-not-allowed disabled:text-ink/25"
              disabled={!canIncreaseSeats}
              onClick={() => {
                setSeats((currentSeats) => Math.min(maxSeats, currentSeats + 1));
                highSeatSubmitConfirmedRef.current = false;
              }}
              type="button"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          {showSeatLimitMessage && (
            <span className="rounded-md bg-white px-3 py-2 text-xs font-semibold leading-5 text-ink/70 shadow-soft">
              Du kan højst tilmelde 10 personer ad gangen. Kontakt arrangøren ved større grupper.
            </span>
          )}
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
            Jeg accepterer{" "}
            <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4" href="#event-betingelser">
              eventets betingelser
            </Link>{" "}
            og SoulEvents&apos;{" "}
            <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4" href="/legal/handelsbetingelser" target="_blank">
              brugervilkår
            </Link>{" "}
            og har læst{" "}
            <Link className="font-semibold text-[#7A4EAB] underline underline-offset-4" href="/legal/privatlivspolitik" target="_blank">
              privatlivspolitikken
            </Link>
            .
          </span>
        </label>
      </div>

      <button
        className="mt-6 h-12 w-full rounded-button bg-rose px-4 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift disabled:cursor-not-allowed disabled:bg-rose/40"
        disabled={isSoldOut || isSubmittingBooking}
        type="submit"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <Send className="size-4" aria-hidden="true" />
          {isSubmittingBooking ? "Sender tilmelding..." : "Send tilmelding"}
        </span>
      </button>

      {showHighSeatConfirmation && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#2F2633]/45 px-4 py-6" role="presentation">
          <div
            aria-describedby="high-seat-booking-description"
            aria-labelledby="high-seat-booking-title"
            aria-modal="true"
            className="w-full max-w-md rounded-[24px] bg-white p-6 text-left shadow-lift"
            role="dialog"
          >
            <h3 className="text-2xl font-semibold leading-tight text-olive" id="high-seat-booking-title">
              Du er ved at tilmelde {seats} {highSeatPersonLabel}
            </h3>
            <p className="mt-3 text-sm leading-6 text-ink/70" id="high-seat-booking-description">
              Er du sikker på, at du ønsker at reservere {seats} pladser til dette event?
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1.4fr]">
              <button
                className="h-11 rounded-button border border-sage-700/25 bg-white px-4 text-sm font-semibold text-sage-700 transition hover:border-sage-700 hover:bg-sage-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmittingBooking}
                onClick={() => {
                  setShowHighSeatConfirmation(false);
                  highSeatSubmitConfirmedRef.current = false;
                }}
                type="button"
              >
                Gå tilbage
              </button>
              <button
                className="h-11 rounded-button bg-rose px-4 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift disabled:cursor-not-allowed disabled:bg-rose/45"
                disabled={isSubmittingBooking}
                onClick={() => {
                  highSeatSubmitConfirmedRef.current = true;
                  setIsSubmittingBooking(true);
                  window.requestAnimationFrame(() => {
                    formRef.current?.requestSubmit();
                  });
                }}
                type="button"
              >
                {isSubmittingBooking ? "Sender..." : `Ja, tilmeld ${seats} ${highSeatPersonLabel}`}
              </button>
            </div>
          </div>
        </div>
      )}

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
