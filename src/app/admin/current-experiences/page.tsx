/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  LayoutList,
  Monitor,
  Plus,
  Smartphone,
  Sparkles,
  Tags,
  Trash2,
} from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteHomepageEventCollectionAction, upsertHomepageEventCollectionAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ message?: string; error?: string; saved?: string }>;
};

type SelectionMode = "automatic" | "manual";

type TagOption = {
  id: string;
  name: string;
};

type TagRelation = {
  collection_id: string;
  tag_id: string;
  tags: TagOption | TagOption[] | null;
};

type ManualEventOption = {
  event_reference_id?: string | null;
  id: string;
  ends_at: string;
  starts_at: string;
  status?: string | null;
  title: string;
};

type EventRelation = {
  collection_id: string;
  event_id: string;
  sort_order: number | null;
  events: ManualEventOption | ManualEventOption[] | null;
};

type HomepageCollection = {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  sort_order: number | null;
  show_on_mobile: boolean;
  show_on_desktop: boolean;
  selection_mode: SelectionMode;
  created_at: string;
  updated_at: string | null;
  homepage_event_collection_events?: EventRelation[] | null;
  homepage_event_collection_tags?: TagRelation[] | null;
};

function getRelationTag(relation: TagRelation) {
  const tags = relation.tags;
  return Array.isArray(tags) ? (tags[0] ?? null) : tags;
}

function getCollectionTags(collection: HomepageCollection) {
  return (collection.homepage_event_collection_tags ?? []).map(getRelationTag).filter(Boolean) as TagOption[];
}

function getRelationEvent(relation: EventRelation) {
  const events = relation.events;
  return Array.isArray(events) ? (events[0] ?? null) : events;
}

