import { SubmissionProgress } from "@/components/submissions/SubmissionProgress";

export default async function SubmissionPendingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubmissionProgress submissionId={id} />;
}
