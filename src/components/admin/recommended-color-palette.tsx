"use client";

const recommendedColors = [
  { name: "Lavendel", value: "#7A4EAB" },
  { name: "Salvie", value: "#7F9466" },
  { name: "Støvet blå", value: "#6B7F9E" },
  { name: "Varm rosa", value: "#D8A7B1" },
  { name: "Terracotta", value: "#B86A4B" },
  { name: "Sand/guld", value: "#C9A66B" },
  { name: "Dyb grøn", value: "#4F5D4A" },
  { name: "Blød lilla", value: "#9B7BC7" },
];

function updateInput(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function RecommendedColorPalette() {
  return (
    <div className="mt-2 rounded-md border border-midnight/10 bg-[#FAF6EF] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Anbefalede farver</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {recommendedColors.map((color) => (
          <button
            aria-label={"Vælg " + color.name}
            className="inline-flex items-center gap-2 rounded-full border border-midnight/10 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink/70 shadow-sm transition hover:border-[#7A4EAB]/40 hover:text-[#7A4EAB]"
            key={color.value}
            onClick={(event) => {
              const form = event.currentTarget.closest("form");
              if (!form) return;

              const colorInput = form.querySelector<HTMLInputElement>('input[name="color_hex"][type="color"]');
              const textInput = form.querySelector<HTMLInputElement>('input[name="color_hex_text"]');
              const fallbackTextInput = form.querySelector<HTMLInputElement>('input[name="color_hex"]:not([type="color"])');

              if (colorInput) updateInput(colorInput, color.value);
              if (textInput) updateInput(textInput, color.value);
              if (fallbackTextInput) updateInput(fallbackTextInput, color.value);
            }}
            type="button"
          >
            <span className="size-4 rounded-full border border-midnight/10" style={{ backgroundColor: color.value }} />
            {color.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-ink/55">Vælg gerne en af disse, så tags og hovedkategorier holder samme rolige SoulEvents-udtryk.</p>
    </div>
  );
}
