import { IdeShell } from "@/components/ide/IdeShell";

export default async function IdePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <IdeShell sessionId={sessionId} />;
}
