export type OrganizerBadgeType = "active" | "experienced";

type OrganizerBadgeDefinition = {
  label: string;
  icon: string;
  description: string;
  className: string;
  infoClassName: string;
};

const badgeDefinitions: Record<OrganizerBadgeType, OrganizerBadgeDefinition> = {
  active: {
    label: "Aktiv Arrangør",
    icon: "🌱",
    description: "Denne arrangør opretter løbende events på SoulEvents.",
    className: "border-[#D7E4D1] bg-[#F3F7F0] text-[#5F7A55] hover:bg-[#EDF4E8]",
    infoClassName: "border-[#D7E4D1] bg-[#F3F7F0] text-[#4D6048]",
  },
  experienced: {
    label: "Erfaren Arrangør",
    icon: "🌿",
    description:
      "Denne arrangør har gennemført flere events på SoulEvents og har erfaring med at skabe oplevelser med deltagere på platformen.",
    className: "border-[#D8CBE4] bg-[#F4F0F7] text-[#6E5A86] hover:bg-[#EFE8F5]",
    infoClassName: "border-[#D8CBE4] bg-[#F4F0F7] text-[#4D4458]",
  },
};

function orderedBadges(badges: OrganizerBadgeType[]) {
  const unique = Array.from(new Set(badges));
  return unique.sort((a, b) => {
    const order: Record<OrganizerBadgeType, number> = { experienced: 0, active: 1 };
    return order[a] - order[b];
  });
}

export function organizerBadgesFromFlags(flags: { isActiveHost?: boolean | null; isExperiencedHost?: boolean | null }) {
  const badges: OrganizerBadgeType[] = [];
  if (flags.isExperiencedHost) badges.push("experienced");
  if (flags.isActiveHost) badges.push("active");
  return badges;
}

export function OrganizerBadge({ type }: { type: OrganizerBadgeType }) {
  const badge = badgeDefinitions[type];

  return (
    <span className="group relative inline-flex w-fit">
      <span
        className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition sm:text-xs " + badge.className}
        tabIndex={0}
        title={badge.description}
      >
        <span aria-hidden="true">{badge.icon}</span>
        {badge.label}
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-xl border border-[#D8CBE4] bg-white p-3 text-left text-xs font-normal leading-5 text-[#4D4458] shadow-lift group-hover:block group-focus-within:block">
        <span className="block font-semibold text-[#6E5A86]">
          {badge.icon} {badge.label}
        </span>
        <span className="mt-1 block">{badge.description}</span>
      </span>
    </span>
  );
}

export function OrganizerImageBadge({ type }: { type: OrganizerBadgeType }) {
  const badge = badgeDefinitions[type];

  return (
    <span className="group absolute left-3 top-3 z-10 inline-flex w-fit">
      <span
        className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-soft backdrop-blur transition " + badge.className}
        tabIndex={0}
        title={badge.description}
      >
        <span aria-hidden="true">{badge.icon}</span>
        {badge.label}
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-xl border border-[#D8CBE4] bg-white p-3 text-left text-xs font-normal leading-5 text-[#4D4458] shadow-lift group-hover:block group-focus-within:block">
        <span className="block font-semibold text-[#6E5A86]">
          {badge.icon} {badge.label}
        </span>
        <span className="mt-1 block">{badge.description}</span>
      </span>
    </span>
  );
}

export function OrganizerBadges({ badges }: { badges: OrganizerBadgeType[] }) {
  const ordered = orderedBadges(badges);
  if (ordered.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {ordered.map((badge) => (
        <OrganizerBadge key={badge} type={badge} />
      ))}
    </div>
  );
}

function OrganizerBadgeInfo({ type, children }: { type: OrganizerBadgeType; children: React.ReactNode }) {
  const badge = badgeDefinitions[type];

  return (
    <section className={"rounded-[18px] border px-5 py-4 " + badge.infoClassName}>
      <h2 className="text-base font-bold">
        {badge.icon} {badge.label}
      </h2>
      <p className="mt-2 text-sm leading-6">{children}</p>
    </section>
  );
}

export function ActiveHostInfo() {
  return (
    <OrganizerBadgeInfo type="active">
      Denne arrangør opretter løbende events på SoulEvents og bidrager aktivt til platformens fællesskab.
    </OrganizerBadgeInfo>
  );
}

export function ExperiencedHostInfo() {
  return (
    <OrganizerBadgeInfo type="experienced">
      Denne arrangør har gennemført flere events på SoulEvents og har erfaring med at skabe oplevelser med deltagere på platformen.
    </OrganizerBadgeInfo>
  );
}
