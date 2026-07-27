import type { Appearance } from "@clerk/types";

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "#141413",
    colorBackground: "#fcfbfa",
    colorText: "#141413",
    colorTextSecondary: "#696969",
    colorInputBackground: "#ffffff",
    colorInputText: "#141413",
    borderRadius: "20px",
    fontFamily: "var(--font-sofia), Sofia Sans, Arial, sans-serif",
  },
  elements: {
    rootBox: "mx-auto w-full max-w-md",
    card: "shadow-[rgba(0,0,0,0.08)_0px_24px_48px_0px] border-0 bg-[#fcfbfa] rounded-[40px]",
    headerTitle: "font-medium tracking-[-0.02em]",
    headerSubtitle: "text-[#696969]",
    formButtonPrimary:
      "bg-[#141413] hover:bg-[#262627] text-[#f3f0ee] rounded-[20px] shadow-none",
    footerActionLink: "text-[#3860be] hover:text-[#141413]",
  },
};
