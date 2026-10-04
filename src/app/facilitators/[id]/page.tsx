import FacilitatorProfilePage from "@/components/facilitator/facilitator-profile-page";

export const revalidate = 300;
export { generateMetadata, generateStaticParams } from "@/components/facilitator/facilitator-profile-page";

export default async function PublicFacilitatorPage({ params }: { params: Promise<{ id?: string; slug?: string }> }) {
  return FacilitatorProfilePage({ params });
}
