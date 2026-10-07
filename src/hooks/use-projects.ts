import { api } from "@/trpc/react";
import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

const useProjects = () => {
  const { data: projects, isFetched, isPending, isFetching } =
    api.project.getProjects.useQuery();
  const [projectId, setProjectId] = useLocalStorage("gitwork-project-id", "", {
    initializeWithValue: false,
  });
  // First client render is "" until useLocalStorage reads storage.
  // Callers must not treat that empty value as "no project chosen".
  const [projectIdReady, setProjectIdReady] = useState(false);
  const project = projects?.find((project) => project.id === projectId);

  useEffect(() => {
    setProjectIdReady(true);
  }, []);

  // Clear stale selection after soft-delete — do not auto-open another project.
  // Opening a workspace is explicit via /projects → Open dashboard.
  useEffect(() => {
    if (!projectIdReady || !isFetched || !projects) return;
    if (projectId && !projects.some((p) => p.id === projectId)) {
      setProjectId("");
    }
  }, [projectIdReady, isFetched, projects, projectId, setProjectId]);

  return {
    projects,
    project,
    projectId,
    setProjectId,
    projectIdReady,
    isFetched,
    isPending,
    isFetching,
  };
};

export default useProjects;
