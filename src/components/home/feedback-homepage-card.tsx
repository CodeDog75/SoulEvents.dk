"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Clock3, MessageCircleHeart, Sprout, X } from "lucide-react";
import { feedbackPublicPath, type FeedbackHomepageFrequency } from "@/lib/feedback";

type FeedbackHomepageCardProps = {
  frequency: FeedbackHomepageFrequency;
  introduction: string | null;
  title: string;
  token: string;
};

const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

export function FeedbackHomepageCard({ frequency, token }: FeedbackHomepageCardProps) {
  const storageKey = useMemo(() => `soulevents-feedback-card:${token}`, [token]);
  const visibilitySnapshot = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener("soulevents-feedback-card-change", onStoreChange);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener("soulevents-feedback-card-change", onStoreChange);
      };
    },
    () => {
      if (frequency === "every_visit") {
        return "visible";
      }

      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return "visible";
      }

      const lastClosedAt = Number(raw);
      if (!Number.isFinite(lastClosedAt)) {
        return "visible";
      }

      return frequency === "after_30_days" && Date.now() - lastClosedAt > thirtyDaysMs ? "visible" : "hidden";
    },
    () => "hidden",
  );

  if (visibilitySnapshot !== "visible") return null;

  const close = () => {
    window.localStorage.setItem(storageKey, String(Date.now()));
    window.dispatchEvent(new Event("soulevents-feedback-card-change"));
  };

  return (
    <section className="bg-[#FAF6EF] px-5 py-8 sm:px-8 sm:py-10" aria-label="Feedback til SoulEvents">
      <style>
        {`
          @keyframes souleventsFeedbackCtaPulse {
            0%, 100% {
              box-shadow: 0 18px 34px rgba(122, 78, 171, 0.18);
              transform: translateY(0) scale(1);
            }
            45% {
              box-shadow: 0 22px 42px rgba(122, 78, 171, 0.3);
              transform: translateY(-1px) scale(1.015);
            }
          }

          @media (prefers-reduced-motion: no-preference) {
            .soulevents-feedback-cta-pulse {
              animation: souleventsFeedbackCtaPulse 2600ms ease-out 700ms 1 both;
            }
          }
        `}
      </style>
      <div className="mx-auto max-w-[1200px]">
        <article className="soulevents-fade-in relative overflow-hidden rounded-[28px] border border-[#CFE2CC] bg-[#F0F7ED] p-6 shadow-soft sm:p-8 md:flex md:items-center md:justify-between md:gap-8">
          <button
            aria-label="Luk feedbackkort"
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/82 text-ink/60 transition hover:text-midnight"
            onClick={close}
            type="button"
          >
            <X className="size-4" aria-hidden="true" />
          </button>

          <div className="grid gap-5 pr-10 md:grid-cols-[4rem_minmax(0,1fr)] md:items-start">
            <span className="grid size-14 place-items-center rounded-full bg-white text-[#4F654A] shadow-soft">
              <MessageCircleHeart className="size-7" aria-hidden="true" />
            </span>
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/82 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#4F654A]">
                <Sprout className="size-4" aria-hidden="true" />
                Hjælp os
              </p>
              <h2 className="mt-4 font-serif text-3xl font-semibold leading-tight text-midnight sm:text-4xl">
                Har du 1 minut? 💚
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-ink/74">
                SoulEvents er helt ny, og vi vil meget gerne høre din mening. Besvar 3 korte spørgsmål og hjælp os
                med at skabe en endnu bedre oplevelse for både besøgende og arrangører.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink/58">
                <Clock3 className="size-4 text-[#4F654A]" aria-hidden="true" />
                Kun 3 spørgsmål · ca. 1 minut
              </p>
            </div>
          </div>

          <Link
            className="soulevents-feedback-cta-pulse mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#7A4EAB] px-7 text-base font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6B429D] md:mt-0 md:w-auto"
            href={`${feedbackPublicPath(token)}?source=homepage`}
          >
            Ja, jeg vil gerne hjælpe
          </Link>
        </article>
      </div>
    </section>
  );
}
