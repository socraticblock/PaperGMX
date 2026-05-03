import { NextResponse } from "next/server";

/**
 * Prove what Vercel deployed (compare to `git rev-parse HEAD` locally).
 * Vercel: https://vercel.com/docs/projects/environment-variables/system-environment-variables
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    vercelCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
  });
}
