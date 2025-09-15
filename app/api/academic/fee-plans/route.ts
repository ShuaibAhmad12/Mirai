import { NextResponse } from "next/server";
import { z } from "zod";
import {
  svcCreateFeePlan,
  svcListFeePlansByCourse,
  svcListAllFeePlans,
} from "@/lib/services/academic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const course_id = searchParams.get("course_id");
    const session_id = searchParams.get("session_id");

    if (!course_id) {
      // List all fee plans if no course_id specified
      const data = await svcListAllFeePlans();
      return NextResponse.json(data);
    }

    const data = await svcListFeePlansByCourse(course_id, session_id);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

const CreateFeePlanSchema = z.object({
  course_id: z.string().uuid(),
  session_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  currency: z.string().min(1).optional(),
  status: z.number().optional(),
  effective_start: z.string().optional(),
  effective_end: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CreateFeePlanSchema.parse(body);
    const created = await svcCreateFeePlan(input);
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
