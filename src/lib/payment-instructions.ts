export type PaymentMethodSource = "facilitator" | "custom" | "none";

export type PaymentInstructionsRecord = {
  payment_bank_account_name?: string | null;
  payment_bank_account_number?: string | null;
  payment_bank_registration_number?: string | null;
  payment_deadline_days?: number | null;
  payment_external_url?: string | null;
  payment_instructions?: string | null;
  payment_mobilepay_number?: string | null;
};

export type PaymentSettingsRecord = {
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_registration_number?: string | null;
  deadline_days?: number | null;
  external_url?: string | null;
  instructions?: string | null;
  mobilepay_number?: string | null;
};

export type PaymentInstructionMethod = {
  label: string;
  type: "bank_transfer" | "external_link" | "manual" | "mobilepay";
  url?: string | null;
  value: string;
};

export type PaymentInstructionsSnapshot = {
  amountCents: number;
  currency: "DKK";
  disclaimer: string;
  dueAt: string | null;
  generatedAt: string;
  methods: PaymentInstructionMethod[];
  note: string | null;
  reference: string;
  source: PaymentMethodSource;
};

export const paymentDisclaimer =
  "Betalingen foregår direkte mellem dig og arrangøren. SoulEvents modtager eller behandler ikke betalingen.";

export function paymentSettingsToInstructionsRecord(
  settings: PaymentSettingsRecord | null | undefined,
): PaymentInstructionsRecord {
  return {
    payment_bank_account_name: settings?.bank_account_name ?? null,
    payment_bank_account_number: settings?.bank_account_number ?? null,
    payment_bank_registration_number: settings?.bank_registration_number ?? null,
    payment_deadline_days: settings?.deadline_days ?? null,
    payment_external_url: settings?.external_url ?? null,
    payment_instructions: settings?.instructions ?? null,
    payment_mobilepay_number: settings?.mobilepay_number ?? null,
  };
}

function cleanText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeUrl(value: string | null | undefined) {
  const url = cleanText(value);

  if (!url) {
    return "";
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return "https://" + url;
}

export function hasPaymentInstructions(record: PaymentInstructionsRecord | null | undefined) {
  if (!record) {
    return false;
  }

  return Boolean(
    cleanText(record.payment_mobilepay_number) ||
      cleanText(record.payment_bank_registration_number) ||
      cleanText(record.payment_bank_account_number) ||
      cleanText(record.payment_external_url) ||
      cleanText(record.payment_instructions),
  );
}

function resolvePaymentRecord({
  event,
  facilitator,
}: {
  event: PaymentInstructionsRecord & { payment_method_source?: PaymentMethodSource | null };
  facilitator: PaymentInstructionsRecord;
}) {
  const source = event.payment_method_source ?? "facilitator";

  if (source === "custom") {
    return { record: event, source };
  }

  if (source === "none") {
    return { record: event, source };
  }

  return { record: facilitator, source: "facilitator" as const };
}

function buildMethods(record: PaymentInstructionsRecord) {
  const methods: PaymentInstructionMethod[] = [];
  const mobilepay = cleanText(record.payment_mobilepay_number);
  const registrationNumber = cleanText(record.payment_bank_registration_number);
  const accountNumber = cleanText(record.payment_bank_account_number);
  const accountName = cleanText(record.payment_bank_account_name);
  const externalUrl = normalizeUrl(record.payment_external_url);

  if (mobilepay) {
    methods.push({ label: "MobilePay", type: "mobilepay", value: mobilepay });
  }

  if (registrationNumber || accountNumber) {
    methods.push({
      label: "Bankoverførsel",
      type: "bank_transfer",
      value: [
        registrationNumber ? `Reg.nr. ${registrationNumber}` : "",
        accountNumber ? `Kontonr. ${accountNumber}` : "",
        accountName ? `Modtager: ${accountName}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  if (externalUrl) {
    methods.push({ label: "Betalingslink", type: "external_link", url: externalUrl, value: externalUrl });
  }

  return methods;
}

function resolveDueAt({
  confirmedAt,
  deadlineDays,
  eventStartsAt,
  source,
}: {
  confirmedAt: Date;
  deadlineDays: number | null | undefined;
  eventStartsAt: string;
  source: PaymentMethodSource;
}) {
  if (source === "none") {
    return null;
  }

  const safeDeadlineDays = Number.isInteger(deadlineDays) ? Math.max(0, Math.min(deadlineDays ?? 14, 60)) : 14;
  const dueAt = new Date(confirmedAt);
  dueAt.setDate(dueAt.getDate() + safeDeadlineDays);

  const eventDate = new Date(eventStartsAt);
  if (!Number.isNaN(eventDate.getTime()) && dueAt > eventDate) {
    return eventDate.toISOString();
  }

  return dueAt.toISOString();
}

export function buildBookingPaymentInstructions({
  amountCents,
  confirmedAt,
  event,
  eventStartsAt,
  facilitator,
  reference,
}: {
  amountCents: number;
  confirmedAt: Date;
  event: PaymentInstructionsRecord & { payment_method_source?: PaymentMethodSource | null };
  eventStartsAt: string;
  facilitator: PaymentInstructionsRecord;
  reference: string;
}): PaymentInstructionsSnapshot | null {
  if (amountCents <= 0) {
    return null;
  }

  const { record, source } = resolvePaymentRecord({ event, facilitator });
  const methods = source === "none" ? [] : buildMethods(record);
  const note =
    source === "none"
      ? cleanText(record.payment_instructions) || "Betaling aftales direkte med arrangøren."
      : cleanText(record.payment_instructions) || null;

  if (source !== "none" && methods.length === 0 && !note) {
    return null;
  }

  return {
    amountCents,
    currency: "DKK",
    disclaimer: paymentDisclaimer,
    dueAt: resolveDueAt({
      confirmedAt,
      deadlineDays: record.payment_deadline_days,
      eventStartsAt,
      source,
    }),
    generatedAt: confirmedAt.toISOString(),
    methods,
    note,
    reference,
    source,
  };
}

export function formatPaymentDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("da-DK", { dateStyle: "long" }).format(new Date(value));
}

export function formatPaymentAmount(cents: number) {
  return `${new Intl.NumberFormat("da-DK").format(cents / 100)} kr.`;
}

export function parsePaymentInstructionsSnapshot(value: unknown): PaymentInstructionsSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<PaymentInstructionsSnapshot>;

  if (typeof snapshot.reference !== "string" || !Array.isArray(snapshot.methods)) {
    return null;
  }

  return {
    amountCents: typeof snapshot.amountCents === "number" ? snapshot.amountCents : 0,
    currency: "DKK",
    disclaimer: typeof snapshot.disclaimer === "string" ? snapshot.disclaimer : paymentDisclaimer,
    dueAt: typeof snapshot.dueAt === "string" ? snapshot.dueAt : null,
    generatedAt: typeof snapshot.generatedAt === "string" ? snapshot.generatedAt : "",
    methods: snapshot.methods.filter((method): method is PaymentInstructionMethod => {
      return Boolean(method && typeof method.label === "string" && typeof method.value === "string" && typeof method.type === "string");
    }),
    note: typeof snapshot.note === "string" ? snapshot.note : null,
    reference: snapshot.reference,
    source:
      snapshot.source === "custom" || snapshot.source === "none" || snapshot.source === "facilitator"
        ? snapshot.source
        : "facilitator",
  };
}
