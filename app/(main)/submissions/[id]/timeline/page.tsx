import { TimelineBoard } from "@/components/report/TimelineBoard";

export default function SubmissionTimelinePage({ params }: { params: { id: string } }) {
  return <TimelineBoard submissionId={params.id} />;
}
