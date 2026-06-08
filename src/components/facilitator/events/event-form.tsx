import { CalendarPlus } from "lucide-react";
import { createEventAction } from "@/app/facilitator/events/actions";

type Region = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  name: string;
};

type EventFormProps = {
  regions: Region[];
  categories: Category[];
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

export function EventForm({ regions, categories, facilitator }: EventFormProps) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={createEventAction} className="grid gap-6">
      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-terracotta text-white">
            <CalendarPlus className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-midnight">Opret begivenhed</h2>
            <p className="text-sm text-ink/64">Gem som kladde eller publicer som aktiv, når du er klar.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Titel
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              name="title"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Slug
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              name="slug"
              placeholder="dannes automatisk"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Status
            <select
              className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue="draft"
              name="status"
            >
              <option value="draft">Kladde</option>
              <option value="active">Aktiv</option>
              <option value="sold_out">Udsolgt</option>
              <option value="cancelled">Aflyst</option>
              <option value="completed">Afholdt</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Forsidebillede path
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              name="cover_image_path"
              placeholder="events/forside.jpg"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Kort beskrivelse
            <textarea
              className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700"
              name="short_description"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Lang beskrivelse
            <textarea
              className="min-h-40 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700"
              name="long_description"
              required
            />
          </label>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-semibold text-midnight">Dato, pris og kapacitet</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Startdato
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue={today}
              name="start_date"
              required
              type="date"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Starttid
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue="19:00"
              name="start_time"
              required
              type="time"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Slutdato
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue={today}
              name="end_date"
              required
              type="date"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Sluttid
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue="21:00"
              name="end_time"
              required
              type="time"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Pris i kr.
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue="0"
              inputMode="decimal"
              name="price"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Kapacitet
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue="12"
              min={1}
              name="capacity"
              required
              type="number"
            />
          </label>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-semibold text-midnight">Lokation og kontakt</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-ink/72 md:col-span-2">
            Adresse
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue={value(facilitator.addressLine)}
              name="address_line"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Postnummer
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue={value(facilitator.postalCode)}
              name="postal_code"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            By
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue={value(facilitator.city)}
              name="city"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Region
            <select
              className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue={value(facilitator.regionId)}
              name="region_id"
            >
              <option value="">Vælg region</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>

          <p className="rounded-md bg-sage-50 p-3 text-sm leading-6 text-ink/65">
            Hvis du ikke vælger region, forsøger vi at vælge den ud fra postnummeret. Kortplacering oprettes
            automatisk ud fra adresse, postnummer og by, når Mapbox-token er sat op.
          </p>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Kontakt e-mail
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue={facilitator.contactEmail}
              name="contact_email"
              type="email"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Kontakt telefon
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              defaultValue={value(facilitator.contactPhone)}
              name="contact_phone"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Facebook
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              name="facebook_url"
              type="url"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-ink/72">
            Instagram
            <input
              className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
              name="instagram_url"
              type="url"
            />
          </label>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-semibold text-midnight">Kategorier og ekstra billeder</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...categories].sort((a, b) => a.name.localeCompare(b.name, "da-DK")).map((category) => (
            <label
              className="flex items-center gap-3 rounded-md border border-midnight/10 p-3 text-sm font-medium text-ink/75"
              key={category.id}
            >
              <input className="size-4 accent-sage-700" name="category_ids" type="checkbox" value={category.id} />
              {category.name}
            </label>
          ))}
        </div>

        <div className="mt-5 grid gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="grid gap-3 rounded-md bg-sage-50 p-4 md:grid-cols-2" key={index}>
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Ekstra billede {index + 1}
                <input
                  className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-sage-700"
                  name="event_image_paths"
                  placeholder="events/galleri.jpg"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-ink/72">
                Alt-tekst
                <input
                  className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-sage-700"
                  name="event_alt_texts"
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <button
          className="inline-flex h-11 items-center gap-2 rounded-md bg-midnight px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700"
          type="submit"
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          Opret event
        </button>
      </div>
    </form>
  );
}
