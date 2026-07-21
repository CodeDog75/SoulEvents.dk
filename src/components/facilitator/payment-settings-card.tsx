"use client";

import { CalendarDays, CheckCircle2, CreditCard, FileText, Info, Landmark, Link2, Save, Smartphone, UserRound } from "lucide-react";
import { type ElementType, useState, useTransition } from "react";
import { autosaveFacilitatorProfileAction } from "@/app/facilitator/profile/actions";

type PaymentSettings = {
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_registration_number?: string | null;
  deadline_days?: number | null;
  external_url?: string | null;
  instructions?: string | null;
  mobilepay_number?: string | null;
} | null;

type PaymentSettingsCardProps = {
  paymentSettings: PaymentSettings;
};

function value(input: string | number | null | undefined) {
  return input === null || input === undefined ? "" : String(input);
}

function hasPaymentSettings(settings: PaymentSettings) {
  return Boolean(
    settings?.mobilepay_number?.trim() ||
      settings?.bank_registration_number?.trim() ||
      settings?.bank_account_number?.trim() ||
      settings?.external_url?.trim() ||
      settings?.instructions?.trim(),
  );
}

const deadlineOptions = [
  { label: "3 dage efter bekræftelse", value: "3" },
  { label: "5 dage efter bekræftelse", value: "5" },
  { label: "14 dage efter bekræftelse", value: "14" },
  { label: "Senest på eventdagen", value: "60" },
];

function FieldLabel({ children, icon: Icon }: { children: string; icon: ElementType }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="size-4 text-[#7A5D91]" aria-hidden="true" />
      {children}
    </span>
  );
}

