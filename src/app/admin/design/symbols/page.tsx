/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Edit3, Eye, EyeOff, ImagePlus, Layers3, Trash2, Upload, ChevronDown, ChevronUp } from "lucide-react";
import {
  deleteDesignSymbolAction,
  reorderDesignSymbolAction,
  saveDesignSymbolAction,
  setDesignSymbolStatusAction,
} from "@/app/admin/design/symbols/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { designSymbolBackgroundColors } from "@/lib/design-symbols";
import { publicMediaUrl } from "@/lib/media/public-url";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminDesignSymbolsPageProps = {
  searchParams: Promise<{ edit?: string; message?: string }>;
};

const inputClass = "min-h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]";

function statusClass(active: boolean) {
  return active ? "bg-[#E8F3E4] text-[#4F654A]" : "bg-stone-100 text-stone-600";
}

function SymbolPreview({ backgroundColor, name, path }: { backgroundColor: string; name: string; path: string | null }) {
  const url = publicMediaUrl(path);

  return (
    <div className="grid gap-2">
      <div className="grid aspect-square place-items-center rounded-[22px] border border-midnight/10" style={{ backgroundColor }}>
        {url ? <img alt="" aria-hidden="true" className="size-12 text-sage-700" src={url} /> : <Layers3 className="size-10 text-sage-700" />}
      </div>
      <p className="truncate text-center text-xs font-semibold text-ink/60">{name}</p>
    </div>
  );
}

