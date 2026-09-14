import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { parseAlertText } from "@/lib/ai/parser";

const prisma = new PrismaClient();

const CreateAlertSchema = z.object({
  userId: z.string().min(1),
  rawText: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

    const parsed = CreateAlertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

    try {
    const { userId, rawText } = parsed.data;

    // Run AI parser on the raw text
    const parsedAlert = await parseAlertText(rawText);

    // Save alert to DB
    const alert = await prisma.alert.create({
      data: {
        userId,
        rawText,
        roles: parsedAlert.roles,
        skills: parsedAlert.skills,
        locations: parsedAlert.locations,
        remotePreference: parsedAlert.remotePreference,
        excludeTerms: parsedAlert.excludeTerms,
        unknowns: parsedAlert.unknowns,
        parseFallback: parsedAlert.parseFallback,
        promptVersion: process.env.LLM_PROVIDER ?? "fake",
      },
    });


        return NextResponse.json({
      ok: true,
      alert: {
        id: alert.id,
        userId: alert.userId,
        rawText: alert.rawText,
        parsedFilters: {
          roles: alert.roles,
          skills: alert.skills,
          locations: alert.locations,
          remotePreference: alert.remotePreference,
          excludeTerms: alert.excludeTerms,
        },
        parseFallback: alert.parseFallback,
        createdAt: alert.createdAt,
      },
    });

    

  } catch (err) {
    console.error("[alerts] error", err);
    return NextResponse.json(
      { error: "Failed to create alert", message: String(err) },
      { status: 500 }
    );
  }
}
