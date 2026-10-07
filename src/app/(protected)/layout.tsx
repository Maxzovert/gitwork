import { SidebarProvider } from "@/components/ui/sidebar";
import { ensureDbUser } from "@/lib/ensure-user";
import React from "react";
import { redirect } from "next/navigation";
import Appsidebar from "./app-sidebar";
import { AppTopBar } from "@/components/app-top-bar";
import { AppBootGate } from "@/components/app-boot-gate";
import { getSessionUser } from "@/lib/auth0";

export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
};

const SidebarLayout = async ({ children }: Props) => {
  const user = await getSessionUser();
  if (!user?.userId) {
    redirect("/sign-in");
  }
  await ensureDbUser();

  return (
    <SidebarProvider>
      <AppBootGate>
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
      </AppBootGate>
    </SidebarProvider>
  );
};

export default SidebarLayout;
