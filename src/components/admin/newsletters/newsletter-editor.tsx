"use client";

import { ArrowDown, ArrowUp, ImagePlus, Monitor, Plus, Smartphone, Trash2, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createSignedNewsletterImageUploadAction, getNewsletterRecipientSummary } from "@/app/admin/newsletters/actions";
import {
  maxNewsletterImageFileSize,
  maxNewsletterSections,
  newsletterImageUploadAccept,
  newsletterTargetSegmentLabel,
  type NewsletterImageFocus,
  type NewsletterImageLayout,
  type NewsletterSectionInput,
  type NewsletterTargetSegment,
} from "@/lib/newsletters/facilitator-newsletter";
import { prepareImageFileForUpload } from "@/lib/images/client-image-upload";
import { publicMediaUrl } from "@/lib/media/public-url";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/browser";

type NewsletterEditorProps = {
  initialPreheader?: string | null;
  initialSections: NewsletterSectionInput[];
  initialSubject?: string | null;
  initialTargetSegment: NewsletterTargetSegment;
  newsletterId?: string | null;
};

type RecipientSummary = {
  matching: number;
  optedOut: number;
  sendable: number;
};

const emptySection = (): NewsletterSectionInput => ({
  body: "",
  buttonLabel: "",
  buttonUrl: "",
  heading: "",
  imageFocus: "center",
  imageLayout: "wide",
  imagePath: "",
});

const emailWideImageSize = { height: 675, width: 1200 };
const emailSquareImageSize = { height: 900, width: 900 };

function sectionImageUrl(path: string) {
  return publicMediaUrl(path) ?? "";
}

function imageBoxClass(layout: NewsletterImageLayout) {
  if (layout === "square") return "aspect-square";
  return "aspect-video";
}

function focusClass(focus: NewsletterImageFocus) {
  if (focus === "top") return "object-top";
  if (focus === "bottom") return "object-bottom";
  if (focus === "left") return "object-left";
  if (focus === "right") return "object-right";
  return "object-center";
}

function replaceFileExtension(fileName: string, extension: string) {
  return fileName.includes(".") ? fileName.replace(/\.[^.]+$/, `.${extension}`) : `${fileName}.${extension}`;
}

function loadImageFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Billedet kunne ikke beskæres. Prøv et andet billede."));
    };
    image.src = objectUrl;
  });
}

function cropOffset(extra: number, focus: NewsletterImageFocus, axis: "x" | "y") {
  if (axis === "x") {
    if (focus === "left") return 0;
    if (focus === "right") return extra;
  }

  if (axis === "y") {
    if (focus === "top") return 0;
    if (focus === "bottom") return extra;
  }

  return extra / 2;
}

async function prepareEmailImageVariant(file: File, layout: NewsletterImageLayout, focus: NewsletterImageFocus) {
  const target = layout === "square" ? emailSquareImageSize : emailWideImageSize;
  const image = await loadImageFile(file);
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = target.width / target.height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = cropOffset(image.naturalWidth - sourceWidth, focus, "x");
  } else if (sourceRatio < targetRatio) {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = cropOffset(image.naturalHeight - sourceHeight, focus, "y");
  }

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Billedet kunne ikke beskæres. Prøv et andet billede.");
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, target.width, target.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
  if (!blob) {
    throw new Error("Billedet kunne ikke beskæres. Prøv et andet billede.");
  }

  return new File([blob], replaceFileExtension(file.name, "jpg"), { type: "image/jpeg" });
}

