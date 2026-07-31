"use client";

import Link from "next/link";
import { ChevronDown, Clock3, ExternalLink, Minus, Plus, Send, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBookingAction } from "@/app/events/[id]/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { CapacityBadge } from "@/components/events/capacity-badge";
import { maxSeatsPerBooking } from "@/lib/bookings/limits";
import type { PaymentInstructionMethod } from "@/lib/payment-instructions";

type BookingFormProps = {
  eventId: string;
  availableSeats: number;
  capacity?: number | null;
  eventStartsAt: string;
  eventTitle: string;
  externalRegistrationUrl?: string | null;
  facilitatorProfileHref: string;
  message?: string;
  messageVariant?: "notice" | "success";
  bookingSent?: boolean;
  registrationMode?: "direct" | "approval_required";
  paymentPreview?: {
    deadlineDays: number | null;
    methods: PaymentInstructionMethod[];
    note: string | null;
  } | null;
};

const inputClass =
  "h-11 rounded-md border border-[#e5d4f7] bg-white px-3 text-base outline-none transition focus:border-[#b98be8] focus:ring-2 focus:ring-[#e5d4f7]";
const textareaClass =
  "min-h-28 rounded-md border border-[#e5d4f7] bg-white px-3 py-3 text-base outline-none transition focus:border-[#b98be8] focus:ring-2 focus:ring-[#e5d4f7]";
const primaryActionClass =
  "rounded-button bg-gradient-to-br from-purple via-amethyst to-plum px-4 text-sm font-semibold text-white shadow-soft transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-lift active:translate-y-0 active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple disabled:cursor-not-allowed disabled:from-purple/40 disabled:via-amethyst/35 disabled:to-plum/30 disabled:shadow-soft disabled:hover:translate-y-0 disabled:hover:brightness-100";
const bookingCtaClass =
  "group rounded-button bg-gradient-to-br from-purple via-amethyst to-plum px-5 py-5 text-base font-bold text-white shadow-lift transition duration-200 motion-safe:hover:-translate-y-1 hover:brightness-105 hover:shadow-[0_24px_48px_rgba(122,78,171,0.22)] active:translate-y-0 active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple disabled:cursor-not-allowed disabled:from-purple/40 disabled:via-amethyst/35 disabled:to-plum/30 disabled:shadow-soft disabled:hover:translate-y-0 disabled:hover:brightness-100 sm:text-[1.05rem]";

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

function getStickyHeaderOffset() {
  const header = document.querySelector<HTMLElement>("header");

  if (!header) {
    return 0;
  }

  const position = window.getComputedStyle(header).position;

  if (position !== "fixed" && position !== "sticky") {
    return 0;
  }

  return header.getBoundingClientRect().height;
}

