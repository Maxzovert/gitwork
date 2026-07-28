import { api } from "@/trpc/react";
import { useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";

const useProjects = () => {
  const { data: projects, isFetched, isPending, isFetching } =
    api.project.getProjects.useQuery();
  const [projectId, setProjectId] = useLocalStorage("gitwork-project-id", "");
  const project = projects?.find((project) => project.id === projectId);

  // Drop stale localStorage selection after soft-delete / list refresh
  useEffect(() => {
    if (!projects) return;
    if (projectId && !projects.some((p) => p.id === projectId)) {
      setProjectId(projects[0]?.id ?? "");
    }
  }, [projects, projectId, setProjectId]);

  return {
    projects,
    project,
    projectId,
    setProjectId,
    isFetched,
    isPending,
    isFetching,
  };
};

export default useProjects;
