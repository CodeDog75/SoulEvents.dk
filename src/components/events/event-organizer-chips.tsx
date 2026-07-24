type ProfileRelation =
  | {
      full_name?: string | null;
    }
  | Array<{
      full_name?: string | null;
    }>
  | null
  | undefined;

type FacilitatorProfile = {
  id?: string | null;
  slug?: string | null;
  company_name?: string | null;
  profiles?: ProfileRelation;
};

type FacilitatorProfileRelation =
  | FacilitatorProfile
  | FacilitatorProfile[]
  | null
  | undefined;

type EventCoOrganizerRelation = {
  created_at?: string | null;
  status?: string | null;
  facilitator_profiles?: FacilitatorProfileRelation;
};

export type EventOrganizerSource = {
  facilitator_profiles?: FacilitatorProfileRelation;
  event_co_organizers?: EventCoOrganizerRelation[] | null;
};

type EventOrganizerItem = {
  key: string;
  name: string;
  primary: boolean;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

function profileName(profile: FacilitatorProfile | null) {
  const user = first(profile?.profiles);
  return profile?.company_name?.trim() || user?.full_name?.trim() || null;
}

function organizerKey(profile: FacilitatorProfile | null, name: string) {
  return profile?.id || profile?.slug || name.toLocaleLowerCase("da-DK");
}

export function getEventOrganizerNames(event: EventOrganizerSource) {
  return getEventOrganizers(event).map((organizer) => organizer.name);
}

export function getEventOrganizers(event: EventOrganizerSource): EventOrganizerItem[] {
  const organizers: EventOrganizerItem[] = [];
  const seen = new Set<string>();
  const primaryProfile = first(event.facilitator_profiles);
  const primaryName = profileName(primaryProfile) || "Arrangør";
  const primaryKey = organizerKey(primaryProfile, primaryName);

  organizers.push({ key: primaryKey, name: primaryName, primary: true });
  seen.add(primaryKey);

  const acceptedCoOrganizers = [...(event.event_co_organizers ?? [])]
    .filter((row) => row.status === "accepted")
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));

  for (const row of acceptedCoOrganizers) {
    const profile = first(row.facilitator_profiles);
    const name = profileName(profile);
    if (!name) continue;

    const key = organizerKey(profile, name);
    if (seen.has(key)) continue;

    organizers.push({ key, name, primary: false });
    seen.add(key);
  }

  return organizers;
}

export function EventOrganizerChips({ className = "", event }: { className?: string; event: EventOrganizerSource }) {
  const organizers = getEventOrganizers(event);

  if (organizers.length === 0) return null;

  return (
    <div className={"flex flex-wrap items-center gap-1.5 " + className}>
      {organizers.map((organizer) => (
        <span
          className={
            organizer.primary
              ? "max-w-full truncate rounded-full border border-sage-700/15 bg-sage-50 px-2.5 py-1 text-xs font-bold text-sage-700"
              : "max-w-full truncate rounded-full border border-olive/10 bg-white/85 px-2.5 py-1 text-xs font-semibold text-ink/68"
          }
          key={organizer.key}
          title={organizer.name}
        >
          {organizer.name}
        </span>
      ))}
    </div>
  );
}
