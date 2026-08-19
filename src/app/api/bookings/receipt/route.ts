import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { bookingReceiptCookieName } from "@/lib/bookings/receipt-cookie";
import { parsePaymentInstructionsSnapshot } from "@/lib/payment-instructions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId");
  const receiptToken = (await cookies()).get(bookingReceiptCookieName)?.value ?? null;

  if (!isUuid(eventId) || !receiptToken) {
    return NextResponse.json({ receipt: null });
  }

  const { data: booking } = await createAdminClient()
    .from("bookings")
    .select("event_id, seats, booking_value_cents, payment_instructions_snapshot")
    .eq("event_id", eventId)
    .eq("participant_access_token", receiptToken)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ receipt: null });
  }

  return NextResponse.json({
    receipt: {
      paymentInstructions:
        booking.booking_value_cents > 0
          ? parsePaymentInstructionsSnapshot(booking.payment_instructions_snapshot)
          : null,
      seats: booking.seats,
    },
  });
}
