"use client";

import { useMemo, useState } from "react";
import {
  createFacilitatorCommissionTermsAction,
  resetFacilitatorCommissionTermsAction,
} from "@/app/admin/commission/actions";

type FacilitatorOption = {
  id: string;
  name: string;
};

type CommissionValues = {
  commissionRateBps: number;
  currency: string;
  minimumCommissionCents: number;
  thresholdCents: number;
  tierOneLimitCents: number;
  tierThreeRateBps: number;
  tierTwoLimitCents: number;
  tierTwoRateBps: number;
};

type FacilitatorTerm = CommissionValues & {
  facilitatorId: string;
};

type FormValues = {
  commissionRatePercent: string;
  currency: string;
  reason: string;
  thresholdKr: string;
  tierOneLimitKr: string;
  tierThreeRatePercent: string;
  tierTwoLimitKr: string;
  tierTwoRatePercent: string;
};

type FacilitatorCommissionTermsFormProps = {
  facilitators: FacilitatorOption[];
  standardValues: CommissionValues;
  terms: FacilitatorTerm[];
};

function kroner(cents: number) {
  return String(Math.round(cents / 100));
}

function percent(bps: number) {
  return String(bps / 100).replace(".", ",");
}

function valuesFromCommission(values: CommissionValues): FormValues {
  return {
    commissionRatePercent: percent(values.commissionRateBps),
    currency: values.currency,
    reason: "",
    thresholdKr: kroner(values.thresholdCents),
    tierOneLimitKr: kroner(values.tierOneLimitCents),
    tierThreeRatePercent: percent(values.tierThreeRateBps),
    tierTwoLimitKr: kroner(values.tierTwoLimitCents),
    tierTwoRatePercent: percent(values.tierTwoRateBps),
  };
}

function fieldClass() {
  return "h-11 rounded-md border border-midnight/15 bg-white px-3 text-sm outline-none transition focus:border-[#7A5D91]";
}

export function FacilitatorCommissionTermsForm({
  facilitators,
  standardValues,
  terms,
}: FacilitatorCommissionTermsFormProps) {
  const termByFacilitator = useMemo(() => new Map(terms.map((term) => [term.facilitatorId, term])), [terms]);
  const [selectedFacilitatorId, setSelectedFacilitatorId] = useState("");
  const selectedTerm = selectedFacilitatorId ? termByFacilitator.get(selectedFacilitatorId) : undefined;
  const selectedValues = selectedTerm ?? standardValues;
  const [formValues, setFormValues] = useState<FormValues>(() => valuesFromCommission(standardValues));

  function updateSelectedFacilitator(facilitatorId: string) {
    const nextTerm = facilitatorId ? termByFacilitator.get(facilitatorId) : undefined;
    setSelectedFacilitatorId(facilitatorId);
    setFormValues(valuesFromCommission(nextTerm ?? standardValues));
  }

  function updateField(field: keyof FormValues, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form action={createFacilitatorCommissionTermsAction} className="mt-5 grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-ink/72">
        Arrangør
        <select
          className={fieldClass()}
          name="facilitator_id"
          onChange={(event) => updateSelectedFacilitator(event.target.value)}
          required
          value={selectedFacilitatorId}
        >
          <option value="">Vælg arrangør</option>
          {facilitators.map((facilitator) => (
            <option key={facilitator.id} value={facilitator.id}>
              {facilitator.name}
            </option>
          ))}
        </select>
      </label>

      {selectedFacilitatorId && !selectedTerm ? (
        <div className="rounded-md border border-[#D8CBE4] bg-[#F6F1F8] p-4 text-sm leading-6 text-midnight">
          <p className="font-semibold">Denne arrangør bruger i øjeblikket standardvilkårene.</p>
          <p className="mt-1 text-ink/70">
            Felterne nedenfor viser de gældende standardværdier. Gem kun, hvis arrangøren skal have individuelle vilkår.
          </p>
        </div>
      ) : null}

      {selectedTerm ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sage-200 bg-sage-50 p-4 text-sm text-midnight">
          <p className="font-semibold">Denne arrangør har aktive individuelle vilkår.</p>
          <button
            className="h-9 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight"
            formAction={resetFacilitatorCommissionTermsAction}
            formNoValidate
            type="submit"
          >
            Nulstil til standardvilkår
          </button>
        </div>
      ) : null}

      <label className="grid gap-2 text-sm font-semibold text-ink/72">
        Omsætning under denne grænse
        <input
          className={fieldClass()}
          name="threshold_kr"
          min={0}
          onChange={(event) => updateField("thresholdKr", event.target.value)}
          type="number"
          value={formValues.thresholdKr}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink/72">
        Omsætning fra denne grænse
        <input
          className={fieldClass()}
          name="tier_one_limit_kr"
          min={0}
          onChange={(event) => updateField("tierOneLimitKr", event.target.value)}
          type="number"
          value={formValues.tierOneLimitKr}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink/72">
        Sats fra første grænse
        <input
          className={fieldClass()}
          inputMode="decimal"
          name="tier_one_rate_percent"
          onChange={(event) => updateField("commissionRatePercent", event.target.value)}
          type="text"
          value={formValues.commissionRatePercent}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink/72">
        Omsætning fra næste grænse
        <input
          className={fieldClass()}
          name="tier_two_limit_kr"
          min={0}
          onChange={(event) => updateField("tierTwoLimitKr", event.target.value)}
          type="number"
          value={formValues.tierTwoLimitKr}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink/72">
        Sats fra næste grænse
        <input
          className={fieldClass()}
          inputMode="decimal"
          name="tier_two_rate_percent"
          onChange={(event) => updateField("tierTwoRatePercent", event.target.value)}
          type="text"
          value={formValues.tierTwoRatePercent}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink/72">
        Sats fra højeste grænse
        <input
          className={fieldClass()}
          inputMode="decimal"
          name="tier_three_rate_percent"
          onChange={(event) => updateField("tierThreeRatePercent", event.target.value)}
          type="text"
          value={formValues.tierThreeRatePercent}
        />
      </label>
      <input name="minimum_commission_kr" type="hidden" value="0" />
      <input name="currency" type="hidden" value={formValues.currency || selectedValues.currency} />
      <label className="grid gap-2 text-sm font-semibold text-ink/72">
        Intern begrundelse
        <textarea
          className="min-h-24 rounded-md border border-midnight/15 bg-white p-3 text-sm outline-none transition focus:border-[#7A5D91]"
          name="reason"
          onChange={(event) => updateField("reason", event.target.value)}
          required
          value={formValues.reason}
        />
      </label>
      <button className="h-11 rounded-md bg-[#7A5D91] px-4 text-sm font-semibold text-white" type="submit">
        Gem arrangørvilkår
      </button>
    </form>
  );
}
