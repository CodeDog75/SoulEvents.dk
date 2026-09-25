import Link from "next/link";

export function InvalidCoOrganizerInvitation() {
  return (
    <main className="min-h-screen bg-cream px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-2xl rounded-card bg-white p-6 shadow-soft sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Invitation til samarbejde</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-midnight">Invitationen er ikke længere gyldig</h1>
        <p className="mt-4 text-sm leading-6 text-ink/70">
          Dette link kan ikke længere bruges. Bed arrangøren af eventet om at sende dig en ny invitation som medarrangør.
        </p>
        <Link className="mt-6 inline-flex h-11 items-center justify-center rounded-button bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft" href="/facilitator">
          Gå til arrangørdashboard
        </Link>
      </section>
    </main>
  );
}
