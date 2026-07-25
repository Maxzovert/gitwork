import { ensureDbUser } from "@/lib/ensure-user";
import { redirect } from "next/navigation";

const SyncUser = async () => {
  await ensureDbUser();
  return redirect("/dashboard");
};

export default SyncUser;
