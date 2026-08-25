import { TeamMemberDetailClient } from "@/components/team/TeamMemberDetailClient";

export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamMemberDetailClient userId={id} />;
}