function getCollectionEvents(collection?: HomepageCollection) {
  return [...(collection?.homepage_event_collection_events ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(getRelationEvent)
    .filter(Boolean) as ManualEventOption[];
}

function getSelectedTagIds(collection?: HomepageCollection) {
  return new Set((collection?.homepage_event_collection_tags ?? []).map((relation) => relation.tag_id));
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
        active ? "bg-[#EAF4E4] text-sage-700" : "bg-[#F5F0EA] text-ink/60"
      }`}
    >
      {active ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <EyeOff className="size-3.5" aria-hidden="true" />}
      {active ? "Aktiv" : "Inaktiv"}
    </span>
  );
}

function VisibilityPill({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
        enabled ? "bg-[#F2E7FF] text-[#7A4EAB]" : "bg-white text-ink/45"
      }`}
    >
      {enabled ? <Eye className="size-3.5" aria-hidden="true" /> : <EyeOff className="size-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

function ModePill({ mode }: { mode: SelectionMode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/60">
      <LayoutList className="size-3.5" aria-hidden="true" />
      {mode === "manual" ? "Manuel" : "Automatisk"}
    </span>
  );
}

function TagSelector({ tags, selectedIds }: { tags: TagOption[]; selectedIds: Set<string> }) {
  if (!tags.length) {
    return (
      <div className="rounded-[18px] border border-[#E8DED3] bg-[#FBF7EF] p-4 text-sm text-ink/64">
        Der er endnu ingen aktive tags at vælge imellem.
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {tags.map((tag) => (
        <label
          className="flex min-w-0 cursor-pointer items-center gap-3 rounded-[16px] border border-midnight/10 bg-white px-4 py-3 text-sm font-semibold text-midnight transition hover:border-[#B89BE6]"
          key={tag.id}
        >
          <input
            className="size-5 accent-[#7E4BB8]"
            defaultChecked={selectedIds.has(tag.id)}
            name="tag_ids"
            type="checkbox"
            value={tag.id}
          />
          <span className="min-w-0 break-words">{tag.name}</span>
        </label>
      ))}
    </div>
  );
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ManualEventSelector({ collection, events }: { collection?: HomepageCollection; events: ManualEventOption[] }) {
  const selectedEvents = getCollectionEvents(collection);
  const inputId = `event-options-${collection?.id ?? "new"}`;

  return (
    <section className="grid gap-4 rounded-[22px] border border-midnight/10 bg-[#FFFDF9] p-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-5 text-[#8758C8]" aria-hidden="true" />
        <h3 className="font-serif text-xl font-semibold text-sage-700">Manuel udvælgelse</h3>
      </div>
      <p className="text-sm leading-6 text-ink/60">
        Tilføj et konkret event via eventnummer eller event-ID. Manuel udvælgelse afhænger ikke af tags.
      </p>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight">
        Tilføj event
        <input
          className="w-full min-w-0 rounded-[16px] border border-midnight/10 bg-white px-4 py-3 text-base outline-none transition focus:border-[#8B5FC7] focus:ring-2 focus:ring-[#E5D7F7]"
          list={inputId}
          name="event_lookup"
          placeholder="Fx V101-E02-0726 eller event-ID"
        />
        <datalist id={inputId}>
          {events.map((event) => (
            <option key={event.id} value={event.event_reference_id ?? event.id}>
              {event.title} · {formatEventDate(event.starts_at)}
            </option>
          ))}
        </datalist>
      </label>
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-midnight">Valgte events</p>
        {selectedEvents.length ? (
          selectedEvents.map((event) => (
            <label
              className="flex min-w-0 cursor-pointer items-start gap-3 rounded-[16px] border border-midnight/10 bg-white px-4 py-3 text-sm text-ink/70 transition hover:border-[#B89BE6]"
              key={event.id}
            >
              <input className="mt-1 size-5 accent-[#7E4BB8]" defaultChecked name="event_ids" type="checkbox" value={event.id} />
              <span className="min-w-0">
                <span className="block font-semibold text-midnight">{event.title}</span>
                <span className="mt-1 block text-xs font-semibold text-ink/50">
                  {event.event_reference_id ?? event.id} · {formatEventDate(event.starts_at)}
                </span>
              </span>
            </label>
          ))
        ) : (
          <div className="rounded-[18px] border border-[#E8DED3] bg-[#FBF7EF] p-4 text-sm text-ink/64">
            Ingen events valgt endnu.
          </div>
        )}
      </div>
    </section>
  );
}

function CollectionForm({ collection, eventOptions, tags }: { collection?: HomepageCollection; eventOptions: ManualEventOption[]; tags: TagOption[] }) {
  const selectedTagIds = getSelectedTagIds(collection);
  const isNew = !collection;

  return (
    <details className="min-w-0 overflow-hidden rounded-[26px] border border-midnight/10 bg-white shadow-soft" open={isNew}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-[#FBF6EF] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8758C8]">{isNew ? "Ny sektion" : "Rediger sektion"}</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-sage-700">
            {isNew ? "Opret aktuel oplevelse" : collection.title}
          </h2>
        </div>
        <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink/60">Klik for at åbne/lukke</span>
      </summary>

      <div className="grid gap-5 p-5 sm:p-6">
        <form action={upsertHomepageEventCollectionAction} className="grid gap-5">
          {collection?.id && <input name="id" type="hidden" value={collection.id} />}

          <section className="grid gap-4 rounded-[22px] border border-midnight/10 bg-[#FFFDF9] p-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight">
                Overskrift
                <input
                  className="w-full min-w-0 rounded-[16px] border border-midnight/10 bg-white px-4 py-3 text-base outline-none transition focus:border-[#8B5FC7] focus:ring-2 focus:ring-[#E5D7F7]"
                  defaultValue={collection?.title ?? ""}
                  maxLength={90}
                  name="title"
                  placeholder="Fx Sommerens retreats"
                  required
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight">
                Sortering
                <input
                  className="w-full min-w-0 rounded-[16px] border border-midnight/10 bg-white px-4 py-3 text-base outline-none transition focus:border-[#8B5FC7] focus:ring-2 focus:ring-[#E5D7F7]"
                  defaultValue={collection?.sort_order ?? 0}
                  name="sort_order"
                  type="number"
                />
              </label>
            </div>
            <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight">
              Beskrivelse <span className="font-normal text-ink/50">Valgfri</span>
              <textarea
                className="min-h-28 w-full min-w-0 rounded-[16px] border border-midnight/10 bg-white px-4 py-3 text-base outline-none transition focus:border-[#8B5FC7] focus:ring-2 focus:ring-[#E5D7F7]"
                defaultValue={collection?.description ?? ""}
                maxLength={240}
                name="description"
                placeholder="Kort redaktionel tekst til admin og senere frontend."
              />
            </label>
          </section>

          <section className="grid gap-4 rounded-[22px] border border-midnight/10 bg-[#FFFDF9] p-4">
            <div className="flex items-center gap-2">
              <Tags className="size-5 text-[#8758C8]" aria-hidden="true" />
              <h3 className="font-serif text-xl font-semibold text-sage-700">Tags</h3>
            </div>
            <p className="text-sm leading-6 text-ink/60">
              I automatisk tilstand henter sektionen events, der matcher de valgte tags.
            </p>
            <TagSelector tags={tags} selectedIds={selectedTagIds} />
          </section>

          <section className="grid gap-4 rounded-[22px] border border-midnight/10 bg-[#FFFDF9] p-4">
            <h3 className="font-serif text-xl font-semibold text-sage-700">Visning og udvalg</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 items-center gap-3 rounded-[16px] border border-midnight/10 bg-white px-4 py-3 text-sm font-semibold text-midnight">
                <input className="size-5 accent-[#7E4BB8]" defaultChecked={collection?.is_active ?? true} name="is_active" type="checkbox" />
                Aktiv
              </label>
              <label className="flex min-w-0 items-center gap-3 rounded-[16px] border border-midnight/10 bg-white px-4 py-3 text-sm font-semibold text-midnight">
                <input
                  className="size-5 accent-[#7E4BB8]"
                  defaultChecked={collection?.show_on_mobile ?? true}
                  name="show_on_mobile"
                  type="checkbox"
                />
                <Smartphone className="size-4" aria-hidden="true" />
                Mobil
              </label>
              <label className="flex min-w-0 items-center gap-3 rounded-[16px] border border-midnight/10 bg-white px-4 py-3 text-sm font-semibold text-midnight">
                <input
                  className="size-5 accent-[#7E4BB8]"
                  defaultChecked={collection?.show_on_desktop ?? true}
                  name="show_on_desktop"
                  type="checkbox"
                />
                <Monitor className="size-4" aria-hidden="true" />
                Desktop
              </label>
            </div>
            <label className="grid min-w-0 gap-2 text-sm font-semibold text-midnight">
              Udvælgelse
              <select
                className="w-full min-w-0 rounded-[16px] border border-midnight/10 bg-white px-4 py-3 text-base outline-none transition focus:border-[#8B5FC7] focus:ring-2 focus:ring-[#E5D7F7]"
                defaultValue={collection?.selection_mode ?? "automatic"}
                name="selection_mode"
              >
                <option value="automatic">Automatisk baseret på tags</option>
                <option value="manual">Manuel udvælgelse</option>
              </select>
            </label>
            <div className="rounded-[18px] bg-[#F7F1EA] p-4 text-sm leading-6 text-ink/64">
              Automatisk visning bruger tags. Manuel udvælgelse bruger de konkrete events, du vælger herunder.
            </div>
          </section>

          <ManualEventSelector collection={collection} events={eventOptions} />

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-sage-700 px-6 py-3 font-semibold text-white shadow-soft transition hover:bg-sage-800">
              <CheckCircle2 className="size-5" aria-hidden="true" />
              Gem sektion
            </button>
          </div>
        </form>

        {collection?.id && (
          <form action={deleteHomepageEventCollectionAction} className="flex justify-end border-t border-midnight/10 pt-4">
            <input name="id" type="hidden" value={collection.id} />
            <button className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-[#E8B1AA] bg-white px-5 py-2.5 text-sm font-semibold text-[#B85C55] transition hover:bg-[#FFF1EF]">
              <Trash2 className="size-4" aria-hidden="true" />
              Slet sektion
            </button>
          </form>
        )}
      </div>
    </details>
  );
}

function CollectionCard({ collection, eventOptions, tags, savedId }: { collection: HomepageCollection; eventOptions: ManualEventOption[]; tags: TagOption[]; savedId?: string }) {
  const selectedTags = getCollectionTags(collection);
  const selectedEvents = getCollectionEvents(collection);

  return (
    <article className="rounded-[26px] border border-midnight/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill active={collection.is_active} />
            <ModePill mode={collection.selection_mode} />
            <VisibilityPill enabled={collection.show_on_mobile}>Mobil</VisibilityPill>
            <VisibilityPill enabled={collection.show_on_desktop}>Desktop</VisibilityPill>
          </div>
          <h2 className="mt-4 font-serif text-2xl font-semibold text-sage-700">{collection.title}</h2>
          {collection.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/64">{collection.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {collection.selection_mode === "manual" ? (
              selectedEvents.length ? (
                selectedEvents.map((event) => (
                  <span className="rounded-full bg-[#F2E7FF] px-3 py-1 text-xs font-semibold text-[#7A4EAB]" key={event.id}>
                    {event.event_reference_id ?? event.title}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-[#F5F0EA] px-3 py-1 text-xs font-semibold text-ink/50">Ingen events valgt</span>
              )
            ) : selectedTags.length ? (
              selectedTags.map((tag) => (
                <span className="rounded-full bg-[#F2E7FF] px-3 py-1 text-xs font-semibold text-[#7A4EAB]" key={tag.id}>
                  {tag.name}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-[#F5F0EA] px-3 py-1 text-xs font-semibold text-ink/50">Ingen tags valgt</span>
            )}
          </div>
        </div>
        <div className="rounded-[18px] bg-[#FBF7EF] px-4 py-3 text-sm font-semibold text-ink/60">
          Sortering: {collection.sort_order ?? 0}
        </div>
      </div>

      {savedId === collection.id && (
        <div className="mt-4 rounded-[18px] border border-[#C9DFBD] bg-[#F2F8EF] px-4 py-3 text-sm font-semibold text-sage-700">
          Ændringer gemt.
        </div>
      )}

      <div className="mt-5">
        <CollectionForm collection={collection} eventOptions={eventOptions} tags={tags} />
      </div>
    </article>
  );
}

export default async function AdminCurrentExperiencesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  await requireRole("admin");

  const admin = createAdminClient() as any;
  const [
    { data: tagData, error: tagsError },
    { data: collectionData, error: collectionsError },
    { data: collectionTagData, error: collectionTagsError },
    { data: collectionEventData, error: collectionEventsError },
    { data: eventOptionsData, error: eventOptionsError },
  ] = await Promise.all([
    admin.from("tags").select("id, name").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }),
    admin
      .from("homepage_event_collections")
      .select("id, title, description, is_active, sort_order, show_on_mobile, show_on_desktop, selection_mode, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    admin.from("homepage_event_collection_tags").select("collection_id, tag_id, tags(id, name)"),
    admin
      .from("homepage_event_collection_events")
      .select("collection_id, event_id, sort_order, events(id, event_reference_id, title, starts_at, ends_at, status)")
      .order("sort_order", { ascending: true }),
    admin
      .from("events")
      .select("id, event_reference_id, title, starts_at, ends_at, status, facilitator_profiles!inner(status)")
      .in("status", ["active", "sold_out"])
      .eq("facilitator_profiles.status", "approved")
      .eq("facilitator_profiles.is_paused", false)
      .eq("facilitator_profiles.is_disabled", false)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(250),
  ]);

  const tags = (tagData ?? []) as TagOption[];
  const eventOptions = (eventOptionsData ?? []) as unknown as ManualEventOption[];
  const relationRows = (collectionTagData ?? []) as unknown as TagRelation[];
  const eventRelationRows = (collectionEventData ?? []) as unknown as EventRelation[];
  const relationsByCollection = new Map<string, TagRelation[]>();
  const eventRelationsByCollection = new Map<string, EventRelation[]>();

  for (const relation of relationRows) {
    const current = relationsByCollection.get(relation.collection_id) ?? [];
    current.push(relation);
    relationsByCollection.set(relation.collection_id, current);
  }

  for (const relation of eventRelationRows) {
    const current = eventRelationsByCollection.get(relation.collection_id) ?? [];
    current.push(relation);
    eventRelationsByCollection.set(relation.collection_id, current);
  }

  const collections = ((collectionData ?? []) as unknown as HomepageCollection[]).map((collection) => ({
    ...collection,
    homepage_event_collection_events: eventRelationsByCollection.get(collection.id) ?? [],
    homepage_event_collection_tags: relationsByCollection.get(collection.id) ?? [],
  }));
  const activeCount = collections.filter((collection) => collection.is_active).length;
  const errorMessage = params.error ?? tagsError?.message ?? collectionsError?.message ?? collectionTagsError?.message ?? collectionEventsError?.message ?? eventOptionsError?.message;

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Aktuelle oplevelser</h1>
            </div>
          </div>
          <Link
            className="inline-flex items-center gap-2 rounded-md border border-midnight/10 bg-white px-4 py-2 text-sm font-semibold text-sage-700 transition hover:border-sage-700"
            href="/admin"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Admin
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={params.message} />
        <AuthMessage message={errorMessage} variant="error" />

        <section className="rounded-[28px] border border-midnight/10 bg-white p-6 shadow-soft">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#8758C8]">Forsidekuratering</p>
              <h2 className="mt-2 font-serif text-4xl font-semibold text-sage-700">Styr de eventrækker, der vises på forsiden</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-ink/64">
                Opret redaktionelle sektioner som “Sommerens retreats”, “Gratis oplevelser” eller “SoulEvents anbefaler”.
                Første version bruger automatisk udvælgelse baseret på tags.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-[18px] bg-[#FBF7EF] px-4 py-3">
                <p className="text-2xl font-semibold text-sage-700">{collections.length}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">I alt</p>
              </div>
              <div className="rounded-[18px] bg-[#F2F8EF] px-4 py-3">
                <p className="text-2xl font-semibold text-sage-700">{activeCount}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Aktive</p>
              </div>
              <div className="rounded-[18px] bg-[#F2E7FF] px-4 py-3">
                <p className="text-2xl font-semibold text-[#7A4EAB]">{tags.length}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Tags</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)]">
          <div className="min-w-0">
            <CollectionForm eventOptions={eventOptions} tags={tags} />
          </div>

          <section className="grid min-w-0 gap-4">
            {collections.length ? (
              collections.map((collection) => (
                <CollectionCard collection={collection} eventOptions={eventOptions} key={collection.id} savedId={params.saved} tags={tags} />
              ))
            ) : (
              <div className="rounded-[28px] border border-midnight/10 bg-white p-8 text-center shadow-soft">
                <Plus className="mx-auto size-8 text-[#8758C8]" aria-hidden="true" />
                <h2 className="mt-4 font-serif text-2xl font-semibold text-sage-700">Ingen aktuelle oplevelser endnu</h2>
                <p className="mt-2 text-sm text-ink/64">Opret den første sektion, når forsiden skal kurateres redaktionelt.</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
