import { Resend } from "resend";
import { env } from "@/lib/env";

export function createResendClient() {
  if (!env.resendApiKey) {
    throw new Error("RESEND_API_KEY is missing.");
  }

  return new Resend(env.resendApiKey);
}
