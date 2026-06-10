"use client";

import { CalendarPlus, Eye, Save, Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createEventAction } from "@/app/facilitator/events/actions";

type Region = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  name: string;
};

type MainCategory = Category;
type Subcategory = Category;
type Tag = Category;

type EventFormProps = {
  regions: Region[];
  categories: Category[];
  mainCategories?: MainCategory[];
  subcategories?: Subcategory[];
  tags?: Tag[];
  facilitator: {
    contactEmail: string;
    contactPhone: string | null;
    regionId: string | null;
    addressLine: string | null;
    postalCode: string | null;
    city: string | null;
  };
};

function value(input: string | number | null | undefined) {
  return input === null || input === undefined ? "" : String(input);
}

function StepHeader({ number, title, text }: { number: number; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-terracotta text-sm font-semibold text-white">
        {number}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-midnight">{title}</h2>
        <p className="text-sm leading-6 text-ink/64">{text}</p>
      </div>
    </div>
  );
}

function TextInput({
  label,
  name,
  required,
  defaultValue,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink/72">
      {label}
      <input
        className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

function CheckboxPill({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-midnight/10 bg-white p-3 text-sm font-medium text-ink/75">
      <input className="size-4 accent-sage-700" name={name} type="checkbox" value={value} />
      {label}
    </label>
  );
}

export function EventForm({
  regions,
  categories,
  mainCategories = [],
  subcategories = [],
  tags = [],
  facilitator,
}: EventFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [eventFormat, setEventFormat] = useState<"physical" | "online" | "hybrid">("physical");
  const [isFree, setIsFree] = useState(false);
  const [preview, setPreview] = useState<{ title: string; teaser: string; format: string; price: string } | null>(null);
  const showAddress = eventFormat === "physical" || eventFormat === "hybrid";
  const showOnline = eventFormat === "online" || eventFormat === "hybrid";
  const statusHelp = useMemo(
    () =>
      "Gem som kladde hvis du vil arbejde videre. Publicer sender eventet videre til visning/godkendelse efter platformens regler.",
    [],
  );

  function showPreview() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    setPreview({
      title: String(data.get("title") ?? "Eventtitel"),
      teaser: String(data.get("short_description") ?? ""),
      format: eventFormat === "online" ? "Online event" : eventFormat === "hybrid" ? "Hybrid event" : "Fysisk event",
      price: isFree ? "Gratis" : String(data.get("price") ?? "0") + " kr.",
    });
  }

  return (
    <form action={createEventAction} className="grid gap-6" ref={formRef}>
      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-terracotta text-white">
            <CalendarPlus className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-midnight">Opret event</h2>
            <p className="text-sm text-ink/64">Følg trinene og opret et professionelt event uden tekniske felter.</p>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <StepHeader number={1} title="Grundoplysninger" text="Fortæl kort hvad deltageren kan forvente." />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TextInput label="Eventtitel" name="title" required />
          <TextInput label="Eventbillede" name="cover_image_path" placeholder="events/forside.jpg" />
        </div>
        <label className="mt-4 grid gap-2 text-sm font-medium text-ink/72">
          Kort teaser / introduktion
          <textarea className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700" name="short_description" required />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-medium text-ink/72">
          Uddybende beskrivelse
          <textarea className="min-h-40 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700" name="long_description" required />
        </label>
        <div className="mt-5 grid gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="grid gap-3 rounded-md bg-sage-50 p-4 md:grid-cols-2" key={index}>
              <TextInput label={"Galleri-billede " + (index + 1)} name="event_image_paths" placeholder="events/galleri.jpg" />
              <TextInput label="Billedtekst" name="event_alt_texts" />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <StepHeader number={2} title="Kategori og tags" text="Vælg de ord der bedst hjælper brugeren med at finde eventet." />
        {mainCategories.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold text-midnight">Hovedkategori</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mainCategories.map((category) => (
                <CheckboxPill key={category.id} label={category.name} name="main_category_ids" value={category.id} />
              ))}
            </div>
          </div>
        )}
        {subcategories.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold text-midnight">Underkategorier / eventformer</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subcategories.map((subcategory) => (
                <CheckboxPill key={subcategory.id} label={subcategory.name} name="subcategory_ids" value={subcategory.id} />
              ))}
            </div>
          </div>
        )}
        {tags.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold text-midnight">Tags</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tags.map((tag) => (
                <CheckboxPill key={tag.id} label={tag.name} name="tag_ids" value={tag.id} />
              ))}
            </div>
          </div>
        )}
        <div className="mt-5">
          <p className="text-sm font-semibold text-midnight">Nuværende kategorier</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...categories].sort((a, b) => a.name.localeCompare(b.name, "da-DK")).map((category) => (
              <CheckboxPill key={category.id} label={category.name} name="category_ids" value={category.id} />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <StepHeader number={3} title="Eventtype" text="Vælg om eventet foregår fysisk, online eller begge dele." />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { value: "physical", label: "📍 Fysisk event" },
            { value: "online", label: "💻 Online event" },
            { value: "hybrid", label: "🔄 Hybrid event" },
          ].map((option) => (
            <label className="flex items-center gap-3 rounded-md border border-midnight/10 p-4 text-sm font-semibold text-midnight" key={option.value}>
              <input
                checked={eventFormat === option.value}
                className="size-4 accent-sage-700"
                name="event_format"
                onChange={() => setEventFormat(option.value as "physical" | "online" | "hybrid")}
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      {showAddress && (
        <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-midnight">Sted</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextInput defaultValue={value(facilitator.addressLine)} label="Adresse" name="address_line" required={showAddress} />
            <TextInput defaultValue={value(facilitator.postalCode)} label="Postnummer" name="postal_code" required={showAddress} />
            <TextInput defaultValue={value(facilitator.city)} label="By" name="city" required={showAddress} />
            <TextInput defaultValue="Danmark" label="Land" name="country" required={showAddress} />
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Region
              <select className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-sage-700" defaultValue={value(facilitator.regionId)} name="region_id">
                <option value="">Vælg region</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>{region.name}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {showOnline && (
        <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-midnight">Online-information</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Kort online-beskrivelse
              <textarea className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700" name="online_description" placeholder="Link til online møderum sendes efter tilmelding." required={showOnline} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-ink/72">
              Online link eller tekst
              <textarea className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700" name="online_url_or_note" placeholder="Zoom-link, Teams-link eller tekst om at link sendes senere." required={showOnline} />
            </label>
          </div>
        </section>
      )}

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <StepHeader number={4} title="Dato, tid og pris" text="Fortæl hvornår eventet foregår, og hvor mange der kan deltage." />
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <TextInput defaultValue={today} label="Dato" name="start_date" required type="date" />
          <TextInput defaultValue="19:00" label="Starttidspunkt" name="start_time" required type="time" />
          <TextInput defaultValue={today} label="Slutdato" name="end_date" required type="date" />
          <TextInput defaultValue="21:00" label="Sluttidspunkt" name="end_time" required type="time" />
          <TextInput defaultValue={isFree ? "0" : "0"} label="Pris i kr." name="price" type="number" />
          <TextInput defaultValue="12" label="Maks. antal deltagere" name="capacity" required type="number" />
          <label className="flex h-11 items-center gap-3 rounded-md border border-midnight/10 p-3 text-sm font-semibold text-midnight">
            <input checked={isFree} className="size-4 accent-sage-700" onChange={(event) => setIsFree(event.target.checked)} type="checkbox" />
            Gratis event
          </label>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <StepHeader number={5} title="Kontakt og tilmelding" text="Giv deltagerne de praktiske oplysninger, de har brug for." />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TextInput label="Kontaktperson" name="contact_name" placeholder="Navn på kontaktperson" />
          <TextInput defaultValue={facilitator.contactEmail} label="E-mail" name="contact_email" type="email" />
          <TextInput defaultValue={value(facilitator.contactPhone)} label="Telefonnummer" name="contact_phone" />
        </div>
        <label className="mt-4 grid gap-2 text-sm font-medium text-ink/72">
          Særlige oplysninger til deltagere
          <textarea className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700" name="practical_information" placeholder="Medbring yogamåtte. Kom i behageligt tøj. Dørene åbner 15 minutter før." />
        </label>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TextInput label="Facebook" name="facebook_url" type="url" />
          <TextInput label="Instagram" name="instagram_url" type="url" />
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <StepHeader number={6} title="Preview og publicering" text={statusHelp} />
        {preview && (
          <article className="mt-5 rounded-card bg-cream p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose">{preview.format}</p>
            <h3 className="mt-2 text-3xl font-medium text-olive">{preview.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/70">{preview.teaser || "Kort teaser vises her."}</p>
            <p className="mt-4 text-sm font-semibold text-olive">{preview.price}</p>
          </article>
        )}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-midnight/15 bg-white px-5 text-sm font-semibold text-midnight" onClick={showPreview} type="button">
            <Eye className="size-4" aria-hidden="true" />
            Forhåndsvis
          </button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-midnight px-5 text-sm font-semibold text-white" name="status" type="submit" value="draft">
            <Save className="size-4" aria-hidden="true" />
            Gem som kladde
          </button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-terracotta px-5 text-sm font-semibold text-white" name="status" type="submit" value="pending_review">
            <Send className="size-4" aria-hidden="true" />
            Publicer
          </button>
        </div>
      </section>
    </form>
  );
}
