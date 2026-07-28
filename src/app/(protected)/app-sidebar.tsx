"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import useProjects from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import {
  Bot,
  GitPullRequestArrow,
  LayoutDashboard,
  Plus,
  Presentation,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import { GitworkLogo } from "@/components/gitwork-logo";
import { CreateProjectDialog } from "@/components/create-project-dialog";

function Appsidebar() {
  const pathname = usePathname();
  const { open } = useSidebar();
  const { projects, projectId, setProjectId } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);

  const items = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Q&A", url: "/qa", icon: Bot },
    { title: "Meetings", url: "/meetings", icon: Presentation },
    { title: "PR Digests", url: "/pr-digests", icon: GitPullRequestArrow },
    { title: "Team", url: "/team", icon: Users },
  ];

  return (
    <>
      <Sidebar
        collapsible="icon"
        variant="sidebar"
        className={cn(
          "border-r border-[#d1cdc7]",
          "[&_[data-slot=sidebar-inner]]:bg-[#f3f0ee]",
          "[&_[data-slot=sidebar-inner]]:text-[#141413]",
        )}
      >
        <SidebarHeader className="bg-[#f3f0ee] px-4 pt-5 pb-4">
          <Link href="/dashboard" className="flex items-center">
            <GitworkLogo size={28} withWordmark={open} />
          </Link>
        </SidebarHeader>

        <SidebarContent className="bg-[#f3f0ee] px-3 pb-4">
          <SidebarGroup className="p-0">
            {open ? (
              <SidebarGroupLabel className="mb-2 h-auto px-2 py-0 text-[11px] font-bold tracking-[0.08em] text-[#696969] uppercase">
                <span className="inline-flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#cf4500]" />
                  Application
                </span>
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {items.map((item) => {
                  const isActive =
                    pathname === item.url ||
                    (item.url !== "/dashboard" &&
                      pathname.startsWith(`${item.url}/`));
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={cn(
                          "h-10 rounded-xl px-3 font-medium tracking-[-0.02em]",
                          "text-[#141413] hover:bg-white hover:text-[#141413]",
                          "data-[active=true]:bg-[#141413] data-[active=true]:text-[#f3f0ee]",
                          "data-[active=true]:hover:bg-[#141413] data-[active=true]:hover:text-[#f3f0ee]",
                        )}
                      >
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-5 p-0">
            {open ? (
              <SidebarGroupLabel className="mb-2 h-auto px-2 py-0 text-[11px] font-bold tracking-[0.08em] text-[#696969] uppercase">
                <span className="inline-flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#cf4500]" />
                  Projects
                </span>
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {projects?.map((project) => {
                  const isSelected = project.id === projectId;
                  return (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton
                        isActive={isSelected}
                        tooltip={project.name}
                        onClick={() => setProjectId(project.id)}
                        className={cn(
                          "h-10 cursor-pointer rounded-xl px-3 tracking-[-0.02em]",
                          "text-[#141413] hover:bg-white hover:text-[#141413]",
                          isSelected &&
                            "bg-white font-medium text-[#141413] shadow-sm ring-1 ring-[#d1cdc7] hover:bg-white",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                            isSelected
                              ? "bg-[#141413] text-[#f3f0ee]"
                              : "bg-white text-[#141413] ring-1 ring-[#d1cdc7]",
                          )}
                        >
                          {project.name[0]?.toUpperCase()}
                        </div>
                        <span className="truncate">{project.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}

                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Create Project"
                    onClick={() => setCreateOpen(true)}
                    className="mt-1 h-10 cursor-pointer rounded-xl border border-dashed border-[#d1cdc7] bg-transparent px-3 text-[#141413] hover:bg-white hover:text-[#141413]"
                  >
                    <Plus />
                    <span className="font-medium tracking-[-0.02em]">
                      New project
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail className="hover:after:bg-[#d1cdc7]" />
      </Sidebar>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

export default Appsidebar;
