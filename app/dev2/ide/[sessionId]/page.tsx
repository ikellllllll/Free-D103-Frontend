import { Dev2IdeShell } from "@/components/dev2/Dev2IdeShell";

export default async function Dev2IdePage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <Dev2IdeShell sessionId={sessionId} />;
}
