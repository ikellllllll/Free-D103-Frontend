import { IdeShell } from "@/components/ide/IdeShell";

export default function IdePage({ params }: { params: { sessionId: string } }) {
  return <IdeShell sessionId={params.sessionId} />;
}