export function PaymentSettingsCard({ paymentSettings }: PaymentSettingsCardProps) {
  const [mobilepayNumber, setMobilepayNumber] = useState(value(paymentSettings?.mobilepay_number));
  const [bankRegistrationNumber, setBankRegistrationNumber] = useState(value(paymentSettings?.bank_registration_number));
  const [bankAccountNumber, setBankAccountNumber] = useState(value(paymentSettings?.bank_account_number));
  const [bankAccountName, setBankAccountName] = useState(value(paymentSettings?.bank_account_name));
  const [externalUrl, setExternalUrl] = useState(value(paymentSettings?.external_url));
  const [instructions, setInstructions] = useState(value(paymentSettings?.instructions));
  const [deadlineDays, setDeadlineDays] = useState(value(paymentSettings?.deadline_days ?? 14));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isConfigured = hasPaymentSettings({
    bank_account_name: bankAccountName,
    bank_account_number: bankAccountNumber,
    bank_registration_number: bankRegistrationNumber,
    deadline_days: Number(deadlineDays),
    external_url: externalUrl,
    instructions,
    mobilepay_number: mobilepayNumber,
  });

  function savePaymentSettings() {
    setMessage(null);
    startTransition(async () => {
      const result = await autosaveFacilitatorProfileAction({
        section: "payment",
        values: {
          payment_bank_account_name: bankAccountName,
          payment_bank_account_number: bankAccountNumber,
          payment_bank_registration_number: bankRegistrationNumber,
          payment_deadline_days: deadlineDays,
          payment_external_url: externalUrl,
          payment_instructions: instructions,
          payment_mobilepay_number: mobilepayNumber,
        },
      });

      setMessage(result.ok ? "Betalingsoplysningerne er gemt." : result.message);
    });
  }

  return (
    <section className="rounded-[20px] border border-[#E5DDEA] bg-[#FAF8FC] p-5" id="betaling">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-[#7A5D91] shadow-soft">
            <CreditCard className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Betaling</p>
            <h2 className="mt-1 text-lg font-semibold text-[#2F2437]">Betaling</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E6475]">
              Gem de betalingsoplysninger, du oftest bruger til dine events.
            </p>
          </div>
        </div>
        <span
          className={
            "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold " +
            (isConfigured ? "bg-[#EEF7F0] text-[#4F654A]" : "bg-[#FBF5E9] text-[#7A5D91]")
          }
        >
          {isConfigured ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : null}
          {isConfigured ? "Betaling er opsat" : "Betaling er ikke opsat"}
        </span>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-[18px] border border-[#E5DDEA] bg-white p-4 text-sm leading-6 text-[#6E6475]">
        <Info className="mt-0.5 size-4 shrink-0 text-[#7A5D91]" aria-hidden="true" />
        <p>Disse oplysninger vises aldrig offentligt. De sendes kun til deltageren, når du bekræfter en betalt tilmelding.</p>
      </div>

      <div className="mt-5 grid gap-5">
        <fieldset className="grid gap-3 rounded-[18px] border border-[#E5DDEA] bg-white/80 p-4">
          <legend className="px-1 text-sm font-semibold text-[#2F2437]">Mobilbetaling</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#2F2437]">
              <FieldLabel icon={Smartphone}>MobilePay-nummer</FieldLabel>
              <input
                className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 outline-none focus:border-[#7A5D91]"
                maxLength={40}
                onChange={(event) => setMobilepayNumber(event.currentTarget.value)}
                placeholder="Fx 12 34 56 78"
                value={mobilepayNumber}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#2F2437]">
              <FieldLabel icon={Link2}>Betalingslink (valgfrit)</FieldLabel>
              <input
                className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 outline-none focus:border-[#7A5D91]"
                maxLength={300}
                onChange={(event) => setExternalUrl(event.currentTarget.value)}
                placeholder="https://..."
                value={externalUrl}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-[18px] border border-[#E5DDEA] bg-white/80 p-4">
          <legend className="px-1 text-sm font-semibold text-[#2F2437]">Bankoplysninger</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-[#2F2437]">
              <FieldLabel icon={Landmark}>Registreringsnummer</FieldLabel>
              <input
                className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 outline-none focus:border-[#7A5D91]"
                maxLength={20}
                onChange={(event) => setBankRegistrationNumber(event.currentTarget.value)}
                value={bankRegistrationNumber}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#2F2437]">
              <FieldLabel icon={CreditCard}>Kontonummer</FieldLabel>
              <input
                className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 outline-none focus:border-[#7A5D91]"
                maxLength={40}
                onChange={(event) => setBankAccountNumber(event.currentTarget.value)}
                value={bankAccountNumber}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#2F2437]">
              <FieldLabel icon={UserRound}>Kontohaver</FieldLabel>
              <input
                className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 outline-none focus:border-[#7A5D91]"
                maxLength={120}
                onChange={(event) => setBankAccountName(event.currentTarget.value)}
                value={bankAccountName}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-[18px] border border-[#E5DDEA] bg-white/80 p-4">
          <legend className="px-1 text-sm font-semibold text-[#2F2437]">Betaling</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#2F2437]">
              <FieldLabel icon={CalendarDays}>Betalingsfrist</FieldLabel>
              <select
                className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 outline-none focus:border-[#7A5D91]"
                onChange={(event) => setDeadlineDays(event.currentTarget.value)}
                value={deadlineOptions.some((option) => option.value === deadlineDays) ? deadlineDays : "14"}
              >
                {deadlineOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#2F2437] sm:col-span-2">
              <FieldLabel icon={FileText}>Ekstra betalingsvejledning (valgfrit)</FieldLabel>
              <textarea
                className="min-h-36 rounded-md border border-[#E5DDEA] bg-white p-3 outline-none focus:border-[#7A5D91]"
                maxLength={800}
                onChange={(event) => setInstructions(event.currentTarget.value)}
                placeholder={`Hvis du har særlige betalingsoplysninger eller ønsker, kan du skrive dem her.\n\nEksempel:\n• Husk at skrive dit navn ved betalingen.\n• Kontakt mig gerne ved spørgsmål.`}
                value={instructions}
              />
            </label>
          </div>
        </fieldset>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-[#6E6475]">
          Betaling foregår direkte mellem dig og deltageren. SoulEvents modtager ikke betalingen.
        </p>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#4F654A] px-5 text-sm font-semibold text-white transition hover:bg-[#43573F] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={savePaymentSettings}
          type="button"
        >
          <Save className="size-4" aria-hidden="true" />
          {isPending ? "Gemmer..." : "Gem betalingsoplysninger"}
        </button>
      </div>
      {message ? <p className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#4F654A]">{message}</p> : null}
    </section>
  );
}
