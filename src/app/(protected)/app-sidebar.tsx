"use client";
import { Button } from "@/components/ui/button";
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
  useSidebar,
} from "@/components/ui/sidebar";
import useProjects from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import { Bot, CreditCard, LayoutDashboard, Plus, Presentation } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

function Appsidebar() {
  const pathname = usePathname();
  const {open} = useSidebar();
  const {projects , projectId , setProjectId} = useProjects();
  const items = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Q&A",
      url: "/qa",
      icon: Bot,
    },
    {
      title: "Neetings",
      url: "/meetings",
      icon: Presentation,
    },
    {
      title: "Billing",
      url: "/billing",
      icon: CreditCard,
    },
  ];
  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <div className="flex items-center gap-2 ml-2">
            <Image src='/logo.png' alt="logo" width={40} height={40}/>
            {open && (
                <h1 className="text-xl font-bold text-primary/80">Gitwork</h1>
            )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Application group */}
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link
                        href={item.url}
                        className={cn({
                          "!bg-primary !text-white": pathname === item.url,
                        })}
                      >
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

        {/* Project List */}
        <SidebarGroup>
          <SidebarGroupLabel>Your Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects?.map((project) => {
                return (
                  <SidebarMenuItem key={project.name}>
                    <SidebarMenuButton asChild>
                      <div onClick={() => setProjectId(project.id)}>
                        <div
                          className={cn(
                            "text-primaryS flex size-6 items-center justify-center rounded-sm border bg-white text-sm cursor-pointer",
                            { "bg-primary text-white": project.id === projectId },
                          )}
                        >
                          {project.name[0]}
                        </div>
                        <span className="cursor-pointer">{project.name}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              <div className="h-2"></div>
              {open ? (
              <SidebarMenuItem>
                <Link href='/create'>
              <Button size='sm' variant={'outline'} className="w-fit cursor-pointer">
                <Plus/>
                Create Project
              </Button>
                </Link>
              </SidebarMenuItem> 
              ) : (
                <SidebarMenuItem>
                <Link href='/create'>
              <Button size='sm' variant={'outline'} className="w-fit cursor-pointer">
                <Plus/>
              </Button>
                </Link>
              </SidebarMenuItem>
              )
              }
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


      </SidebarContent>
    </Sidebar>
  );
}

export default Appsidebar;