export function NewsletterEditor({
  initialPreheader = "",
  initialSections,
  initialSubject = "",
  initialTargetSegment,
  newsletterId,
}: NewsletterEditorProps) {
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [preheader, setPreheader] = useState(initialPreheader ?? "");
  const [targetSegment, setTargetSegment] = useState<NewsletterTargetSegment>(initialTargetSegment);
  const [sections, setSections] = useState<NewsletterSectionInput[]>(
    initialSections.length
      ? initialSections.map((section) => ({
          ...section,
          imageLayout: section.imagePath && section.imageLayout !== "none" ? section.imageLayout : "wide",
        }))
      : [emptySection()],
  );
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [uploadingSection, setUploadingSection] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [summary, setSummary] = useState<RecipientSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const sectionsJson = useMemo(() => JSON.stringify(sections), [sections]);

  useEffect(() => {
    startTransition(() => {
      getNewsletterRecipientSummary(targetSegment)
        .then(setSummary)
        .catch(() => setSummary(null));
    });
  }, [targetSegment]);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return undefined;

    function handleSubmit(event: SubmitEvent) {
      if (uploadingSection !== null) {
        event.preventDefault();
        setUploadError("Vent til billedet er uploadet, før du gemmer.");
      }
    }

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [uploadingSection]);

  function updateSection(index: number, patch: Partial<NewsletterSectionInput>) {
    setSections((current) => current.map((section, sectionIndex) => (sectionIndex === index ? { ...section, ...patch } : section)));
  }

  function addSection() {
    setSections((current) => current.length >= maxNewsletterSections ? current : [...current, emptySection()]);
  }

  function removeSection(index: number) {
    setSections((current) => current.filter((_, sectionIndex) => sectionIndex !== index));
  }

  function moveSection(index: number, direction: -1 | 1) {
    setSections((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function uploadImage(index: number, event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];
    if (!selectedFile) return;

    setUploadError("");
    setUploadingSection(index);

    try {
      const preparedFile = await prepareImageFileForUpload(selectedFile, {
        maxDimension: 1400,
        maxFileSizeBytes: maxNewsletterImageFileSize,
      });
      const imageLayout = sections[index]?.imageLayout === "square" ? "square" : "wide";
      const imageFocus = sections[index]?.imageFocus ?? "center";
      const file = await prepareEmailImageVariant(preparedFile, imageLayout, imageFocus);

      if (file.size > maxNewsletterImageFileSize) {
        throw new Error("Billedet er for stort efter beskæring. Vælg et lettere billede.");
      }

      const signedUpload = await createSignedNewsletterImageUploadAction({
        contentType: file.type,
        fileName: file.name,
        size: file.size,
      });

      if (signedUpload.error || !signedUpload.path || !signedUpload.token) {
        throw new Error(signedUpload.error || "Upload kunne ikke startes.");
      }

      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.storage.from("media").uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
        cacheControl: "31536000",
        contentType: signedUpload.contentType ?? file.type,
      });

      if (error) {
        throw new Error("Upload til medielager fejlede: " + error.message);
      }

      updateSection(index, {
        imageLayout,
        imageFocus,
        imagePath: signedUpload.path,
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Billedet kunne ikke uploades.");
    } finally {
      input.value = "";
      setUploadingSection(null);
    }
  }

  return (
    <div className="grid gap-6" ref={rootRef}>
      <input name="newsletter_id" type="hidden" value={newsletterId ?? ""} />
      <input name="sections_json" type="hidden" value={sectionsJson} />

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage-700">Kladde</p>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Emnelinje
            <input
              className="h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-sage-700"
              maxLength={180}
              name="subject"
              onChange={(event) => setSubject(event.currentTarget.value)}
              required
              value={subject}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Preheader
            <input
              className="h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-sage-700"
              maxLength={220}
              name="preheader"
              onChange={(event) => setPreheader(event.currentTarget.value)}
              placeholder="Kort tekst, der vises efter emnelinjen i indbakken"
              value={preheader}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Modtagere
            <select
              className="h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-sage-700"
              name="target_segment"
              onChange={(event) => setTargetSegment(event.currentTarget.value as NewsletterTargetSegment)}
              value={targetSegment}
            >
              <option value="all">Alle arrangører</option>
              <option value="active">Aktive arrangører</option>
              <option value="paused">Arrangører på pause</option>
              <option value="onboarding">Arrangører under oprettelse</option>
            </select>
          </label>
          <div className="rounded-[20px] border border-[#D8CBE4] bg-[#F7F2FB] p-4 text-sm leading-6 text-ink/72">
            <p className="font-semibold text-midnight">{newsletterTargetSegmentLabel(targetSegment)}</p>
            {summary ? (
              <>
                <p>{summary.matching} arrangører fundet.</p>
                <p>{summary.optedOut} har fravalgt nyhedsmails.</p>
                <p className="font-semibold text-sage-700">Mailen sendes til {summary.sendable} modtagere.</p>
              </>
            ) : (
              <p>{isPending ? "Tæller modtagere..." : "Modtagerantal kunne ikke hentes."}</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage-700">Afsnit</p>
            <h2 className="mt-1 text-xl font-semibold text-midnight">Byg mailen</h2>
          </div>
          <button className="inline-flex h-10 items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white" onClick={addSection} type="button">
            <Plus className="size-4" aria-hidden="true" />
            Tilføj afsnit
          </button>
        </div>

        <div className="mt-5 grid gap-5">
          {sections.map((section, index) => (
            <article className="rounded-[24px] border border-[#E5DDEA] bg-[#FAF8FC] p-4" key={index}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-midnight">Afsnit {index + 1}</p>
                <div className="flex gap-1">
                  <button className="grid size-9 place-items-center rounded-full bg-white text-[#4F4756] disabled:opacity-35" disabled={index === 0} onClick={() => moveSection(index, -1)} type="button">
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button className="grid size-9 place-items-center rounded-full bg-white text-[#4F4756] disabled:opacity-35" disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)} type="button">
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                  <button className="grid size-9 place-items-center rounded-full bg-white text-red-700" onClick={() => removeSection(index)} type="button">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="grid gap-3">
                  <input
                    className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-sm outline-none transition focus:border-sage-700"
                    onChange={(event) => updateSection(index, { heading: event.currentTarget.value })}
                    placeholder="Overskrift"
                    value={section.heading}
                  />
                  <textarea
                    className="min-h-36 rounded-md border border-midnight/15 bg-white p-3 text-sm leading-6 outline-none transition focus:border-sage-700"
                    onChange={(event) => updateSection(index, { body: event.currentTarget.value })}
                    placeholder="Brødtekst"
                    value={section.body}
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-sm outline-none transition focus:border-sage-700"
                      onChange={(event) => updateSection(index, { buttonLabel: event.currentTarget.value })}
                      placeholder="Knaptekst (valgfrit)"
                      value={section.buttonLabel}
                    />
                    <input
                      className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-sm outline-none transition focus:border-sage-700"
                      onChange={(event) => updateSection(index, { buttonUrl: event.currentTarget.value })}
                      placeholder="Knaplink (valgfrit)"
                      type="url"
                      value={section.buttonUrl}
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className={`relative overflow-hidden rounded-[22px] border border-dashed border-[#D8CBE4] bg-white ${imageBoxClass(section.imageLayout)}`}>
                    {section.imagePath ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" className={`h-full w-full object-cover ${focusClass(section.imageFocus)}`} src={sectionImageUrl(section.imagePath)} />
                        <button
                          className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white text-red-700 shadow-soft"
                          onClick={() => updateSection(index, { imageLayout: "none", imagePath: "" })}
                          type="button"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <label className="grid h-full cursor-pointer place-items-center text-[#7A5D91]">
                        <span className="grid size-14 place-items-center rounded-[18px] bg-[#F7F2FB]">
                          <ImagePlus className="size-6" aria-hidden="true" />
                        </span>
                        <input accept={newsletterImageUploadAccept} className="sr-only" onChange={(event) => void uploadImage(index, event)} type="file" />
                      </label>
                    )}
                    {uploadingSection === index ? <span className="absolute inset-x-3 top-3 rounded-full bg-white px-3 py-1 text-center text-xs font-semibold text-[#7A5D91] shadow-soft">Uploader...</span> : null}
                  </div>
                  <div className="grid gap-2 text-xs font-semibold text-ink/64">
                    <select
                      className="h-10 rounded-md border border-midnight/15 bg-white px-3"
                      disabled={Boolean(section.imagePath)}
                      onChange={(event) => updateSection(index, { imageLayout: event.currentTarget.value as NewsletterImageLayout })}
                      value={section.imageLayout}
                    >
                      <option value="wide">Bredt billede</option>
                      <option value="square">Kvadratisk billede 1:1</option>
                    </select>
                    <select
                      className="h-10 rounded-md border border-midnight/15 bg-white px-3"
                      disabled={Boolean(section.imagePath)}
                      onChange={(event) => updateSection(index, { imageFocus: event.currentTarget.value as NewsletterImageFocus })}
                      value={section.imageFocus}
                    >
                      <option value="center">Beskæring: centrum</option>
                      <option value="top">Beskæring: top</option>
                      <option value="bottom">Beskæring: bund</option>
                      <option value="left">Beskæring: venstre</option>
                      <option value="right">Beskæring: højre</option>
                    </select>
                    {section.imagePath ? <p className="text-[11px] leading-5 text-ink/50">Format og beskæring er indbygget i mailbilledet. Udskift billedet for at ændre udsnit.</p> : null}
                    {section.imagePath ? (
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-midnight/15 bg-white px-3 text-[#4F4756]">
                        Udskift billede
                        <input accept={newsletterImageUploadAccept} className="sr-only" onChange={(event) => void uploadImage(index, event)} type="file" />
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {uploadError ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">{uploadError}</p> : null}
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage-700">Forhåndsvisning</p>
            <h2 className="mt-1 text-xl font-semibold text-midnight">Sådan lander mailen</h2>
          </div>
          <div className="flex rounded-full bg-[#F4F0F7] p-1">
            <button className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold ${previewMode === "desktop" ? "bg-white text-midnight shadow-soft" : "text-ink/58"}`} onClick={() => setPreviewMode("desktop")} type="button">
              <Monitor className="size-4" aria-hidden="true" />
              Computer
            </button>
            <button className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold ${previewMode === "mobile" ? "bg-white text-midnight shadow-soft" : "text-ink/58"}`} onClick={() => setPreviewMode("mobile")} type="button">
              <Smartphone className="size-4" aria-hidden="true" />
              Mobil
            </button>
          </div>
        </div>
        <div className={`mx-auto mt-5 overflow-hidden rounded-[28px] border border-[#E5DDEA] bg-[#FAF6EF] p-3 ${previewMode === "mobile" ? "max-w-sm" : "max-w-3xl"}`}>
          <div className="rounded-[24px] bg-white">
            <div className="rounded-t-[24px] bg-gradient-to-br from-[#4B5645] to-[#7A4EAB] p-6 text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="SoulEvents.dk" className="mb-4 size-[72px] object-contain" src="/brand/soulevents-logo.png" />
              <h3 className="mt-2 font-serif text-3xl font-semibold leading-tight">{subject || "Nyhed fra SoulEvents"}</h3>
              {preheader ? <p className="mt-3 text-sm leading-6 text-white/82">{preheader}</p> : null}
            </div>
            <div className="grid gap-7 p-6">
              {sections.map((section, index) => (
                <article key={index}>
                  {section.imagePath && section.imageLayout !== "none" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className={`mb-5 w-full rounded-[22px] object-cover ${imageBoxClass(section.imageLayout)} ${focusClass(section.imageFocus)}`} src={sectionImageUrl(section.imagePath)} />
                  ) : null}
                  {section.heading ? <h4 className="font-serif text-2xl font-semibold text-midnight">{section.heading}</h4> : null}
                  {section.body ? <p className="mt-2 whitespace-pre-line text-sm leading-7 text-ink/72">{section.body}</p> : null}
                  {section.buttonLabel && section.buttonUrl ? <span className="mt-4 inline-flex h-11 items-center rounded-full bg-[#7A4EAB] px-5 text-sm font-semibold text-white">{section.buttonLabel}</span> : null}
                </article>
              ))}
            </div>
            <div className="rounded-b-[24px] bg-[#F4F0F7] p-5 text-xs leading-5 text-ink/58">
              SoulEvents.dk · Afmeldingslink vises i rigtige udsendelser.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
