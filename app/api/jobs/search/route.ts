import { NextRequest, NextResponse } from "next/server";
import { searchJobs } from "@/lib/cache/search";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const location = searchParams.get("location") ?? undefined;
    const remote = searchParams.get("remote");
    const skills = searchParams.get("skills");
    const limit = searchParams.get("limit");

    const jobs = await searchJobs({
      location,
      remote: remote === "true" ? true : remote === "false" ? false : undefined,
      skills: skills ? skills.split(",").map((s) => s.trim()) : undefined,
      limit: limit ? parseInt(limit) : 20,
    });

    return NextResponse.json({
      ok: true,
      source: jobs.source,
      count: jobs.jobs.length,
      jobs: jobs.jobs,
    });
  } catch (err) {
    console.error("[search] error", err);
    return NextResponse.json(
      { error: "Search failed", message: String(err) },
      { status: 500 }
    );
  }
}