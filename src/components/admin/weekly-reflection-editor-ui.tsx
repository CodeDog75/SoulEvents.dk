"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";

type WeeklyReflectionBackgroundFieldsProps = {
  currentBackground: string;
  gradientOptions: Array<{ label: string; value: string }>;
  usesGradient: boolean;
};

type WeeklyReflectionLivePreviewProps = {
  author?: string | null;
  backgroundColor: string;
  imageAltText?: string | null;
  imageUrl?: string | null;
  reflectionText?: string | null;
  title?: string | null;
  usesGradient: boolean;
};

type PreviewState = {
  author: string;
  background: string;
  imageAltText: string;
  imageUrl: string | null;
  reflectionText: string;
  title: string;
};

const gradientBackgrounds: Record<string, string> = {
  "gradient:lavender-cream": "linear-gradient(135deg, #F1E8F8 0%, #FAF6EF 58%, #FFFDF8 100%)",
  "gradient:sage-sand": "linear-gradient(135deg, #EEF3EA 0%, #F6F1E7 54%, #D8C1A2 130%)",
  "gradient:dusty-purple-beige": "linear-gradient(135deg, #E9DFF1 0%, #FAF7F2 52%, #EFE4D6 100%)",
  "gradient:warm-grey-cream": "linear-gradient(135deg, #ECE8E1 0%, #FAF6EF 60%, #FFFDF8 100%)",
};

function resolveBackground(value: string) {
  return gradientBackgrounds[value] ?? value;
}

function getFormPreviewState(form: HTMLFormElement, fallback: PreviewState): PreviewState {
  const formData = new FormData(form);
  const backgroundMode = String(formData.get("background_mode") || "solid");
  const background =
    backgroundMode === "gradient"
      ? String(formData.get("background_gradient") || fallback.background)
      : String(formData.get("background_color") || fallback.background);
  const imageElement = form.querySelector<HTMLImageElement>("[data-weekly-reflection-image-preview]");

  return {
    author: String(formData.get("author") || ""),
    background,
    imageAltText: String(formData.get("reflection_image_alt_text") || fallback.imageAltText || "Illustration til ugens refleksion"),
    imageUrl: imageElement?.currentSrc || imageElement?.src || null,
    reflectionText: String(formData.get("reflection_text") || ""),
    title: String(formData.get("title") || "Ugens refleksion"),
  };
}

