import { Check, Clock3, ExternalLink, Slash, UserRoundCheck } from "lucide-react";
import { updateFacilitatorStatusAction } from "@/app/admin/facilitators/actions";
import type { FacilitatorStatus } from "@/types/database";

type FacilitatorRow = {
  id: string;
  status: FacilitatorStatus;
  company_name: string | null;
  short_description: string | null;
  city: string | null;
  postal_code: string | null;
  website_url: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
  regions: {
    name: string;
  } | null;
  facilitator_categories?: Array<{
    categories: {
      name: string;
    } | null;
  }>;
};

type FacilitatorApprovalTableProps = {
  facilitators: FacilitatorRow[];
};

const statusLabels: Record<FacilitatorStatus, string> = {
  pending: "Afventer",
  approved: "Godkendt",
  disabled: "Deaktiveret",
};

const statusClasses: Record<FacilitatorStatus, string> = {
  pending: "bg-terracotta/10 text-terracotta",
  approved: "bg-sage-50 text-sage-700",
  disabled: "bg-midnight/10 text-midnight",
};

function StatusButton({
  facilitatorId,
  status,
  children,
}: {
  facilitatorId: string;
  status: FacilitatorStatus;
  children: React.ReactNode;
}) {
  return (
    <form action={updateFacilitatorStatusAction}>
      <input name="facilitator_id" type="hidden" value={facilitatorId} />
      <input name="status" type="hidden" value={status} />
      <button
        className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
        type="submit"
      >
        {children}
      </button>
    </form>
  );
}

export function FacilitatorApprovalTable({ facilitators }: FacilitatorApprovalTableProps) {
  if (facilitators.length === 0) {
    return (
      <section className="rounded-md border border-midnight/10 bg-white p-8 text-center shadow-soft">
        <UserRoundCheck className="mx-auto size-8 text-sage-700" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold text-midnight">Ingen værter matcher filteret</h2>
        <p className="mt-2 text-sm text-ink/64">Når nye værter opretter sig, vises de her.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-midnight">Vært-godkendelse</h2>
        <p className="mt-1 text-sm text-ink/64">Gennemgå profiler og styr offentlig synlighed.</p>
      </div>

      <div className="divide-y divide-midnight/10">
        {facilitators.map((facilitator) => {
          const categories =
            facilitator.facilitator_categories
              ?.map((row) => row.categories?.name)
              .filter((name): name is string => Boolean(name)) ?? [];

          return (
            <article className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]" key={facilitator.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusClasses[facilitator.status]}`}
                  >
                    {statusLabels[facilitator.status]}
                  </span>
                  <span className="text-xs text-ink/52">
                    Oprettet {new Intl.DateTimeFormat("da-DK").format(new Date(facilitator.created_at))}
                  </span>
                </div>

                <h3 className="mt-3 text-lg font-semibold text-midnight">
                  {facilitator.company_name || facilitator.profiles?.full_name || "Uden navn"}
                </h3>
                <p className="mt-1 text-sm text-ink/64">
                  {facilitator.profiles?.full_name} · {facilitator.profiles?.email}
                  {facilitator.profiles?.phone ? ` · ${facilitator.profiles.phone}` : ""}
                </p>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/72">
                  {facilitator.short_description || "Værten har endnu ikke skrevet en kort præsentation."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-ink/68">
                  {(facilitator.city || facilitator.regions?.name) && (
                    <span className="rounded-md bg-sage-50 px-2.5 py-1">
                      {[facilitator.postal_code, facilitator.city, facilitator.regions?.name]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  )}
                  {categories.map((category) => (
                    <span className="rounded-md bg-sand px-2.5 py-1" key={category}>
                      {category}
                    </span>
                  ))}
                  {facilitator.website_url && (
                    <a
                      className="inline-flex items-center gap-1 rounded-md bg-midnight/5 px-2.5 py-1 hover:text-terracotta"
                      href={facilitator.website_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Website
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap content-start gap-2 lg:justify-end">
                {facilitator.status !== "approved" && (
                  <StatusButton facilitatorId={facilitator.id} status="approved">
                    <Check className="size-4" aria-hidden="true" />
                    Godkend
                  </StatusButton>
                )}
                {facilitator.status !== "pending" && (
                  <StatusButton facilitatorId={facilitator.id} status="pending">
                    <Clock3 className="size-4" aria-hidden="true" />
                    Afventer
                  </StatusButton>
                )}
                {facilitator.status !== "disabled" && (
                  <StatusButton facilitatorId={facilitator.id} status="disabled">
                    <Slash className="size-4" aria-hidden="true" />
                    Deaktiver
                  </StatusButton>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
