import { SubmissionProgress } from "@/components/submissions/SubmissionProgress";

export default function SubmissionPendingPage({ params }: { params: { id: string } }) {
  return <SubmissionProgress submissionId={params.id} />;
}
