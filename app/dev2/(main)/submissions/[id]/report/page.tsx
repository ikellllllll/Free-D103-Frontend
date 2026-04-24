import { FeedbackReport } from "@/components/report/FeedbackReport";

export default async function SubmissionReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FeedbackReport submissionId={id} />;
}
