import { NextResponse } from "next/server";
import { processOutbox } from "@/lib/outbox/worker";

export async function POST() {
  try {
    const result = await processOutbox();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[outbox] error", err);
    return NextResponse.json(
      { error: "Outbox failed", message: String(err) },
      { status: 500 }
    );
  }
}