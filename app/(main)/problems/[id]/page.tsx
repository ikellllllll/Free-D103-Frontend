import { ProblemDetail } from "@/components/problems/ProblemDetail";

export default function ProblemDetailPage({ params }: { params: { id: string } }) {
  return <ProblemDetail problemId={params.id} />;
}
