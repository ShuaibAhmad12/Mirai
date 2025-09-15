import { NextResponse } from "next/server";
import { z } from "zod";
import {
  svcDeleteFeePlanItem,
  svcUpdateFeePlanItem,
} from "@/lib/services/academic";

const UpdateFeePlanItemSchema = z.object({
  component_id: z.string().uuid().optional(),
  amount: z.number().min(0).optional(),
  year_number: z.union([z.number().int().min(1), z.null()]).optional(),
  is_admission_phase: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const json = await request.json();
    console.log("Received fee plan item update data:", json);

    const validatedData = UpdateFeePlanItemSchema.parse(json);
    console.log("Validated input:", validatedData);

    await svcUpdateFeePlanItem(params.id, validatedData);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: "Invalid input", details: error.issues } },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Fee plan item update error:", error);
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    await svcDeleteFeePlanItem(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Fee plan item deletion error:", error);
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
