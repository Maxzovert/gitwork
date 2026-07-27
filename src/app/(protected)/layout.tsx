import { SidebarProvider } from "@/components/ui/sidebar";
import { ensureDbUser } from "@/lib/ensure-user";
import React from "react";
import Appsidebar from "./app-sidebar";
import { AppTopBar } from "@/components/app-top-bar";

type Props = {
  children: React.ReactNode;
};

const SidebarLayout = async ({ children }: Props) => {
  await ensureDbUser();

  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full bg-[#f3f0ee]">
        <Appsidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopBar />
          <main className="relative flex-1 overflow-y-auto">
            <div className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default SidebarLayout;
