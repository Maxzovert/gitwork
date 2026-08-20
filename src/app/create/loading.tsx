import { WorkspaceLoader } from "@/components/workspace-loader";

export default function CreateLoading() {
  return (
    <WorkspaceLoader
      title="Almost there"
      message="Loading project setup…"
      progress={55}
    />
  );
}
