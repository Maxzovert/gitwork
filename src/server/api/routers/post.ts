import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

/** Legacy demo router kept for API shape compatibility. */
export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
});
