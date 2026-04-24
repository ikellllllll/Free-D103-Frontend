import { TimelineBoard } from "@/components/report/TimelineBoard";

export default async function SubmissionTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TimelineBoard submissionId={id} />;
}
