import { ProblemDetailView } from "@/components/problems/ProblemDetailView";

export default async function ProblemDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProblemDetailView problemId={id} />;
}
