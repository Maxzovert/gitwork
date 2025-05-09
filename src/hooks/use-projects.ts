import { api } from "@/trpc/react";
import React from "react";
import { useLocalStorage } from "usehooks-ts";

const useProjects = () => {
  const { data: projects } = api.project.getProjects.useQuery();
  const [projectId, setProjectId] = useLocalStorage("gitwork-project-id", " ");
  const project = projects?.find((project) => project.id === projectId);
  return {
    projects,
    project,
    projectId,
    setProjectId,
  };
};

export default useProjects;
