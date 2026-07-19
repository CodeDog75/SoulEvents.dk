"use client";

import { useState } from "react";
import { createCommissionSettingAction } from "@/app/admin/commission/actions";

type StandardCommissionSettingsFormProps = {
  currentValues: {
    commissionRateBps: number;
    currency: string;
    minimumCommissionCents: number;
    thresholdCents: number;
    tierOneLimitCents: number;
    tierThreeRateBps: number;
    tierTwoLimitCents: number;
    tierTwoRateBps: number;
  };
};

type FormValues = {
  currency: string;
  effectiveFrom: string;
  reason: string;
  thresholdKr: string;
  tierOneLimitKr: string;
  tierOneRatePercent: string;
  tierThreeRatePercent: string;
  tierTwoLimitKr: string;
  tierTwoRatePercent: string;
};

const exampleParticipants = 20;
const examplePricePerParticipantKr = 750;

function fieldClass() {
  return "h-11 rounded-md border border-midnight/15 bg-white px-3 text-sm outline-none transition focus:border-[#7A5D91]";
}

function kroner(cents: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(Math.round(cents / 100)) + " kr.";
}

function kronerBefore(cents: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor((cents - 1) / 100))) + " kr.";
}

function percent(bps: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(bps / 100) + " %";
}

function toKr(cents: number) {
  return String(Math.round(cents / 100));
}

function toPercentInput(bps: number) {
  return String(bps / 100).replace(".", ",");
}