export function BookingForm({
  eventId,
  availableSeats,
  capacity,
  eventStartsAt,
  eventTitle,
  externalRegistrationUrl = null,
  facilitatorProfileHref,
  message,
  messageVariant = "notice",
  bookingSent = false,
  registrationMode = "approval_required",
  paymentPreview = null,
}: BookingFormProps) {
  const isDirectRegistration = registrationMode === "direct";
  const usesExternalRegistration = isDirectRegistration && Boolean(externalRegistrationUrl);
  const isSoldOut = !usesExternalRegistration && availableSeats <= 0;
  const bookingActionLabel = usesExternalRegistration ? "Tilmeld dig hos arrangøren" : isDirectRegistration ? "Tilmeld dig" : "Reserver plads";
  const formRef = useRef<HTMLFormElement>(null);
  const bookingToggleRef = useRef<HTMLButtonElement>(null);
  const bookingDialogRef = useRef<HTMLDivElement>(null);
  const bookingFieldsRef = useRef<HTMLDivElement>(null);
  const bookingFormStartRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const receiptSectionRef = useRef<HTMLElement>(null);
  const receiptHeadingRef = useRef<HTMLHeadingElement>(null);
  const highSeatSubmitConfirmedRef = useRef(false);
  const submitStartedRef = useRef(false);
  const shouldScrollToBookingStartRef = useRef(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [seats, setSeats] = useState(1);
  const [acceptedGuidelines, setAcceptedGuidelines] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [showHighSeatConfirmation, setShowHighSeatConfirmation] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(Boolean(message) && !bookingSent);
  const [receiptDismissed, setReceiptDismissed] = useState(false);
  const [usesModalBookingForm, setUsesModalBookingForm] = useState(false);

  const nameComplete = Boolean(name.trim());
  const emailComplete = validEmail(email.trim());
  const phoneValid = useMemo(() => /^[\d\s]+$/.test(phone) && cleanPhone(phone).length === 8, [phone]);
  const maxSeats = Math.max(Math.min(availableSeats, maxSeatsPerBooking), 1);
  const canDecreaseSeats = seats > 1 && !isSoldOut && !isSubmittingBooking;
  const canIncreaseSeats = seats < maxSeats && !isSoldOut && !isSubmittingBooking;
  const showPhoneError = (attemptedSubmit || phone.length > 0) && !phoneValid;
  const showSeatLimitMessage = !isSoldOut && availableSeats > maxSeatsPerBooking && seats >= maxSeatsPerBooking;
  const highSeatPersonLabel = seats === 1 ? "person" : "personer";
  const bookingPanelIsOpen = isFormOpen || (bookingSent && !receiptDismissed);
  const formattedEventDate = new Intl.DateTimeFormat("da-DK", { dateStyle: "full", timeStyle: "short" }).format(new Date(eventStartsAt));

  const closeBookingForm = useCallback(() => {
    if (isSubmittingBooking) {
      return;
    }

    if (bookingSent) {
      setIsFormOpen(false);
      setReceiptDismissed(true);
      return;
    }

    setIsFormOpen(false);
    window.requestAnimationFrame(() => {
      bookingToggleRef.current?.focus({ preventScroll: true });
    });
  }, [bookingSent, isSubmittingBooking]);

  const scrollToBookingFormStart = useCallback(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = bookingFormStartRef.current ?? firstFieldRef.current ?? bookingFieldsRef.current;

    if (!target) {
      return;
    }

    window.scrollTo({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - getStickyHeaderOffset() - 16),
    });
  }, []);

  const toggleBookingForm = useCallback(() => {
    const nextIsOpen = !isFormOpen;
    setIsFormOpen(nextIsOpen);

    if (nextIsOpen && !usesModalBookingForm) {
      shouldScrollToBookingStartRef.current = true;
    } else {
      shouldScrollToBookingStartRef.current = false;
    }
  }, [isFormOpen, usesModalBookingForm]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateModalMode = () => setUsesModalBookingForm(mediaQuery.matches);

    updateModalMode();
    mediaQuery.addEventListener("change", updateModalMode);

    return () => mediaQuery.removeEventListener("change", updateModalMode);
  }, []);

  useEffect(() => {
    if (!bookingPanelIsOpen || !usesModalBookingForm) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.requestAnimationFrame(() => {
      if (bookingSent) {
        receiptHeadingRef.current?.focus({ preventScroll: true });
      } else {
        firstFieldRef.current?.focus({ preventScroll: true });
      }
    });

    const getFocusableElements = () =>
      Array.from(
        bookingDialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("aria-hidden"));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmittingBooking) {
        event.preventDefault();
        closeBookingForm();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [bookingPanelIsOpen, bookingSent, closeBookingForm, isSubmittingBooking, usesModalBookingForm]);

  useEffect(() => {
    if (!bookingSent) {
      return;
    }

    window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      receiptHeadingRef.current?.focus({ preventScroll: true });

      if (usesModalBookingForm) {
        bookingDialogRef.current?.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
      } else {
        receiptSectionRef.current?.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });
      }
    });
  }, [bookingSent, usesModalBookingForm]);

  const receiptContent = (
      <section
        className="rounded-card border border-[#E5D4F7] bg-[#FAF7FE] p-6 text-midnight shadow-[0_18px_45px_rgba(90,59,122,0.14)]"
        id="booking-response"
        ref={receiptSectionRef}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E5A86]">TILMELDING MODTAGET</p>
        <h2
          className="mt-2 text-2xl font-semibold leading-tight text-olive"
          ref={receiptHeadingRef}
          tabIndex={-1}
        >
          Din tilmelding er modtaget 💜
        </h2>
        <p className="mt-4 text-sm leading-6 text-ink/72">
          {isDirectRegistration
            ? "Du modtager en kvitteringsmail med betalingsoplysninger."
            : "Du modtager en e-mail, når arrangøren har bekræftet din tilmelding."}
        </p>
        <div className="mt-6 rounded-md border border-[#E5D4F7] bg-white/80 px-4 py-3 text-sm leading-6 text-ink/72 shadow-soft">
          <p>
            <span className="font-semibold text-midnight">Event:</span> {eventTitle}
          </p>
          <p>
            <span className="font-semibold text-midnight">Dato:</span> {formattedEventDate}
          </p>
        </div>
        <div className="mt-6 grid gap-3">
          <Link
            className={`${primaryActionClass} inline-flex h-11 items-center justify-center`}
            href="/"
          >
            Tilbage til forsiden
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-button border border-sage-700/25 bg-white px-4 text-sm font-semibold text-sage-700 transition hover:border-sage-700 hover:bg-sage-50"
            href={facilitatorProfileHref}
          >
            Besøg arrangørens profil
          </Link>
        </div>
      </section>
  );

  if (bookingSent) {
    return (
      <section className="rounded-card border border-[#e5d4f7] bg-[#f6efff] p-6 shadow-[0_18px_45px_rgba(90,59,122,0.16)]">
        {!usesModalBookingForm || receiptDismissed ? receiptContent : null}

        {usesModalBookingForm && !receiptDismissed ? (
          <div
            aria-labelledby="booking-receipt-title"
            aria-modal="true"
            className="fixed inset-0 z-50 items-start justify-center overflow-y-auto bg-[#2F2633]/35 px-4 py-8 backdrop-blur-sm md:grid"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeBookingForm();
              }
            }}
            role="dialog"
          >
            <div
              className="w-full max-w-2xl rounded-card border border-[#e5d4f7] bg-[#f6efff] p-6 shadow-[0_24px_70px_rgba(47,36,55,0.22)]"
              ref={bookingDialogRef}
              tabIndex={-1}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Tilmelding</p>
                  <h3 className="mt-1 text-3xl font-semibold text-olive" id="booking-receipt-title">
                    Tilmelding modtaget
                  </h3>
                </div>
                <button
                  aria-label="Luk kvittering"
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-[#D8CBE4] bg-white text-[#6E5A86] shadow-soft transition hover:border-[#7A5D91] hover:text-[#2F2633]"
                  onClick={closeBookingForm}
                  type="button"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              {receiptContent}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  if (usesExternalRegistration && externalRegistrationUrl) {
    return (
      <section className="rounded-card border border-[#e5d4f7] bg-[#f6efff] p-6 shadow-[0_18px_45px_rgba(90,59,122,0.16)]">
        <h2 className="text-3xl font-semibold text-olive">Tilmelding og betaling hos arrangøren</h2>
        <p className="mt-3 text-sm leading-6 text-ink/72">
          Du sendes videre til arrangørens tilmeldingsside, hvor du vælger antal pladser, udfylder dine oplysninger og gennemfører betalingen.
        </p>
        <p className="mt-4 rounded-md border border-white/70 bg-white/70 px-3 py-3 text-sm leading-6 text-ink/68 shadow-soft">
          Tilmelding og betaling foregår på arrangørens eksterne side. SoulEvents opretter ikke en booking og reserverer ikke pladser i dette flow.
        </p>
        <a
          className={`${bookingCtaClass} mt-5 inline-flex min-h-[4.25rem] w-full items-center justify-center gap-3`}
          href={externalRegistrationUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Gå til tilmelding og betaling
          <ExternalLink className="size-5" aria-hidden="true" />
        </a>
      </section>
    );
  }

  return (
    <form
      ref={formRef}
      action={createBookingAction}
      className="rounded-card border border-[#e5d4f7] bg-[#f6efff] p-6 shadow-[0_18px_45px_rgba(90,59,122,0.16)]"
      onSubmit={(event) => {
        if (submitStartedRef.current) {
          event.preventDefault();
          return;
        }

        setIsFormOpen(true);
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

        submitStartedRef.current = true;
        setIsSubmittingBooking(true);
      }}
    >
      <input name="event_id" type="hidden" value={eventId} />
      <h2 className="text-3xl font-semibold text-olive">{bookingActionLabel}</h2>
      <CapacityBadge availableSeats={availableSeats} capacity={capacity} className="mt-2" />

      {!bookingSent ? (
        <button
          aria-controls="booking-form-fields"
          aria-expanded={isFormOpen}
          ref={bookingToggleRef}
          className={`${bookingCtaClass} mt-5 inline-flex min-h-[4.25rem] w-full items-center justify-center gap-3`}
          disabled={isSoldOut}
          onClick={toggleBookingForm}
          type="button"
        >
          {isFormOpen ? (
            <>
              Skjul formular
              <ChevronDown className="size-5 rotate-180 transition-transform duration-200" aria-hidden="true" />
            </>
          ) : (
            <>
              <Sparkles className="size-5" aria-hidden="true" />
              {bookingActionLabel}
              <ChevronDown
                className="size-5 -rotate-90 transition-transform duration-200 motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1"
                aria-hidden="true"
              />
            </>
          )}
        </button>
      ) : null}

      <div
        aria-hidden={!isFormOpen && !bookingSent}
        aria-labelledby={usesModalBookingForm && bookingPanelIsOpen ? "booking-dialog-title" : undefined}
        aria-modal={usesModalBookingForm && bookingPanelIsOpen ? true : undefined}
        className={
          "grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-out md:fixed md:inset-0 md:z-50 md:items-start md:justify-center md:overflow-y-auto md:bg-[#2F2633]/35 md:px-4 md:py-8 md:backdrop-blur-sm " +
          (bookingPanelIsOpen ? "mt-4 grid-rows-[1fr] opacity-100 md:mt-0" : "mt-0 grid-rows-[0fr] opacity-0 md:pointer-events-none md:grid-rows-[1fr]")
        }
        id="booking-form-fields"
        inert={!bookingPanelIsOpen ? true : undefined}
        ref={bookingFieldsRef}
        onClick={(event) => {
          if (event.target === event.currentTarget && usesModalBookingForm) {
            closeBookingForm();
          }
        }}
        onTransitionEnd={(event) => {
          if (
            event.target !== event.currentTarget ||
            event.propertyName !== "grid-template-rows" ||
            !isFormOpen ||
            usesModalBookingForm ||
            !shouldScrollToBookingStartRef.current
          ) {
            return;
          }

          shouldScrollToBookingStartRef.current = false;
          scrollToBookingFormStart();
        }}
        role={usesModalBookingForm && bookingPanelIsOpen ? "dialog" : undefined}
      >
        <div
          className="min-h-0 md:max-h-[calc(100vh-4rem)] md:w-full md:max-w-2xl md:overflow-y-auto md:rounded-card md:border md:border-[#e5d4f7] md:bg-[#f6efff] md:p-6 md:shadow-[0_24px_70px_rgba(47,36,55,0.22)]"
          ref={bookingDialogRef}
          tabIndex={usesModalBookingForm && bookingPanelIsOpen ? -1 : undefined}
        >
          <div className="mb-5 hidden items-start justify-between gap-4 md:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7A4EAB]">Tilmelding</p>
              <h3 className="mt-1 text-3xl font-semibold text-olive" id="booking-dialog-title">
                {bookingActionLabel}
              </h3>
            </div>
            <button
              aria-label="Luk tilmeldingsformular"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-[#D8CBE4] bg-white text-[#6E5A86] shadow-soft transition hover:border-[#7A5D91] hover:text-[#2F2633]"
              disabled={isSubmittingBooking}
              onClick={closeBookingForm}
              type="button"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div
            className="rounded-md border border-white/70 bg-white/70 px-3 py-3 text-sm leading-6 text-ink/72 shadow-soft"
            ref={bookingFormStartRef}
          >
            <p className="font-semibold text-midnight">{"\ud83d\udc9c Vigtigt f\u00f8r du tilmelder dig"}</p>
            <p className="mt-2">
              {isDirectRegistration
                ? "Din tilmelding registreres med det samme. Betaling håndteres direkte mellem dig og arrangøren uden for SoulEvents."
                : "Din tilmelding sendes som en forespørgsel til arrangøren. Din plads er først reserveret, når du har modtaget en bekræftelse."}
            </p>
            <p className="mt-2 italic">
              {"SoulEvents.dk hj\u00e6lper deltagere og arrangører med at finde hinanden. Det er den enkelte arrangør, der st\u00e5r for eventet og h\u00e5ndterer tilmeldinger."}
            </p>
          </div>

          {isDirectRegistration && paymentPreview ? (
            <div className="mt-4 rounded-md border border-[#DDE8D7] bg-[#EEF7F0] px-4 py-4 text-sm leading-6 text-sage-700 shadow-soft">
              <p className="text-xs font-bold uppercase tracking-wide">Betaling</p>
              <p className="mt-1 font-semibold text-midnight">Du får også betalingsoplysningerne i kvitteringsmailen.</p>
              {paymentPreview.deadlineDays !== null ? (
                <p className="mt-1 text-ink/68">Betalingsfrist: senest {paymentPreview.deadlineDays} dage efter tilmelding.</p>
              ) : null}
              {paymentPreview.methods.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {paymentPreview.methods.map((method) =>
                    method.url ? (
                      <a
                        className="inline-flex min-w-0 items-center justify-center rounded-full bg-white px-4 py-2 font-semibold text-[#7A4EAB] shadow-soft transition hover:-translate-y-0.5"
                        href={method.url}
                        key={`${method.type}-${method.value}`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {method.label}
                      </a>
                    ) : (
                      <p className="rounded-card bg-white px-3 py-2 text-midnight shadow-soft" key={`${method.type}-${method.value}`}>
                        <span className="font-semibold">{method.label}:</span> {method.value}
                      </p>
                    ),
                  )}
                </div>
              ) : null}
              {paymentPreview.note ? <p className="mt-3 text-ink/70">{paymentPreview.note}</p> : null}
            </div>
          ) : null}

      <div className="mt-6 grid gap-4 [&_input::placeholder]:text-sm [&_input::placeholder]:font-normal [&_input::placeholder]:text-ink/45 [&_textarea::placeholder]:text-sm [&_textarea::placeholder]:font-normal [&_textarea::placeholder]:text-ink/45">
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Dit navn *
              <input
                autoComplete="name"
                className={inputClass}
                disabled={isSoldOut}
                ref={firstFieldRef}
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

        <div className="flex items-start gap-3 rounded-md border border-[#eadff5] bg-white/70 px-4 py-3 text-sm leading-6 text-ink/72">
          <input
            aria-describedby="booking-legal-acceptance-text"
            className="mt-1 size-5 shrink-0 accent-sage-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A4EAB]"
            checked={acceptedGuidelines}
            disabled={isSoldOut}
            id="booking-legal-acceptance"
            name="accepted_guidelines"
            onChange={(event) => setAcceptedGuidelines(event.target.checked)}
            required
            type="checkbox"
            value="yes"
          />
          <div id="booking-legal-acceptance-text" className="grid gap-1">
            <p>
              Jeg accepterer SoulEvents&apos;{" "}
              <Link
                className="font-semibold text-[#7A4EAB] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A4EAB]"
                href="/legal/handelsbetingelser"
                rel="noopener noreferrer"
                target="_blank"
              >
                Handelsbetingelser for deltagere
              </Link>{" "}
              og bekræfter, at jeg har læst{" "}
              <Link
                className="font-semibold text-[#7A4EAB] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A4EAB]"
                href="/legal/privatlivspolitik"
                rel="noopener noreferrer"
                target="_blank"
              >
                Privatlivspolitikken
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      <button
        className={`${primaryActionClass} mt-6 h-12 w-full`}
        disabled={isSoldOut || isSubmittingBooking}
        type="submit"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <Send className="size-4" aria-hidden="true" />
          {isSubmittingBooking ? "Sender tilmelding..." : "Send tilmelding"}
        </span>
      </button>

          {message && (
            <div id="booking-response" className="mt-4 grid scroll-mt-8 gap-3">
              {bookingSent ? (
                <div className="rounded-card border border-[#E5D4F7] bg-[#FAF7FE] p-5 text-midnight shadow-soft">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#6E5A86] shadow-soft">
                      <Clock3 aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div className="grid gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E5A86]">Tilmelding modtaget</p>
                      <h3 className="text-lg font-semibold leading-tight text-midnight">
                        {isDirectRegistration ? "Din tilmelding er registreret" : "Din tilmelding afventer arrangørens bekræftelse"}
                      </h3>
                      <p className="text-sm leading-6 text-ink/72">{message}</p>
                      {!isDirectRegistration ? (
                        <p className="text-sm font-semibold leading-6 text-ink/72">
                          Hold øje med din indbakke. Din endelige bekræftelse sendes i en separat e-mail.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <AuthMessage message={message} variant={messageVariant} />
              )}
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md border border-sage-700/25 bg-white px-4 text-sm font-semibold text-sage-700 transition hover:border-sage-700 hover:bg-sage-50"
                href="/"
              >
                Tilbage til forsiden
              </Link>
            </div>
          )}
        </div>
      </div>

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
              Er du sikker på, at du ønsker at {isDirectRegistration ? "tilmelde" : "reservere"} {seats} pladser til dette event?
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
                className={`${primaryActionClass} h-11`}
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

    </form>
  );
}
