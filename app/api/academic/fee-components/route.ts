import { NextResponse } from "next/server";
import { z } from "zod";
import {
  svcListFeeComponents,
  svcCreateFeeComponent,
} from "@/lib/services/academic";

const CreateFeeComponentSchema = z.object({
  code: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  frequency: z.string().min(1),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const data = await svcListFeeComponents();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    console.log("Received fee component data:", json);

    const validatedData = CreateFeeComponentSchema.parse(json);
    console.log("Validated input:", validatedData);

    const result = await svcCreateFeeComponent(validatedData);
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: "Invalid input", details: error.issues } },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Fee component creation error:", error);
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
