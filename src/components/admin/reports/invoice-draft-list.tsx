import { CheckCircle2 } from "lucide-react";
import { approveInvoiceDraftAction } from "@/app/admin/reports/actions";
import type { InvoiceStatus } from "@/types/database";

type InvoiceDraft = {
  id: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
  total_commission_cents: number;
  payment_due_date: string | null;
  payment_reference: string | null;
  created_at: string;
  facilitator_profiles:
    | {
        company_name: string | null;
        profiles:
          | {
              full_name: string;
            }
          | Array<{
              full_name: string;
            }>
          | null;
      }
    | Array<{
        company_name: string | null;
        profiles:
          | {
              full_name: string;
            }
          | Array<{
              full_name: string;
            }>
          | null;
      }>
    | null;
  monthly_reports:
    | {
        total_bookings: number;
        total_seats: number;
        booking_value_cents: number;
      }
    | Array<{
        total_bookings: number;
        total_seats: number;
        booking_value_cents: number;
      }>
    | null;
};

type InvoiceDraftListProps = {
  invoices: InvoiceDraft[];
};

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Kladde",
  approved: "Godkendt",
  sent: "Sendt",
  paid: "Betalt",
  cancelled: "Annulleret",
};

function facilitatorName(invoice: InvoiceDraft) {
  const facilitator = Array.isArray(invoice.facilitator_profiles)
    ? invoice.facilitator_profiles[0]
    : invoice.facilitator_profiles;
  const profile = Array.isArray(facilitator?.profiles) ? facilitator?.profiles[0] : facilitator?.profiles;
  return facilitator?.company_name || profile?.full_name || "Arrangør";
}

export function InvoiceDraftList({ invoices }: InvoiceDraftListProps) {
  if (invoices.length === 0) {
    return (
      <section className="rounded-md border border-midnight/10 bg-white p-8 text-center shadow-soft">
        <h2 className="text-lg font-semibold text-midnight">Ingen rapportkladder endnu</h2>
        <p className="mt-2 text-sm text-ink/64">Generér en månedsrapport for at oprette første kladde.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-midnight">Rapportkladder</h2>
        <p className="mt-1 text-sm text-ink/64">Kladder kan gennemgås før eksport.</p>
      </div>

      <div className="divide-y divide-midnight/10">
        {invoices.map((invoice) => {
          const report = Array.isArray(invoice.monthly_reports) ? invoice.monthly_reports[0] : invoice.monthly_reports;

          return (
            <article className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]" key={invoice.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink/60">
                  <span className="rounded-md bg-sage-50 px-2.5 py-1 text-sage-700">
                    {statusLabels[invoice.status]}
                  </span>
                  <span>
                    {new Intl.DateTimeFormat("da-DK").format(new Date(invoice.period_start))} -{" "}
                    {new Intl.DateTimeFormat("da-DK").format(new Date(invoice.period_end))}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-midnight">{facilitatorName(invoice)}</h3>
                <div className="mt-3 grid gap-2 text-sm text-ink/72 md:grid-cols-2">
                  <p>
                    <span className="font-semibold text-midnight">Bookingværdi:</span>{" "}
                    {`${new Intl.NumberFormat("da-DK").format((report?.booking_value_cents ?? 0) / 100)} kr.`}
                  </p>
                  <p>
                    <span className="font-semibold text-midnight">Tilmeldinger:</span> {report?.total_bookings ?? 0}
                  </p>
                  <p>
                    <span className="font-semibold text-midnight">Pladser:</span> {report?.total_seats ?? 0}
                  </p>
                  <p>
                    <span className="font-semibold text-midnight">Betalingsfrist:</span>{" "}
                    {invoice.payment_due_date
                      ? new Intl.DateTimeFormat("da-DK").format(new Date(invoice.payment_due_date))
                      : "Ikke sat"}
                  </p>
                  <p>
                    <span className="font-semibold text-midnight">Reference:</span>{" "}
                    {invoice.payment_reference || "Ikke sat"}
                  </p>
                </div>
              </div>

              {invoice.status === "draft" && (
                <form action={approveInvoiceDraftAction}>
                  <input name="invoice_id" type="hidden" value={invoice.id} />
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                    type="submit"
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Godkend kladde
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
