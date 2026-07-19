import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminReportsLegacyPage() {
  redirect("/admin/commission?tab=reports");
}
