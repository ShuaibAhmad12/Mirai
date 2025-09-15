import { NextResponse } from "next/server";
import { z } from "zod";
import { svcCreateSession, svcListSessions } from "@/lib/services/academic";

export async function GET() {
  try {
    const data = await svcListSessions();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

const CreateSessionSchema = z.object({
  title: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  is_current: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CreateSessionSchema.parse(body);
    const created = await svcCreateSession(input);
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const message = error.message;
      return NextResponse.json({ error: { message } }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
