"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

function reportsRedirect(message: string): never {
  redirect(`/admin/reports?message=${encodeURIComponent(message)}`);
}

function monthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    reportsRedirect("Vælg en gyldig måned.");
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const periodStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const periodEnd = new Date(Date.UTC(year, monthNumber, 0));

  return {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    from: `${periodStart.toISOString().slice(0, 10)}T00:00:00.000Z`,
    to: `${periodEnd.toISOString().slice(0, 10)}T23:59:59.999Z`,
  };
}

function dueDateFromPeriodEnd(periodEnd: string) {
  const date = new Date(`${periodEnd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
}

export async function generateMonthlyReportAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const facilitatorId = getString(formData, "facilitator_id");
  const month = getString(formData, "month");
  const bankDetails = getOptionalString(formData, "bank_details");

  if (!facilitatorId) {
    reportsRedirect("Vælg en arrangør.");
  }

  const { periodStart, periodEnd, from, to } = monthBounds(month);
  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, seats, booking_value_cents, commission_cents")
    .eq("facilitator_id", facilitatorId)
    .in("status", ["confirmed", "completed"])
    .gte("created_at", from)
    .lte("created_at", to);

  const rows = bookings ?? [];

  if (rows.length === 0) {
    reportsRedirect("Der er ingen bekræftede tilmeldinger i den valgte periode.");
  }

  const totalBookings = rows.length;
  const totalSeats = rows.reduce((sum, booking) => sum + booking.seats, 0);
  const bookingValueCents = rows.reduce((sum, booking) => sum + booking.booking_value_cents, 0);
  const commissionCents = rows.reduce((sum, booking) => sum + booking.commission_cents, 0);

  const { data: report, error: reportError } = await supabase
    .from("monthly_reports")
    .upsert(
      {
        facilitator_id: facilitatorId,
        period_start: periodStart,
        period_end: periodEnd,
        total_bookings: totalBookings,
        total_seats: totalSeats,
        booking_value_cents: bookingValueCents,
        commission_cents: commissionCents,
      },
      { onConflict: "facilitator_id,period_start,period_end" },
    )
    .select("id")
    .single();

  if (reportError || !report) {
    reportsRedirect("Månedsrapporten kunne ikke gemmes.");
  }

  const paymentReference = `SPIRIT-${periodStart.slice(0, 7)}-${facilitatorId.slice(0, 8).toUpperCase()}`;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoice_drafts")
    .insert({
      facilitator_id: facilitatorId,
      monthly_report_id: report.id,
      status: "draft",
      period_start: periodStart,
      period_end: periodEnd,
      total_commission_cents: commissionCents,
      payment_due_date: dueDateFromPeriodEnd(periodEnd),
      bank_details: bankDetails,
      payment_reference: paymentReference,
      approved_by: adminProfile.id,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    reportsRedirect("Fakturakladden kunne ikke oprettes.");
  }

  const { error: linesError } = await supabase.from("invoice_draft_lines").insert(
    rows.map((booking) => ({
      invoice_draft_id: invoice.id,
      booking_id: booking.id,
      commission_cents: booking.commission_cents,
    })),
  );

  if (linesError) {
    reportsRedirect("Fakturakladden blev oprettet, men linjerne kunne ikke gemmes.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  reportsRedirect("Månedsrapport og fakturakladde er oprettet.");
}

export async function approveInvoiceDraftAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const invoiceId = getString(formData, "invoice_id");

  if (!invoiceId) {
    reportsRedirect("Fakturakladden mangler ID.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoice_drafts")
    .update({
      status: "approved",
      approved_by: adminProfile.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (error) {
    reportsRedirect("Fakturakladden kunne ikke godkendes.");
  }

  revalidatePath("/admin/reports");
  reportsRedirect("Fakturakladden er godkendt.");
}