function SymbolForm({ symbol }: { symbol: any | null }) {
  return (
    <section className="rounded-[28px] border border-[#D8CBE4] bg-white p-5 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">
            {symbol ? "Rediger symbol" : "Upload nyt symbol"}
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-midnight">Upload SVG-symbol</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/64">
            SoulEvents bruger egne line-icons. For at sikre et ensartet udtryk skal alle symboler følge designstandarden.
          </p>
        </div>
        {symbol ? (
          <Link className="inline-flex min-h-10 items-center rounded-full border border-midnight/10 px-4 text-sm font-semibold text-midnight" href="/admin/design/symbols">
            Opret nyt symbol
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 rounded-[24px] border border-[#E5D4F7] bg-[#FAF6EF] p-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          "SVG-format",
          "Transparent baggrund",
          "Ét symbol pr. fil",
          "48×48 px canvas eller korrekt viewBox",
          "2 px stregtykkelse",
          "Runde ender og hjørner",
          "Ingen tekst",
          "Ingen skygger",
          "Ingen indbygget baggrund",
          "Monokromt ikon",
        ].map((requirement) => (
          <div className="flex items-center gap-2 text-sm font-semibold text-sage-700" key={requirement}>
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            {requirement}
          </div>
        ))}
      </div>

      <form action={saveDesignSymbolAction} className="mt-7 grid gap-5">
        <input name="id" type="hidden" value={symbol?.id ?? ""} />
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            SVG-fil
            <input
              accept=".svg,image/svg+xml"
              className="rounded-md border border-midnight/15 bg-white px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-[#7A4EAB] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-[#7A4EAB]"
              name="svg_file"
              required={!symbol}
              type="file"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Navn
            <input className={inputClass} defaultValue={symbol?.name ?? ""} maxLength={80} name="name" required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Slug
            <input className={inputClass} defaultValue={symbol?.slug ?? ""} maxLength={90} name="slug" placeholder="Genereres automatisk fra navnet" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Kategori
            <input className={inputClass} defaultValue={symbol?.category ?? "Generelt"} maxLength={80} name="category" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Baggrundsfarve
            <select className={inputClass} defaultValue={symbol?.background_color ?? "#EEF5EA"} name="background_color">
              {designSymbolBackgroundColors.map((color) => (
                <option key={color.value} value={color.value}>
                  {color.label} · {color.value}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Sorteringsrækkefølge
            <input className={inputClass} defaultValue={symbol?.sort_order ?? 0} name="sort_order" type="number" />
          </label>
        </div>

        <label className="flex min-h-12 items-center gap-3 rounded-[18px] border border-midnight/10 bg-[#FAF6EF] px-4 text-sm font-semibold text-midnight">
          <input className="size-4 accent-[#7A4EAB]" defaultChecked={symbol?.is_active ?? true} name="is_active" type="checkbox" />
          Aktivt symbol
        </label>

        <div className="grid gap-4 rounded-[24px] border border-midnight/10 bg-[#FFFDF8] p-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/50">Original SVG</p>
            <div className="mt-3 grid aspect-square max-w-48 place-items-center rounded-[20px] border border-dashed border-midnight/15 bg-white">
              {symbol?.original_svg_path ? <img alt="" aria-hidden="true" className="size-16" src={publicMediaUrl(symbol.original_svg_path) ?? ""} /> : <Upload className="size-9 text-ink/35" />}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/50">SoulEvents Preview</p>
            <div className="mt-3 max-w-48">
              <SymbolPreview backgroundColor={symbol?.background_color ?? "#EEF5EA"} name={symbol?.name ?? "Nyt symbol"} path={symbol?.svg_path ?? null} />
            </div>
          </div>
        </div>

        <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#7A4EAB] px-6 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#6B429D] sm:w-fit" type="submit">
          <ImagePlus className="size-4" aria-hidden="true" />
          {symbol ? "Gem symbol" : "Upload symbol"}
        </button>
      </form>
    </section>
  );
}

function SymbolCard({ symbol }: { symbol: any }) {
  return (
    <article className="grid gap-4 rounded-[24px] border border-midnight/10 bg-white p-4 shadow-soft">
      <div className="grid grid-cols-[5rem_1fr] gap-4">
        <SymbolPreview backgroundColor={symbol.background_color} name={symbol.name} path={symbol.svg_path} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold text-midnight">{symbol.name}</h3>
              <p className="text-sm text-ink/55">{symbol.category}</p>
            </div>
            <span className={"rounded-full px-3 py-1 text-xs font-semibold " + statusClass(symbol.is_active)}>
              {symbol.is_active ? "Aktiv" : "Inaktiv"}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink/55">
            <div>
              <dt className="font-semibold uppercase tracking-wide">Slug</dt>
              <dd className="truncate">{symbol.slug}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide">Sortering</dt>
              <dd>{symbol.sort_order}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className="inline-flex min-h-9 items-center gap-2 rounded-full border border-midnight/10 px-3 text-xs font-semibold text-midnight hover:border-[#7A4EAB]/40" href={`/admin/design/symbols?edit=${symbol.id}`}>
          <Edit3 className="size-3.5" aria-hidden="true" />
          Rediger
        </Link>
        <form action={setDesignSymbolStatusAction}>
          <input name="id" type="hidden" value={symbol.id} />
          <input name="is_active" type="hidden" value={symbol.is_active ? "false" : "true"} />
          <button className="inline-flex min-h-9 items-center gap-2 rounded-full border border-midnight/10 px-3 text-xs font-semibold text-midnight hover:border-[#7A4EAB]/40" type="submit">
            {symbol.is_active ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
            {symbol.is_active ? "Deaktivér" : "Aktivér"}
          </button>
        </form>
        <form action={reorderDesignSymbolAction}>
          <input name="id" type="hidden" value={symbol.id} />
          <input name="sort_order" type="hidden" value={symbol.sort_order} />
          <input name="direction" type="hidden" value="up" />
          <button aria-label="Flyt op" className="grid min-h-9 min-w-9 place-items-center rounded-full border border-midnight/10 text-midnight hover:border-[#7A4EAB]/40" type="submit">
            <ChevronUp className="size-4" aria-hidden="true" />
          </button>
        </form>
        <form action={reorderDesignSymbolAction}>
          <input name="id" type="hidden" value={symbol.id} />
          <input name="sort_order" type="hidden" value={symbol.sort_order} />
          <input name="direction" type="hidden" value="down" />
          <button aria-label="Flyt ned" className="grid min-h-9 min-w-9 place-items-center rounded-full border border-midnight/10 text-midnight hover:border-[#7A4EAB]/40" type="submit">
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </form>
        <form action={deleteDesignSymbolAction}>
          <input name="id" type="hidden" value={symbol.id} />
          <button className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#D9A1A6]/45 px-3 text-xs font-semibold text-[#8A3342] hover:bg-[#F8E8E9]" type="submit">
            <Trash2 className="size-3.5" aria-hidden="true" />
            Slet
          </button>
        </form>
      </div>
    </article>
  );
}

export default async function AdminDesignSymbolsPage({ searchParams }: AdminDesignSymbolsPageProps) {
  const [{ edit, message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = createAdminClient();
  const [{ data: symbols }, { data: editSymbol }] = await Promise.all([
    supabase.from("design_symbols").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    edit ? supabase.from("design_symbols").select("*").eq("id", edit).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Design</p>
            <h1 className="font-serif text-3xl font-semibold text-midnight">Symboler</h1>
          </div>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-full border border-midnight/10 px-4 text-sm font-semibold text-midnight" href="/admin">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Admin
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} variant="notice" />
        <SymbolForm symbol={editSymbol} />

        <section className="grid gap-4 rounded-[28px] border border-[#EBDDC8] bg-[#FFF8EC] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Bibliotek</p>
              <h2 className="mt-1 text-2xl font-semibold text-midnight">Alle symboler</h2>
            </div>
            <p className="text-sm font-semibold text-ink/55">{symbols?.length ?? 0} symboler</p>
          </div>

          {symbols?.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {symbols.map((symbol) => (
                <SymbolCard key={symbol.id} symbol={symbol} />
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-midnight/15 bg-white p-8 text-center">
              <Layers3 className="mx-auto size-10 text-ink/35" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold text-midnight">Ingen symboler endnu</h3>
              <p className="mt-2 text-sm text-ink/60">Upload det første SVG-symbol for at gøre biblioteket tilgængeligt i profiler.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
