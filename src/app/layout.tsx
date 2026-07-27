import "@/styles/globals.css";

import { type Metadata } from "next";
import { Sofia_Sans } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { ClerkProvider } from "@clerk/nextjs";
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
    <ClerkProvider
      signInForceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/"
    >
      <html lang="en" className={sofia.variable}>
        <body className="min-h-screen font-sans antialiased">
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <Toaster richColors position="bottom-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
