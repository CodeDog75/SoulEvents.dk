insert into public.legal_documents (type, title, slug, body, is_published, version, published_at, effective_at, requires_acceptance)
values
  (
    'organizer_terms',
    'Arrangørvilkår',
    'arrangoervilkaar',
    'Indsæt arrangørvilkår for SoulEvents.dk her.',
    false,
    '1.0',
    null,
    null,
    true
  ),
  (
    'cookies',
    'Cookiepolitik',
    'cookiepolitik',
    'Indsæt cookiepolitik for SoulEvents.dk her.',
    false,
    '1.0',
    null,
    null,
    false
  )
on conflict (type) do nothing;