export function WeeklyReflectionBackgroundFields({ currentBackground, gradientOptions, usesGradient }: WeeklyReflectionBackgroundFieldsProps) {
  const [mode, setMode] = useState<"solid" | "gradient">(usesGradient ? "gradient" : "solid");

  return (
    <div className="grid gap-4">
      <div className="inline-grid w-full max-w-md grid-cols-2 rounded-full border border-lavender/35 bg-white p-1">
        <label className={"flex h-10 cursor-pointer items-center justify-center rounded-full text-sm font-semibold transition " + (mode === "solid" ? "bg-olive text-white shadow-soft" : "text-ink/65 hover:bg-[#FAF6EF]")}>
          <input
            checked={mode === "solid"}
            className="sr-only"
            name="background_mode"
            onChange={() => setMode("solid")}
            type="radio"
            value="solid"
          />
          Ensfarvet
        </label>
        <label className={"flex h-10 cursor-pointer items-center justify-center rounded-full text-sm font-semibold transition " + (mode === "gradient" ? "bg-olive text-white shadow-soft" : "text-ink/65 hover:bg-[#FAF6EF]")}>
          <input
            checked={mode === "gradient"}
            className="sr-only"
            name="background_mode"
            onChange={() => setMode("gradient")}
            type="radio"
            value="gradient"
          />
          Gradient
        </label>
      </div>

      {mode === "solid" ? (
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Ensfarvet baggrund
          <input
            className="h-11 w-full max-w-xs rounded-md border border-midnight/15 px-2 py-1 outline-none transition focus:border-sage-700"
            defaultValue={usesGradient ? "#FAF6EF" : currentBackground}
            name="background_color"
            type="color"
          />
        </label>
      ) : (
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Diskret gradient
          <select
            className="h-11 w-full max-w-md rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={usesGradient ? currentBackground : "gradient:lavender-cream"}
            name="background_gradient"
          >
            {gradientOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export function WeeklyReflectionLivePreview({
  author,
  backgroundColor,
  imageAltText,
  imageUrl,
  reflectionText,
  title,
  usesGradient,
}: WeeklyReflectionLivePreviewProps) {
  const fallback: PreviewState = useMemo(
    () => ({
      author: author ?? "",
      background: backgroundColor,
      imageAltText: imageAltText || "Illustration til ugens refleksion",
      imageUrl: imageUrl ?? null,
      reflectionText: reflectionText ?? "",
      title: title || "Ugens refleksion",
    }),
    [author, backgroundColor, imageAltText, imageUrl, reflectionText, title],
  );
  const [preview, setPreview] = useState(fallback);

  useEffect(() => {
    const form = document.getElementById("weekly-reflection-form") as HTMLFormElement | null;
    if (!form) return;

    const update = () => setPreview(getFormPreviewState(form, fallback));
    const updateImage = (event: Event) => {
      const detail = (event as CustomEvent<{ imageUrl: string | null }>).detail;
      setPreview((current) => ({ ...getFormPreviewState(form, current), imageUrl: detail?.imageUrl ?? null }));
    };

    form.addEventListener("input", update);
    form.addEventListener("change", update);
    window.addEventListener("weekly-reflection-image-preview-change", updateImage);
    update();

    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
      window.removeEventListener("weekly-reflection-image-preview-change", updateImage);
    };
  }, [fallback, imageUrl]);

  return (
    <aside className="rounded-[24px] border border-midnight/10 bg-white p-4 shadow-soft lg:sticky lg:top-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-midnight">Forhåndsvisning</h3>
        <p className="mt-1 text-xs leading-5 text-ink/55">Den endelige visning tilpasses automatisk til mobil og desktop.</p>
      </div>
      <div
        className="overflow-hidden rounded-[22px] border border-white/80 p-5 shadow-[0_18px_44px_rgba(47,38,51,0.08)]"
        style={{ background: resolveBackground(preview.background || (usesGradient ? "gradient:lavender-cream" : "#FAF6EF")) }}
      >
        {preview.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={preview.imageAltText} className="mb-5 aspect-[4/3] w-full rounded-[16px] object-cover shadow-soft" src={preview.imageUrl} />
        )}
        <p className="inline-flex rounded-full bg-white/82 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#7A4EAB] shadow-soft">
          🌿 {preview.title || "Ugens refleksion"}
        </p>
        {preview.reflectionText.trim() ? (
          <p className="mt-5 whitespace-pre-line font-serif text-xl font-medium leading-snug text-[#2F2633]">{preview.reflectionText.trim()}</p>
        ) : (
          <p className="mt-5 font-serif text-xl font-medium leading-snug text-[#2F2633]/45">Din refleksion vises her...</p>
        )}
        {preview.author && <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#2F2633]/58">- {preview.author}</p>}
      </div>
    </aside>
  );
}

export function WeeklyReflectionStatusSwitch({ defaultChecked, isExpired }: { defaultChecked: boolean; isExpired: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <label className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-midnight/10 bg-[#FAF6EF] px-4 py-3">
      <span>
        <span className="block text-sm font-semibold text-midnight">Refleksionen er aktiv</span>
        <span className={"mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold " + (isExpired ? "bg-stone-100 text-stone-600" : checked ? "bg-sage-50 text-sage-700" : "bg-white text-ink/55")}>
          {isExpired ? "Udløbet" : checked ? "Aktiv" : "Ikke aktiv"}
        </span>
      </span>
      <span className={"relative inline-flex h-8 w-14 items-center rounded-full transition " + (checked ? "bg-sage-700" : "bg-stone-300")}>
        <input
          checked={checked}
          className="sr-only"
          name="is_active"
          onChange={(event: ChangeEvent<HTMLInputElement>) => setChecked(event.currentTarget.checked)}
          type="checkbox"
        />
        <span className={"size-6 rounded-full bg-white shadow-soft transition " + (checked ? "translate-x-7" : "translate-x-1")} />
      </span>
    </label>
  );
}

export function WeeklyReflectionSubmitButton() {
  const { pending } = useFormStatus();
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const form = document.getElementById("weekly-reflection-form");
    if (!form) return;

    const markDirty = () => setIsDirty(true);
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    window.addEventListener("weekly-reflection-image-preview-change", markDirty);

    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      window.removeEventListener("weekly-reflection-image-preview-change", markDirty);
    };
  }, []);

  return (
    <div className="grid gap-2">
      {isDirty && !pending && <p className="text-sm font-semibold text-[#7A5D3A]">Du har ændringer, der ikke er gemt.</p>}
      <button
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-button bg-olive px-6 text-base font-semibold text-white shadow-soft transition hover:bg-sage-700 disabled:cursor-wait disabled:opacity-70 sm:w-fit"
        disabled={pending}
        type="submit"
      >
        <Save className="size-4" aria-hidden="true" />
        {pending ? "Gemmer..." : "Gem refleksion"}
      </button>
    </div>
  );
}
