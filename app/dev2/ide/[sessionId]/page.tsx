import { IdeShell } from "@/components/ide/IdeShell";

export default async function Dev2IdePage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <IdeShell sessionId={sessionId} />;
}
