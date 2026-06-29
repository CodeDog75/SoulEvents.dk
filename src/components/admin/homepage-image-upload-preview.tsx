"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { ReactNode } from "react";

type HomepageImageUploadPreviewProps = {
  imageUrl?: string | null;
  imagePath?: string | null;
  inputName?: string;
  label?: string;
  helpText?: string;
  previewAspectClassName?: string;
  children?: ReactNode;
};

export function HomepageImageUploadPreview({
  imageUrl,
  imagePath,
  inputName = "image_file",
  label = "Upload billede",
  helpText = "Anbefalet: kvadratisk billede. JPG, PNG eller WebP under 8 MB.",
  previewAspectClassName = "aspect-square",
  children,
}: HomepageImageUploadPreviewProps) {
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const previewUrl = selectedPreviewUrl ?? imageUrl ?? null;

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const previewLabel = useMemo(() => {
    if (selectedPreviewUrl) return "Nyt billede valgt";
    if (imagePath) return "Nuværende billede";
    return "Intet billede valgt";
  }, [imagePath, selectedPreviewUrl]);

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-md border border-midnight/10 bg-sage-50">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className={previewAspectClassName + " w-full object-cover"} src={previewUrl} />
        ) : (
          <div className={"grid " + previewAspectClassName + " place-items-center text-sage-700"}>
            <ImagePlus className="size-10" aria-hidden="true" />
          </div>
        )}
      </div>

      <p className="text-xs font-semibold text-ink/55">{previewLabel}</p>

      {children}

      <label className="grid gap-2 text-sm font-medium text-ink/72">
        {label}
        <input
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-sage-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sage-700"
          name={inputName}
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (!file) {
              setObjectUrl(null);
              setSelectedPreviewUrl(null);
              return;
            }
            const nextObjectUrl = URL.createObjectURL(file);
            setObjectUrl(nextObjectUrl);
            setSelectedPreviewUrl(nextObjectUrl);
          }}
        />
        <span className="text-xs leading-5 text-ink/55">{helpText}</span>
      </label>
    </div>
  );
}
