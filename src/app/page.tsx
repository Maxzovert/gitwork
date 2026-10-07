import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth0";
import LandingPage from "./landing-page";

export default async function Home() {
  const user = await getSessionUser();
  if (user?.userId) {
    redirect("/projects");
  }

  return <LandingPage />;
}
