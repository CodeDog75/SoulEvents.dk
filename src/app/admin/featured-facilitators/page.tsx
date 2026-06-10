import Link from "next/link";
import { ArrowLeft, Save, Star, UserRound } from "lucide-react";
import { updateFeaturedFacilitatorAction } from "@/app/admin/featured-facilitators/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function FeaturedFacilitatorsAdminPage({ searchParams }: PageProps) {
  const [{ message }] = await Promise.all([searchParams, requireRole("admin")]);
  const supabase = await createClient();
  const { data: facilitators, error } = await supabase
    .from("facilitator_profiles")
    .select("id, company_name, profile_image_path, short_description, city, is_featured, featured_sort_order, profiles(full_name), facilitator_categories(categories(name, color_hex))")
    .eq("status", "approved")
    .order("featured_sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <Star className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Fremhævede facilitatorer</h1>
            </div>
          </div>
          <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta" href="/admin">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />

        {error ? (
          <section className="mt-5 rounded-md border border-terracotta/20 bg-white p-6 text-sm leading-6 text-terracotta shadow-soft">
            Fremhævede facilitatorer kræver, at migration 011 er kørt i Supabase.
          </section>
        ) : (
          <section className="mt-5 overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
            <div className="border-b border-midnight/10 px-5 py-4">
              <h2 className="font-semibold text-midnight">Aktive facilitatorer</h2>
              <p className="mt-1 text-sm text-ink/64">Markér hvem der skal vises som fremhævede på forsiden.</p>
            </div>
            <div className="divide-y divide-midnight/10">
              {(facilitators ?? []).map((facilitator: any) => {
                const profile = Array.isArray(facilitator.profiles) ? facilitator.profiles[0] : facilitator.profiles;
                const categories =
                  facilitator.facilitator_categories
                    ?.map((row: any) => (Array.isArray(row.categories) ? row.categories[0] : row.categories)?.name)
                    .filter(Boolean) ?? [];
                return (
                  <form action={updateFeaturedFacilitatorAction} className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]" key={facilitator.id}>
                    <input name="facilitator_id" type="hidden" value={facilitator.id} />
                    <div className="flex gap-4">
                      {facilitator.profile_image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className="size-16 rounded-full object-cover" src={supabase.storage.from("media").getPublicUrl(facilitator.profile_image_path).data.publicUrl} />
                      ) : (
                        <div className="grid size-16 place-items-center rounded-full bg-sage-50 text-sage-700">
                          <UserRound className="size-7" aria-hidden="true" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-midnight">{facilitator.company_name || profile?.full_name || "Uden navn"}</h3>
                        <p className="mt-1 text-sm text-ink/64">{facilitator.city || "Online/Danmark"}</p>
                        <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-ink/70">
                          {facilitator.short_description || "Ingen kort beskrivelse endnu."}
                        </p>
                        {categories.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {categories.slice(0, 3).map((category: string) => (
                              <span className="rounded-md bg-sage-50 px-2.5 py-1 text-xs font-semibold text-sage-700" key={category}>
                                {category}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap content-start gap-3 lg:justify-end">
                      <label className="flex h-10 items-center gap-2 rounded-md border border-midnight/10 bg-white px-3 text-sm font-semibold text-midnight">
                        <input className="size-4 accent-sage-700" defaultChecked={Boolean(facilitator.is_featured)} name="is_featured" type="checkbox" />
                        Fremhævet
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-ink/64">
                        Sortering
                        <input className="h-10 w-24 rounded-md border border-midnight/15 px-3 text-sm outline-none focus:border-sage-700" defaultValue={facilitator.featured_sort_order ?? 0} name="featured_sort_order" type="number" />
                      </label>
                      <button className="inline-flex h-10 items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
                        <Save className="size-4" aria-hidden="true" />
                        Gem
                      </button>
                    </div>
                  </form>
                );
              })}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
