/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from "react";
import { MapPinned, UserRound } from "lucide-react";
import { OrganizerImageBadge, type OrganizerBadgeType } from "@/components/badges/organizer-badges";
import { SoulEventsIdTag } from "@/components/facilitator/soulevents-id-tag";

type Category = {
  colorHex?: string | null;
  name: string;
};

type ProfileIdentityHeaderProps = {
  actions?: ReactNode;
  badges?: OrganizerBadgeType[];
  categories: Category[];
  coverImage: {
    altText: string;
    isFallback: boolean;
    objectPositionDesktop?: string;
    objectPositionMobile?: string;
    url: string;
  };
  hostReferenceId?: string | null;
  name: string;
  place?: string | null;
  profileImageUrl?: string | null;
  specialty?: string | null;
  variant?: "full" | "compact";
};

export function ProfileIdentityHeader({
  actions,
  badges = [],
  categories,
  coverImage,
  hostReferenceId,
  name,
  place,
  profileImageUrl,
  specialty,
  variant = "full",
}: ProfileIdentityHeaderProps) {
  const specialtyText = specialty?.trim() ?? "";
  const compactHeader = (
    <div className="overflow-hidden rounded-[26px] bg-[#FAF7F2] shadow-[0_20px_54px_rgba(47,36,55,0.12)]">
      <div className="relative h-[170px] overflow-hidden bg-[#2F2437] sm:h-[190px]">
        <img
          alt={coverImage.altText}
          className="absolute inset-0 h-full w-full animate-[souleventsFadeIn_.55s_ease-out] object-cover brightness-[0.78] contrast-[0.96] saturate-[0.92]"
          src={coverImage.url}
          style={{ objectPosition: coverImage.objectPositionMobile ?? coverImage.objectPositionDesktop ?? "center center" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(47,36,55,0.08)_0%,rgba(47,36,55,0.22)_100%)]" />
      </div>

      <div className="relative px-5 pb-7 pt-0 sm:px-6">
        <div className="relative -mt-[72px] aspect-[4/5] w-[170px] overflow-hidden rounded-[23px] bg-[#F4F0F7] shadow-[0_18px_44px_rgba(20,16,22,0.22)] ring-[4px] ring-[#FAF7F2] sm:w-[190px]">
          {badges.includes("experienced") ? (
            <OrganizerImageBadge type="experienced" />
          ) : badges.includes("active") ? (
            <OrganizerImageBadge type="active" />
          ) : null}
          {profileImageUrl ? (
            <img alt={name} className="h-full w-full object-cover" src={profileImageUrl} />
          ) : (
            <div className="grid h-full place-items-center text-[#7A5D91]">
              <UserRound className="size-14" aria-hidden="true" />
            </div>
          )}
        </div>
        {place ? (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-2 rounded-full bg-[#F1EAF5] px-3 py-1.5 text-sm font-semibold text-[#6E6475]">
              <MapPinned className="size-4 text-[#7A5D91]" aria-hidden="true" />
              {place}
            </p>
            <SoulEventsIdTag hostReferenceId={hostReferenceId} />
          </div>
        ) : hostReferenceId ? (
          <div className="mt-6">
            <SoulEventsIdTag hostReferenceId={hostReferenceId} />
          </div>
        ) : null}
        <h2 className="mt-4 break-words font-serif text-4xl font-semibold leading-[0.98] text-[#2F2437] sm:text-5xl">{name}</h2>
        {categories.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((category) => (
              <span className="rounded-full bg-[#EDF3EA] px-3 py-1 text-[11px] font-semibold text-[#4F6849]" key={category.name}>
                {category.name}
              </span>
            ))}
          </div>
        ) : null}
        {specialtyText ? (
          <div className="mt-5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A5D91]">Mit speciale</span>
            <p className="mt-1 whitespace-normal break-words text-base font-semibold leading-6 text-[#5E5662] [overflow-wrap:anywhere]">
              {specialtyText}
            </p>
          </div>
        ) : null}
        {actions ? <div className="mt-6">{actions}</div> : null}
      </div>
    </div>
  );

  if (variant === "compact") {
    return compactHeader;
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-[30px] bg-[#FAF7F2] shadow-[0_26px_70px_rgba(47,36,55,0.14)] lg:block">
        <div className="relative h-[285px] overflow-hidden bg-[#2F2437]">
          <img
            alt={coverImage.altText}
            className="absolute inset-0 h-full w-full animate-[souleventsFadeIn_.55s_ease-out] object-cover brightness-[0.78] contrast-[0.96] saturate-[0.92]"
            src={coverImage.url}
            style={{ objectPosition: coverImage.objectPositionDesktop ?? "center center" }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(44,51,35,0.16)_0%,rgba(69,56,82,0.1)_48%,rgba(47,36,55,0.16)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(47,36,55,0.06)_0%,rgba(47,36,55,0.18)_100%)]" />
        </div>

        <div className="relative px-12 pb-12 pt-0 xl:px-16">
          <div className="grid grid-cols-[340px_minmax(0,1fr)] gap-8">
            <div className="relative -mt-[132px]">
              <div className="relative aspect-[4/5] w-[340px] overflow-hidden rounded-[26px] bg-[#F4F0F7] shadow-[0_24px_62px_rgba(20,16,22,0.26)] ring-[5px] ring-[#FAF7F2]">
                {badges.includes("experienced") ? (
                  <OrganizerImageBadge type="experienced" />
                ) : badges.includes("active") ? (
                  <OrganizerImageBadge type="active" />
                ) : null}
                {profileImageUrl ? (
                  <img alt={name} className="h-full w-full object-cover" src={profileImageUrl} />
                ) : (
                  <div className="grid h-full place-items-center text-[#7A5D91]">
                    <UserRound className="size-24" aria-hidden="true" />
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 pt-9">
              {place ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#F1EAF5] px-3.5 py-1.5 text-xs font-semibold text-[#6E6475]">
                    <MapPinned className="size-3.5 text-[#7A5D91]" aria-hidden="true" />
                    {place}
                  </div>
                  <SoulEventsIdTag hostReferenceId={hostReferenceId} />
                </div>
              ) : hostReferenceId ? (
                <SoulEventsIdTag hostReferenceId={hostReferenceId} />
              ) : null}
              <h1 className="mt-5 max-w-5xl break-words font-serif text-6xl font-semibold leading-[0.98] tracking-normal text-[#2F2437] xl:text-7xl">
                {name}
              </h1>

              {categories.length > 0 ? (
                <div className="mt-5 flex max-w-3xl flex-wrap gap-2">
                  {categories.map((category) => (
                    <span className="rounded-full bg-[#EDF3EA] px-3 py-1 text-[11px] font-semibold text-[#4F6849]" key={category.name}>
                      {category.name}
                    </span>
                  ))}
                </div>
              ) : null}

              {specialtyText ? (
                <div className="mt-6 max-w-2xl">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A5D91]">Mit speciale</span>
                  <p className="mt-1 whitespace-normal break-words text-lg font-semibold leading-7 text-[#5E5662] [overflow-wrap:anywhere]">
                    {specialtyText}
                  </p>
                </div>
              ) : null}

              {actions ? <div className="mt-7">{actions}</div> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden">{compactHeader}</div>
    </>
  );
}
