import "@/styles/globals.css";

import { type Metadata } from "next";
import { Sofia_Sans } from "next/font/google";
import { Auth0Provider } from "@auth0/nextjs-auth0";

import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Gitwork",
  description:
    "Understand your GitHub repos with AI. Commits, Q&A, and meetings.",
  icons: [{ rel: "icon", url: "/logo.svg" }],
};

const sofia = Sofia_Sans({
  subsets: ["latin"],
  variable: "--font-sofia",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={sofia.variable} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased" suppressHydrationWarning>
        <Auth0Provider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <Toaster richColors position="bottom-right" />
        </Auth0Provider>
      </body>
    </html>
  );
}
