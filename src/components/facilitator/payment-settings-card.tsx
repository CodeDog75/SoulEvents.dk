"use client";

import { CheckCircle2, CreditCard, Landmark, Link2, Save, Smartphone, WalletCards, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  returnTo?: string | null;
};

function value(input: string | number | null | undefined) {
  return input === null || input === undefined ? "" : String(input);
}

function hasValue(input: string) {
  return input.trim().length > 0;
}

function methodCount(input: {
  bankAccountNumber: string;
  bankRegistrationNumber: string;
  cashEnabled: boolean;
  externalUrl: string;
  mobilepayNumber: string;
}) {
  return [
    hasValue(input.mobilepayNumber),
    hasValue(input.bankRegistrationNumber) && hasValue(input.bankAccountNumber),
    input.cashEnabled,
    hasValue(input.externalUrl),
  ].filter(Boolean).length;
}

function MethodStatus({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold " + (active ? "bg-[#EEF7F0] text-[#4F654A]" : "bg-white text-[#7B7182]")}>
      {active ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <span className="size-3.5 rounded-full border border-current" aria-hidden="true" />}
      {label}
    </span>
  );
}

function SectionTitle({ children, icon: Icon }: { children: string; icon: LucideIcon }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#2F2437]">
      <Icon className="size-4 text-[#7A5D91]" aria-hidden="true" />
      {children}
    </span>
  );
}

export function PaymentSettingsCard({ paymentSettings, returnTo = null }: PaymentSettingsCardProps) {
  const router = useRouter();
  const [mobilepayNumber, setMobilepayNumber] = useState(value(paymentSettings?.mobilepay_number));
  const [bankRegistrationNumber, setBankRegistrationNumber] = useState(value(paymentSettings?.bank_registration_number));
  const [bankAccountNumber, setBankAccountNumber] = useState(value(paymentSettings?.bank_account_number));
  const [bankAccountName, setBankAccountName] = useState(value(paymentSettings?.bank_account_name));
  const [externalUrl, setExternalUrl] = useState(value(paymentSettings?.external_url));
  const [cashEnabled, setCashEnabled] = useState(hasValue(value(paymentSettings?.instructions)));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const configuredMethods = methodCount({
    bankAccountNumber,
    bankRegistrationNumber,
    cashEnabled,
    externalUrl,
    mobilepayNumber,
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
          payment_deadline_days: value(paymentSettings?.deadline_days ?? 14),
          payment_external_url: externalUrl,
          payment_instructions: cashEnabled ? "Kontant betaling tilbydes." : "",
          payment_mobilepay_number: mobilepayNumber,
        },
      });

      if (result.ok && returnTo) {
        router.push(returnTo);
        return;
      }

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
            <h2 className="mt-1 text-lg font-semibold text-[#2F2437]">Standard betalingsoplysninger</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E6475]">
              Disse oplysninger bruges som standard på dine betalte events. Du kan altid ændre dem på det enkelte event.
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#4F654A]">
          {configuredMethods} af 4 betalingsmetoder er opsat
        </span>
      </div>

      <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
        <MethodStatus active={hasValue(mobilepayNumber)} label="MobilePay" />
        <MethodStatus active={hasValue(bankRegistrationNumber) && hasValue(bankAccountNumber)} label="Bankkonto" />
        <MethodStatus active={cashEnabled} label="Kontant" />
        <MethodStatus active={hasValue(externalUrl)} label="Betalingslink" />
      </div>

      <div className="mt-5 rounded-[18px] border border-[#E5DDEA] bg-white px-4 py-3 text-sm leading-6 text-[#6E6475]">
        Betalingsoplysningerne vises kun til deltagere, der tilmelder sig et betalt event via SoulEvents.
      </div>

      <div className="mt-5 grid gap-4">
        <fieldset className="grid gap-3 rounded-[18px] border border-[#E5DDEA] bg-white/80 p-4">
          <legend className="px-1">
            <SectionTitle icon={Smartphone}>MobilePay</SectionTitle>
          </legend>
          <label className="grid gap-2 text-sm font-semibold text-[#2F2437]">
            MobilePay-nummer
            <input
              className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 outline-none focus:border-[#7A5D91]"
              maxLength={40}
              onChange={(event) => setMobilepayNumber(event.currentTarget.value)}
              placeholder="Fx 12 34 56 78"
              value={mobilepayNumber}
            />
          </label>
        </fieldset>

        <fieldset className="grid gap-3 rounded-[18px] border border-[#E5DDEA] bg-white/80 p-4">
          <legend className="px-1">
            <SectionTitle icon={Landmark}>Bankoverførsel</SectionTitle>
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-[#2F2437]">
              Registreringsnummer
              <input
                className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 outline-none focus:border-[#7A5D91]"
                maxLength={20}
                onChange={(event) => setBankRegistrationNumber(event.currentTarget.value)}
                value={bankRegistrationNumber}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#2F2437]">
              Kontonummer
              <input
                className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 outline-none focus:border-[#7A5D91]"
                maxLength={40}
                onChange={(event) => setBankAccountNumber(event.currentTarget.value)}
                value={bankAccountNumber}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#2F2437]">
              Kontohaver
              <input
                className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 outline-none focus:border-[#7A5D91]"
                maxLength={120}
                onChange={(event) => setBankAccountName(event.currentTarget.value)}
                value={bankAccountName}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="rounded-[18px] border border-[#E5DDEA] bg-white/80 p-4">
          <legend className="px-1">
            <SectionTitle icon={WalletCards}>Kontant</SectionTitle>
          </legend>
          <label className="flex min-w-0 items-center gap-3 text-sm font-semibold text-[#2F2437]">
            <input
              checked={cashEnabled}
              className="size-4 accent-[#7A5D91]"
              onChange={(event) => setCashEnabled(event.currentTarget.checked)}
              type="checkbox"
            />
            Jeg tilbyder også kontant betaling.
          </label>
        </fieldset>

        <fieldset className="grid gap-3 rounded-[18px] border border-[#E5DDEA] bg-white/80 p-4">
          <legend className="px-1">
            <SectionTitle icon={Link2}>Har du et fast betalingslink?</SectionTitle>
          </legend>
          <p className="text-sm leading-6 text-[#6E6475]">
            Hvis du ofte bruger det samme betalingslink, kan du gemme det her. Det kan vælges på dine events.
          </p>
          <label className="grid gap-2 text-sm font-semibold text-[#2F2437]">
            Betalingslink
            <input
              className="h-11 rounded-md border border-[#E5DDEA] bg-white px-3 outline-none focus:border-[#7A5D91]"
              maxLength={300}
              onChange={(event) => setExternalUrl(event.currentTarget.value)}
              placeholder="https://..."
              value={externalUrl}
            />
          </label>
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
