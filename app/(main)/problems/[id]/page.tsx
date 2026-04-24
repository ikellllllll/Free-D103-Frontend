import { Dev2ProblemDetail } from "@/components/dev2/Dev2ProblemDetail";

export default async function Dev2ProblemDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Dev2ProblemDetail problemId={id} />;
}
