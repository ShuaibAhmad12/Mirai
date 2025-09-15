// app/api/academic/colleges/[id]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { svcDeleteCollege, svcUpdateCollege } from "@/lib/services/academic";

const UpdateCollegeSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(500).optional(),
  website: z.string().min(1).max(200).optional(),
  email: z.string().email().max(100).optional(),
  phone: z.string().min(1).max(20).optional(),
  affiliation: z.string().min(1).max(200).optional(),
  approved_by: z.string().min(1).max(100).optional(),
  admission_number: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch = UpdateCollegeSchema.parse(body);
    await svcUpdateCollege(id, patch);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await svcDeleteCollege(id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
