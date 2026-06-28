import Link from "next/link";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ContactForm } from "@/components/contact/contact-form";
import { SiteFooterLogin } from "@/components/site-footer-login";

type ContactPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = searchParams ? await searchParams : {};

  return (
    <main className="min-h-screen bg-[#FAF6EF] text-[#2F2633]">
      <section className="mx-auto grid max-w-[1200px] gap-8 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="space-y-6">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-olive transition hover:text-rose" href="/">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage til forsiden
          </Link>

          <BrandLogo className="h-24 w-24 sm:h-32 sm:w-32" priority />

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#7A4EAB]">Kontakt</p>
            <h1 className="mt-3 text-4xl font-medium leading-tight text-olive sm:text-6xl">Skriv til SoulEvents.dk</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-ink/70">
              Har du spørgsmål, ideer eller brug for hjælp, kan du sende en besked direkte til os.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {params.status === "sent" && (
            <p className="rounded-input bg-sage-50 px-4 py-3 text-sm font-semibold text-olive">
              Tak for din besked. Vi har modtaget din henvendelse og vender tilbage hurtigst muligt.
            </p>
          )}
          {params.status === "error" && (
            <p className="rounded-input bg-rose/10 px-4 py-3 text-sm font-semibold text-terracotta">
              Udfyld navn, e-mail og besked. Beskeden må højst være 500 tegn.
            </p>
          )}
          {params.status === "send-error" && (
            <p className="rounded-input bg-rose/10 px-4 py-3 text-sm font-semibold text-terracotta">
              Din besked kunne desværre ikke sendes lige nu. Prøv igen om lidt.
            </p>
          )}
          <ContactForm />
          <div className="grid gap-3 text-sm leading-6 text-ink/70">
            <p className="flex items-start gap-3 rounded-[18px] bg-white/70 p-4">
              <MessageCircle className="mt-0.5 size-5 shrink-0 text-[#7A4EAB]" aria-hidden="true" />
              Vi vender tilbage hurtigst muligt og hjælper dig videre på en rolig og ordentlig måde.
            </p>
            <p className="flex items-start gap-3 rounded-[18px] bg-white/70 p-4">
              <Mail className="mt-0.5 size-5 shrink-0 text-[#7A4EAB]" aria-hidden="true" />
              Du kan også skrive direkte til kontakt@soulevents.dk.
            </p>
          </div>
        </div>
      </section>

      <SiteFooterLogin />
    </main>
  );
}
