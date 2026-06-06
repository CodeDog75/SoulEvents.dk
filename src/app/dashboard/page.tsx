import { redirect } from "next/navigation";
import { getDashboardPath, requireProfile } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireProfile();

  redirect(getDashboardPath(profile.role));
}
