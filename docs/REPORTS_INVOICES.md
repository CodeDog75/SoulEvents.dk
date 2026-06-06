# Månedsrapport og fakturakladder

Administrator kan bruge `/admin/reports` til at generere månedsrapport og fakturakladde pr. facilitator.

## Flow

1. Vælg godkendt facilitator.
2. Vælg måned.
3. Angiv eventuelle bankoplysninger.
4. Systemet finder bekræftede og afholdte tilmeldinger i perioden.
5. Systemet opretter eller opdaterer en `monthly_reports` række.
6. Systemet opretter en `invoice_drafts` kladde.
7. Systemet opretter `invoice_draft_lines` for de bookinger, der indgår.

## Status

Fakturakladder starter som `draft`.

Administrator kan godkende en kladde, hvorefter status sættes til `approved`, og `approved_by` / `approved_at` gemmes.

## Økonomi

Rapporten bruger de beregnede bookingfelter:

- `booking_value_cents`
- `commission_cents`

Kun bookinger med status `confirmed` eller `completed` indgår i rapportgenereringen.

