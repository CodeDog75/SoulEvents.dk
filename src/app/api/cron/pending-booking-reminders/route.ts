import { NextResponse, type NextRequest } from "next/server";
import { sendPendingBookingReminderBatch } from "@/lib/email/pending-booking-reminder";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && process.env.NODE_ENV !== "production") {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendPendingBookingReminderBatch();
  return NextResponse.json(result);
}

