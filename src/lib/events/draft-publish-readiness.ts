export type DraftPublishChecklistItem = {
  key: string;
  label: string;
  valid: boolean;
};

export type DraftPublishReadiness = {
  canPublish: boolean;
  checklist: DraftPublishChecklistItem[];
};

function hasText(value: unknown, minLength = 1) {
  return typeof value === "string" && value.trim().length >= minLength;
}

export function getDraftPublishReadiness({
  event,
  facilitatorStatus,
  maxTicketPricePerPerson,
}: {
  event: {
    address_line?: string | null;
    capacity?: number | null;
    city?: string | null;
    country?: string | null;
    ends_at?: string | null;
    event_format?: string | null;
    event_main_categories?: Array<{ main_category_id?: string | null }> | null;
    event_tags?: Array<{ tag_id?: string | null }> | null;
    long_description?: string | null;
    online_url_or_note?: string | null;
    postal_code?: string | null;
    price_cents?: number | null;
    starts_at?: string | null;
    title?: string | null;
  };
  facilitatorStatus?: string | null;
  maxTicketPricePerPerson?: number | null;
}): DraftPublishReadiness {
  const startsAt = event.starts_at ? new Date(event.starts_at) : null;
  const endsAt = event.ends_at ? new Date(event.ends_at) : null;
  const mainCategoryCount = event.event_main_categories?.filter((row) => Boolean(row.main_category_id)).length ?? 0;
  const tagCount = event.event_tags?.filter((row) => Boolean(row.tag_id)).length ?? 0;
  const isOnline = event.event_format === "online";
  const priceCents = event.price_cents ?? 0;
  const checklist: DraftPublishChecklistItem[] = [
    { key: "title", label: "Titel", valid: hasText(event.title) },
    { key: "description", label: "Beskrivelse", valid: hasText(event.long_description, 20) },
    { key: "date", label: "Dato", valid: Boolean(startsAt && Number.isFinite(startsAt.getTime()) && startsAt > new Date()) },
    { key: "time", label: "Tidspunkt", valid: Boolean(startsAt && endsAt && Number.isFinite(endsAt.getTime()) && endsAt > startsAt) },
    {
      key: "location",
      label: isOnline ? "Online-link" : "Lokation",
      valid: isOnline ? hasText(event.online_url_or_note) : hasText(event.address_line) && hasText(event.postal_code) && hasText(event.city) && hasText(event.country),
    },
    { key: "main_category", label: "Hovedkategori", valid: mainCategoryCount >= 1 && mainCategoryCount <= 3 },
    { key: "tags", label: "Tags", valid: tagCount <= 4 },
    { key: "price", label: "Pris", valid: Number.isInteger(priceCents) && priceCents >= 0 },
    { key: "capacity", label: "Deltagerantal", valid: Number.isInteger(event.capacity ?? 0) && (event.capacity ?? 0) > 0 && (event.capacity ?? 0) <= 500 },
    {
      key: "ticket_price_limit",
      label: "Pris indenfor beløbsgrænse",
      valid: maxTicketPricePerPerson === null || maxTicketPricePerPerson === undefined || priceCents <= maxTicketPricePerPerson * 100,
    },
    { key: "facilitator_status", label: "Arrangørstatus", valid: facilitatorStatus === "approved" },
  ];

  return {
    canPublish: checklist.every((item) => item.valid),
    checklist,
  };
}
