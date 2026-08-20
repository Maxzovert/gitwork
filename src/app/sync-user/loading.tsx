import { WorkspaceLoader } from "@/components/workspace-loader";

export default function SyncUserLoading() {
  return (
    <WorkspaceLoader
      title="Welcome in"
      message="Signing you in…"
      progress={18}
    />
  );
}
