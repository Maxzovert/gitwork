import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ensureDbUser } from "@/lib/ensure-user";
import { db } from "@/server/db";

const SyncUser = async () => {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  await ensureDbUser();

  const projectCount = await db.userToProject.count({
    where: {
      userId,
      project: {
        deletedAt: null,
      },
    },
  });

  redirect(projectCount > 0 ? "/dashboard" : "/create");
};

export default SyncUser;
