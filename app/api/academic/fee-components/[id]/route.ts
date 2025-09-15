import { NextResponse } from "next/server";
import { z } from "zod";
import {
  svcUpdateFeeComponent,
  svcDeleteFeeComponent,
} from "@/lib/services/academic";

const UpdateFeeComponentSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(200).optional(),
  frequency: z.string().min(1).optional(),
  description: z.string().optional(),
});

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const json = await request.json();
    console.log("Received fee component update data:", json);

    const validatedData = UpdateFeeComponentSchema.parse(json);
    console.log("Validated input:", validatedData);

    await svcUpdateFeeComponent(params.id, validatedData);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: "Invalid input", details: error.issues } },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Fee component update error:", error);
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    await svcDeleteFeeComponent(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Fee component deletion error:", error);
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
