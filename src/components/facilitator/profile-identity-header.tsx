/* eslint-disable @next/next/no-img-element */

import { MapPinned, UserRound } from "lucide-react";
import { OrganizerImageBadge, type OrganizerBadgeType } from "@/components/badges/organizer-badges";

type Category = {
  colorHex?: string | null;
  name: string;
};

type ProfileIdentityHeaderProps = {
  badges?: OrganizerBadgeType[];
  categories: Category[];
  coverImage: {
    altText: string;
    isFallback: boolean;
    objectPositionDesktop?: string;
    objectPositionMobile?: string;
    url: string;
  };
  name: string;
  place?: string | null;
  profileImageUrl?: string | null;
  specialties: string[];
};

export function ProfileIdentityHeader({
  badges = [],
  categories,
  coverImage,
  name,
  place,
  profileImageUrl,
  specialties,
}: ProfileIdentityHeaderProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-[30px] bg-[#FAF7F2] shadow-[0_26px_70px_rgba(47,36,55,0.14)] lg:block">
        <div className="relative h-[340px] overflow-hidden bg-[#2F2437]">
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
          <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-10">
            <div className="relative -mt-[118px]">
              <div className="relative aspect-[4/5] w-[300px] overflow-hidden rounded-[24px] bg-[#F4F0F7] shadow-[0_22px_58px_rgba(20,16,22,0.26)] ring-[5px] ring-[#FAF7F2]">
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

            <div className="min-w-0 pt-8">
              {place ? (
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#F1EAF5] px-3.5 py-1.5 text-xs font-semibold text-[#6E6475]">
                  <MapPinned className="size-3.5 text-[#7A5D91]" aria-hidden="true" />
                  {place}
                </div>
              ) : null}
              <h1 className="mt-5 max-w-5xl break-words font-serif text-6xl font-semibold leading-[0.98] tracking-normal text-[#2F2437] xl:text-7xl">
                {name}
              </h1>

              {specialties.length > 0 ? (
                <div className="mt-7 grid max-w-2xl gap-3">
                  {specialties.map((specialty) => (
                    <div className="rounded-[20px] bg-[#F1EAF5] px-4 py-3 text-sm font-semibold leading-6 text-[#2F2437]" key={specialty}>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A5D91]">Mit speciale</span>
                      <span className="mt-1 block break-words [overflow-wrap:anywhere]">{specialty}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {categories.length > 0 ? (
                <div className="mt-5 flex max-w-3xl flex-wrap gap-2.5">
                  {categories.map((category) => (
                    <span className="rounded-full bg-[#EDF3EA] px-3.5 py-1.5 text-xs font-semibold text-[#4F6849]" key={category.name}>
                      {category.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[26px] bg-[#FAF7F2] shadow-[0_20px_54px_rgba(47,36,55,0.12)] lg:hidden">
        <div className="relative h-[210px] overflow-hidden bg-[#2F2437] sm:h-[235px]">
          <img
            alt={coverImage.altText}
            className="absolute inset-0 h-full w-full animate-[souleventsFadeIn_.55s_ease-out] object-cover brightness-[0.78] contrast-[0.96] saturate-[0.92]"
            src={coverImage.url}
            style={{ objectPosition: coverImage.objectPositionMobile ?? "center center" }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(47,36,55,0.08)_0%,rgba(47,36,55,0.22)_100%)]" />
        </div>

        <div className="relative px-5 pb-7 pt-0 sm:px-7">
          <div className="-mt-16 aspect-[4/5] w-[150px] overflow-hidden rounded-[22px] bg-[#F4F0F7] shadow-[0_18px_44px_rgba(20,16,22,0.22)] ring-[4px] ring-[#FAF7F2] sm:w-[170px]">
            {profileImageUrl ? (
              <img alt={name} className="h-full w-full object-cover" src={profileImageUrl} />
            ) : (
              <div className="grid h-full place-items-center text-[#7A5D91]">
                <UserRound className="size-14" aria-hidden="true" />
              </div>
            )}
          </div>
          {place ? (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#F1EAF5] px-3 py-1.5 text-sm font-semibold text-[#6E6475]">
              <MapPinned className="size-4 text-[#7A5D91]" aria-hidden="true" />
              {place}
            </p>
          ) : null}
          <h1 className="mt-4 break-words font-serif text-5xl font-semibold leading-[0.98] text-[#2F2437] sm:text-6xl">{name}</h1>
          {specialties.length > 0 ? (
            <div className="mt-5 grid gap-3">
              {specialties.map((specialty) => (
                <div className="rounded-[18px] bg-[#F1EAF5] px-4 py-3 text-sm font-semibold leading-6 text-[#2F2437]" key={specialty}>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A5D91]">Mit speciale</span>
                  <span className="mt-1 block break-words [overflow-wrap:anywhere]">{specialty}</span>
                </div>
              ))}
            </div>
          ) : null}
          {categories.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2.5">
              {categories.map((category) => (
                <span className="rounded-full bg-[#EDF3EA] px-3.5 py-1.5 text-xs font-semibold text-[#4F6849]" key={category.name}>
                  {category.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
