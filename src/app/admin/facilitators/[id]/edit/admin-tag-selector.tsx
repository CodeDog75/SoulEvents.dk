"use client";

import { useMemo, useState } from "react";

type Tag = {
  id: string;
  name: string;
};

type AdminTagSelectorProps = {
  selectedTagIds: string[];
  tags: Tag[];
};

export function AdminTagSelector({ selectedTagIds, tags }: AdminTagSelectorProps) {
  const initialSelected = useMemo(() => selectedTagIds.slice(0, 5), [selectedTagIds]);
  const [selected, setSelected] = useState(initialSelected);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-midnight">Tags</h3>
        <p className={selected.length > 5 || selected.length < 1 ? "text-sm font-semibold text-terracotta" : "text-sm text-ink/60"}>
          {selected.length}/5 valgt
        </p>
      </div>
      <p className="mt-2 text-sm leading-6 text-ink/64">Vælg mindst ét tag og højst fem tags.</p>
      <div className="mt-3 grid gap-2">
        {tags.map((tag) => {
          const checked = selected.includes(tag.id);
          const disabled = !checked && selected.length >= 5;

          return (
            <label
              className={
                "flex items-center gap-3 rounded-md border p-3 text-sm font-medium transition " +
                (disabled ? "border-midnight/10 bg-sage-50 text-ink/35" : "border-midnight/10 text-ink/75")
              }
              key={tag.id}
            >
              <input
                className="size-4 accent-sage-700"
                checked={checked}
                disabled={disabled}
                name="tag_ids"
                onChange={(event) => {
                  setSelected((current) =>
                    event.target.checked ? [...current, tag.id].slice(0, 5) : current.filter((tagId) => tagId !== tag.id),
                  );
                }}
                type="checkbox"
                value={tag.id}
              />
              {tag.name}
            </label>
          );
        })}
      </div>
    </div>
  );
}