function parseKr(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function parsePercent(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

export function StandardCommissionSettingsForm({ currentValues }: StandardCommissionSettingsFormProps) {
  const [formValues, setFormValues] = useState<FormValues>({
    currency: currentValues.currency,
    effectiveFrom: "",
    reason: "",
    thresholdKr: toKr(currentValues.thresholdCents),
    tierOneLimitKr: toKr(currentValues.tierOneLimitCents),
    tierOneRatePercent: toPercentInput(currentValues.commissionRateBps),
    tierThreeRatePercent: toPercentInput(currentValues.tierThreeRateBps),
    tierTwoLimitKr: toKr(currentValues.tierTwoLimitCents),
    tierTwoRatePercent: toPercentInput(currentValues.tierTwoRateBps),
  });

  function updateField(field: keyof FormValues, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const thresholdCents = parseKr(formValues.thresholdKr);
  const tierOneLimitCents = Math.max(thresholdCents, parseKr(formValues.tierOneLimitKr));
  const tierTwoLimitCents = Math.max(tierOneLimitCents, parseKr(formValues.tierTwoLimitKr));
  const tierOneRateBps = parsePercent(formValues.tierOneRatePercent);
  const tierTwoRateBps = parsePercent(formValues.tierTwoRatePercent);
  const tierThreeRateBps = parsePercent(formValues.tierThreeRatePercent);
  const exampleRevenueCents = exampleParticipants * examplePricePerParticipantKr * 100;
  const exampleTier =
    exampleRevenueCents < thresholdCents ? "free" : exampleRevenueCents < tierOneLimitCents ? "one" : exampleRevenueCents < tierTwoLimitCents ? "two" : "three";
  const applicableRateBps =
    exampleTier === "free"
      ? 0
      : exampleTier === "one"
        ? tierOneRateBps
        : exampleTier === "two"
          ? tierTwoRateBps
          : tierThreeRateBps;
  const totalCommissionCents = Math.round((exampleRevenueCents * applicableRateBps) / 10_000);
  const exampleTierLabel =
    exampleTier === "free"
      ? `under ${kroner(thresholdCents)}`
      : exampleTier === "one"
        ? `${kroner(thresholdCents)}-${kronerBefore(tierOneLimitCents)}`
        : exampleTier === "two"
          ? `${kroner(tierOneLimitCents)}-${kronerBefore(tierTwoLimitCents)}`
          : `${kroner(tierTwoLimitCents)} og derover`;
  const revenueSteps = [
    {
      from: <input className={fieldClass()} disabled value="0 kr." />,
      key: "free",
      rate: <input className={fieldClass()} disabled value="0" />,
      title: "Trin 1",
      to: <input className={fieldClass()} disabled value={kronerBefore(thresholdCents)} />,
    },
    {
      from: (
        <input
          className={fieldClass()}
          min={0}
          name="threshold_kr"
          onChange={(event) => updateField("thresholdKr", event.target.value)}
          type="number"
          value={formValues.thresholdKr}
        />
      ),
      key: "tier-1",
      rate: (
        <input
          className={fieldClass()}
          inputMode="decimal"
          name="tier_one_rate_percent"
          onChange={(event) => updateField("tierOneRatePercent", event.target.value)}
          type="text"
          value={formValues.tierOneRatePercent}
        />
      ),
      title: "Trin 2",
      to: <input className={fieldClass()} disabled value={kronerBefore(tierOneLimitCents)} />,
    },
    {
      from: (
        <input
          className={fieldClass()}
          min={0}
          name="tier_one_limit_kr"
          onChange={(event) => updateField("tierOneLimitKr", event.target.value)}
          type="number"
          value={formValues.tierOneLimitKr}
        />
      ),
      key: "tier-2",
      rate: (
        <input
          className={fieldClass()}
          inputMode="decimal"
          name="tier_two_rate_percent"
          onChange={(event) => updateField("tierTwoRatePercent", event.target.value)}
          type="text"
          value={formValues.tierTwoRatePercent}
        />
      ),
      title: "Trin 3",
      to: <input className={fieldClass()} disabled value={kronerBefore(tierTwoLimitCents)} />,
    },
    {
      from: (
        <input
          className={fieldClass()}
          min={0}
          name="tier_two_limit_kr"
          onChange={(event) => updateField("tierTwoLimitKr", event.target.value)}
          type="number"
          value={formValues.tierTwoLimitKr}
        />
      ),
      key: "tier-3",
      rate: (
        <input
          className={fieldClass()}
          inputMode="decimal"
          name="tier_three_rate_percent"
          onChange={(event) => updateField("tierThreeRatePercent", event.target.value)}
          type="text"
          value={formValues.tierThreeRatePercent}
        />
      ),
      title: "Trin 4",
      to: <input className={fieldClass()} disabled value="Ingen øvre grænse" />,
    },
  ];

  return (
    <form action={createCommissionSettingAction} className="mt-5 grid gap-4">
      <input name="minimum_commission_kr" type="hidden" value="0" />
      <div className="grid gap-3">
        {revenueSteps.map((step) => (
          <section className="rounded-md border border-midnight/10 bg-[#FBFAF7] p-4" key={step.key}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#7A5D91]">{step.title}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                Fra
                {step.from}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                Til
                {step.to}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                Kommissionssats
                {step.rate}
              </label>
            </div>
          </section>
        ))}
      </div>
      <label className="grid gap-2 text-sm font-semibold text-ink/72">
        Valuta
        <input
          className={fieldClass()}
          maxLength={3}
          name="currency"
          onChange={(event) => updateField("currency", event.target.value)}
          value={formValues.currency}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink/72">
        Ikrafttrædelse
        <input
          className={fieldClass()}
          name="effective_from"
          onChange={(event) => updateField("effectiveFrom", event.target.value)}
          type="datetime-local"
          value={formValues.effectiveFrom}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink/72">
        Intern begrundelse
        <textarea
          className="min-h-24 rounded-md border border-midnight/15 bg-white p-3 text-sm outline-none transition focus:border-[#7A5D91]"
          name="reason"
          onChange={(event) => updateField("reason", event.target.value)}
          value={formValues.reason}
        />
      </label>

      <aside className="rounded-md border border-[#D8CBE4] bg-[#F6F1F8] p-4 text-sm text-midnight">
        <h3 className="font-semibold">Sådan beregnes kommissionen</h3>
        <p className="mt-1 text-ink/68">
          Kommissionen bestemmes af eventets samlede omsætning. Når eventets omsætningstrin er fundet, beregnes satsen af hele eventets omsætning.
        </p>
        <p className="mt-3 text-ink/68">
          Eksempel: {exampleParticipants} deltagere × {kroner(examplePricePerParticipantKr * 100)} = {kroner(exampleRevenueCents)} i samlet omsætning.
          Eventet ligger i omsætningstrinnet {exampleTierLabel}. Kommissionen er {percent(applicableRateBps)} af {kroner(exampleRevenueCents)} ={" "}
          {kroner(totalCommissionCents)}.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#D8CBE4] text-xs uppercase tracking-wide text-ink/45">
              <tr>
                <th className="py-2 pr-3">Samlet eventomsætning</th>
                <th className="py-2 pr-3">Sats</th>
                <th className="py-2 text-right">Eksempel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8CBE4]/70">
              <tr>
                <td className="py-2 pr-3">Under {kroner(thresholdCents)}</td>
                <td className="py-2 pr-3">0 %</td>
                <td className="py-2 text-right">{exampleTier === "free" ? kroner(totalCommissionCents) : "-"}</td>
              </tr>
              <tr>
                <td className="py-2 pr-3">{kroner(thresholdCents)}-{kronerBefore(tierOneLimitCents)}</td>
                <td className="py-2 pr-3">{percent(tierOneRateBps)}</td>
                <td className="py-2 text-right">{exampleTier === "one" ? kroner(totalCommissionCents) : "-"}</td>
              </tr>
              <tr>
                <td className="py-2 pr-3">{kroner(tierOneLimitCents)}-{kronerBefore(tierTwoLimitCents)}</td>
                <td className="py-2 pr-3">{percent(tierTwoRateBps)}</td>
                <td className="py-2 text-right">{exampleTier === "two" ? kroner(totalCommissionCents) : "-"}</td>
              </tr>
              <tr>
                <td className="py-2 pr-3">{kroner(tierTwoLimitCents)} og derover</td>
                <td className="py-2 pr-3">{percent(tierThreeRateBps)}</td>
                <td className="py-2 text-right">{exampleTier === "three" ? kroner(totalCommissionCents) : "-"}</td>
              </tr>
            </tbody>
            <tfoot className="border-t border-[#D8CBE4] font-semibold">
              <tr>
                <td className="py-3 pr-3" colSpan={2}>
                  Samlet kommission
                </td>
                <td className="py-3 text-right">{kroner(totalCommissionCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-ink/62">
          Flere små events lægges ikke sammen for at udløse kommission. Hvert event afregnes for sig.
        </p>
      </aside>

      <button className="h-11 rounded-md bg-[#2F4A3A] px-4 text-sm font-semibold text-white" type="submit">
        Gem ny standard
      </button>
    </form>
  );
}
