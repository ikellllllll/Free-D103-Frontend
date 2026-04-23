import { DevProblemDetailSwitch } from "@/components/dev/DevProblemDetailSwitch";

export default async function DevProblemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DevProblemDetailSwitch problemId={id} />;
}
