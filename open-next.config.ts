import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";

// How Next.js caching works on Cloudflare Workers (OpenNext). The site relies on all three:
//   - incremental cache: ISR pages (`export const revalidate = 60` on the home page) and cached
//     anonymous API reads (`next: { revalidate }` in src/lib/api/server.ts). Stored in R2
//     (binding NEXT_INC_CACHE_R2_BUCKET), with a per-colo cache in front so hits stay fast.
//   - tag cache: revalidatePath() from /api/revalidate (signed calls from gventz-api) and from
//     dashboard actions. Durable Objects (NEXT_TAG_CACHE_DO_SHARDED), no extra database.
//   - queue: background regeneration of stale ISR pages (NEXT_CACHE_DO_QUEUE).
// The bindings are declared per environment in wrangler.jsonc.
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  queue: doQueue,
  tagCache: doShardedTagCache({ baseShardSize: 12 }),
  enableCacheInterception: true,
});
