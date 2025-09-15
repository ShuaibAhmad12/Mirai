import { NextResponse } from "next/server";
import { z } from "zod";
import { svcDeleteFeePlan, svcUpdateFeePlan } from "@/lib/services/academic";

const UpdateFeePlanSchema = z.object({
  course_id: z.string().uuid().optional(),
  session_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  status: z.number().optional(),
  effective_start: z.string().optional(),
  effective_end: z.string().optional(),
});

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const json = await request.json();
    console.log("Received fee plan update data:", json);

    const validatedData = UpdateFeePlanSchema.parse(json);
    console.log("Validated input:", validatedData);

    await svcUpdateFeePlan(params.id, validatedData);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: "Invalid input", details: error.issues } },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Fee plan update error:", error);
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    await svcDeleteFeePlan(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Fee plan deletion error:", error);
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
