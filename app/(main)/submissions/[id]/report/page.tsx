import { FeedbackReport } from "@/components/report/FeedbackReport";

export default function SubmissionReportPage({ params }: { params: { id: string } }) {
  return <FeedbackReport submissionId={params.id} />;
}
