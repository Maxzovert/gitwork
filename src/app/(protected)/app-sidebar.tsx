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
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Bot,
  FolderGit2,
  GitPullRequestArrow,
  LayoutDashboard,
  Presentation,
  Settings,
  Tag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { GitworkLogo } from "@/components/gitwork-logo";

function Appsidebar() {
  const pathname = usePathname();
  const { open } = useSidebar();

  const items = [
    { title: "All projects", url: "/projects", icon: FolderGit2 },
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Overview", url: "/overview", icon: BookOpen },
    { title: "Q&A", url: "/qa", icon: Bot },
    { title: "Meetings", url: "/meetings", icon: Presentation },
    { title: "PR Digests", url: "/pr-digests", icon: GitPullRequestArrow },
    { title: "Releases", url: "/releases", icon: Tag },
    { title: "Team", url: "/team", icon: Users },
    { title: "Settings", url: "/settings", icon: Settings },
  ];

  return (
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
        <Link href="/projects" className="flex items-center">
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
      </SidebarContent>
      <SidebarRail className="hover:after:bg-[#d1cdc7]" />
    </Sidebar>
  );
}

export default Appsidebar;
