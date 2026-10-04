import type { Metadata } from "next";
import FacilitatorProfilePage from "@/components/facilitator/facilitator-profile-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Forhåndsvisning af arrangør", robots: { index: false, follow: false } };

export default async function AdminFacilitatorPreview({ params }: { params: Promise<{ id: string }> }) {
  return FacilitatorProfilePage({ params, adminPreview: true });
}
