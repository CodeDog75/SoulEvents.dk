"use client";

import { useState } from "react";
import type { FeedbackQuestionType } from "@/lib/feedback";
import type { Json } from "@/types/database";

type FeedbackQuestionRowData = {
  id?: string | null;
  is_required?: boolean | null;
  options?: Json | null;
  question_text?: string | null;
  question_type?: FeedbackQuestionType | null;
  rating_comment_enabled?: boolean | null;
};

type FeedbackQuestionRowProps = {
  index: number;
  question: FeedbackQuestionRowData | null;
};

function formatOptions(options: Json | null | undefined) {
  if (!Array.isArray(options)) return "";
  return options.map((option) => String(option)).join("\n");
}

export function FeedbackQuestionRow({ index, question }: FeedbackQuestionRowProps) {
  const [questionType, setQuestionType] = useState<FeedbackQuestionType>(question?.question_type ?? "free_text");
  const isMultipleChoice = questionType === "multiple_choice";

  return (
    <fieldset className="rounded-[18px] border border-midnight/10 bg-white p-4">
      <input name={`question_id_${index}`} type="hidden" value={question?.id ?? ""} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_14rem]">
        <label className="grid gap-2 text-sm font-semibold text-midnight">
          Spørgsmål {index + 1}
          <input
            className="min-h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-[#7A4EAB]"
            defaultValue={question?.question_text ?? ""}
            maxLength={260}
            name={`question_text_${index}`}
            placeholder={index === 0 ? "Hvordan oplevede du SoulEvents?" : "Skriv spørgsmål"}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-midnight">
          Type
          <select
            className="min-h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-[#7A4EAB]"
            name={`question_type_${index}`}
            onChange={(event) => setQuestionType(event.target.value as FeedbackQuestionType)}
            value={questionType}
          >
            <option value="rating">Vurdering 1-10</option>
            <option value="free_text">Fritekst</option>
            <option value="yes_no">Ja / Nej</option>
            <option value="multiple_choice">Valgmuligheder</option>
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
        <label className="grid gap-2 text-sm font-semibold text-midnight">
          Valgmuligheder
          <textarea
            aria-disabled={!isMultipleChoice}
            className="min-h-20 rounded-md border border-midnight/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#7A4EAB] disabled:cursor-not-allowed disabled:bg-[#F4F0EA] disabled:text-ink/45"
            defaultValue={formatOptions(question?.options)}
            disabled={!isMultipleChoice}
            name={`question_options_${index}`}
            placeholder="Skriv én mulighed per linje"
          />
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-midnight/10 bg-[#FAF6EF] px-3 text-sm font-semibold text-midnight">
          <input className="size-4 accent-[#7A4EAB]" defaultChecked={question?.is_required ?? true} name={`question_required_${index}`} type="checkbox" />
          Obligatorisk
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-midnight/10 bg-[#FAF6EF] px-3 text-sm font-semibold text-midnight">
          <input className="size-4 accent-[#7A4EAB]" defaultChecked={question?.rating_comment_enabled ?? false} name={`question_rating_comment_${index}`} type="checkbox" />
          Kommentar ved vurdering
        </label>
      </div>
    </fieldset>
  );
}
