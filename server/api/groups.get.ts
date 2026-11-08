import type { GroupRow } from "../utils/db";
import { listGroups } from "../utils/db";

export default defineEventHandler(
  async (event): Promise<{ groups: GroupRow[]; total: number }> => {
    const env = event.context.cloudflare?.env;
    if (!env?.DB) {
      throw createError({
        statusCode: 500,
        statusMessage: "D1 binding 'DB' is not available",
      });
    }

    const groups = await listGroups(env.DB);
    return {
      groups,
      total: groups.reduce((sum, g) => sum + g.count, 0),
    };
  },
);
