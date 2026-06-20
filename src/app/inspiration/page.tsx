import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function publicMediaUrl(imagePath: string | null) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  const encodedPath = imagePath.split("/").map((part) => encodeURIComponent(part)).join("/");
  return supabaseUrl.replace(/\/$/, "") + "/storage/v1/object/public/media/" + encodedPath;
}

export default async function InspirationPage() {
  const supabase = await createClient();
  const { data: inspirators } = await supabase
    .from("inspirator_profiles")
    .select("id, slug, name, title, short_intro, category, profile_image_path, hero_image_path")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <header className="border-b border-[#E5DDEA] bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/"><BrandLogo className="h-20 w-20" priority /></Link>
          <Link className="rounded-full border border-[#7A5D91]/20 bg-white px-4 py-2 text-sm font-semibold text-[#7A5D91]" href="/">Forsiden</Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="rounded-[2rem] border border-[#D8CBE4] bg-gradient-to-br from-white via-[#F4F0F7] to-[#FAF6EF] p-8 shadow-soft sm:p-12">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#7A5D91]">
            <Sparkles className="size-4" aria-hidden="true" />
            Inspiration
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">Mennesker, der inspirerer fællesskabet</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#6E6475] sm:text-lg">
            Mød kunstnere, musikere, undervisere, håndværkere og andre inspirerende mennesker i SoulEvents-universet.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(inspirators ?? []).map((item) => {
            const imageUrl = publicMediaUrl(item.profile_image_path || item.hero_image_path);
            return (
              <Link className="group overflow-hidden rounded-[1.75rem] border border-[#E5DDEA] bg-white shadow-soft transition hover:-translate-y-1 hover:border-[#D8CBE4]" href={"/inspiration/" + item.slug} key={item.id}>
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={item.name} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]" src={imageUrl} />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-[#7A5D91] to-[#D8A7B1] text-white">
                    <Sparkles className="size-10" aria-hidden="true" />
                  </div>
                )}
                <div className="p-5">
                  {item.category && <p className="text-xs font-semibold uppercase tracking-wide text-[#7A5D91]">{item.category}</p>}
                  <h2 className="mt-2 text-2xl font-semibold">{item.name}</h2>
                  {item.title && <p className="mt-1 text-sm font-semibold text-[#6E6475]">{item.title}</p>}
                  {item.short_intro && <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#6E6475]">{item.short_intro}</p>}
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#7A5D91]">Se profil <ArrowRight className="size-4" aria-hidden="true" /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
