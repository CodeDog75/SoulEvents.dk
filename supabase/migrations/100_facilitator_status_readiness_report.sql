alter table public.facilitator_profiles
  alter column status set default 'draft'::public.facilitator_status;

create or replace view public.facilitator_status_readiness_report
with (security_invoker = true)
as
with current_required_organizer_documents as (
  select distinct on (v.document_type)
    v.document_type,
    v.id
  from public.legal_document_versions v
  left join public.legal_documents d on d.type = v.document_type
  where v.document_type in ('organizer_terms', 'guidelines')
    and v.requires_acceptance = true
    and v.effective_at <= now()
    and (d.current_version_id is null or d.current_version_id = v.id)
  order by v.document_type, v.effective_at desc, v.created_at desc, v.published_at desc
),
profile_readiness as (
  select
    fp.id as facilitator_id,
    fp.profile_id,
    coalesce(fp.company_name, p.full_name, p.email, 'Uden navn') as name,
    fp.status::text as current_status,
    array_remove(array[
      case when nullif(trim(coalesce(p.full_name, '')), '') is null then 'navn' end,
      case when nullif(trim(coalesce(fp.company_name, '')), '') is null then 'profilnavn' end,
      case when length(regexp_replace(trim(coalesce(nullif(fp.long_description, ''), fp.short_description, '')), '\s+', ' ', 'g')) < 100 then 'fortælling' end,
      case when nullif(trim(coalesce(fp.postal_code, '')), '') is null then 'postnummer' end,
      case when nullif(trim(coalesce(fp.city, '')), '') is null then 'by' end,
      case when nullif(trim(coalesce(fp.profile_image_path, '')), '') is null then 'profilbillede' end,
      case when not exists (
        select 1 from public.facilitator_images fi where fi.facilitator_id = fp.id
      ) then 'stemningsbillede' end,
      case when not exists (
        select 1 from public.facilitator_categories fc where fc.facilitator_id = fp.id
      ) then 'arbejdsområder' end
    ], null) as missing_profile_requirements,
    array(
      select doc.document_type::text
      from current_required_organizer_documents doc
      where not exists (
        select 1
        from public.legal_document_acceptances acceptance
        where acceptance.profile_id = fp.profile_id
          and acceptance.document_version_id = doc.id
      )
      order by doc.document_type::text
    ) as missing_legal_acceptances
  from public.facilitator_profiles fp
  join public.profiles p on p.id = fp.profile_id
)
select
  facilitator_id,
  profile_id,
  name,
  current_status,
  case
    when current_status = 'approved' then 'approved'
    when current_status = 'changes_requested' then 'changes_requested'
    when cardinality(missing_profile_requirements) = 0
      and cardinality(missing_legal_acceptances) = 0
      then 'pending_review'
    else 'draft'
  end as calculated_status,
  missing_profile_requirements || missing_legal_acceptances as missing_requirements,
  cardinality(missing_legal_acceptances) = 0 as has_required_terms_acceptance
from profile_readiness
where private.is_admin();

comment on view public.facilitator_status_readiness_report is
  'Read-only report for facilitator profile status/readiness mismatches. Does not update existing profile data.';

revoke all on table public.facilitator_status_readiness_report from anon;
revoke all on table public.facilitator_status_readiness_report from authenticated;
revoke all on table public.facilitator_status_readiness_report from public;

grant select on table public.facilitator_status_readiness_report to authenticated;

notify pgrst, 'reload schema';
