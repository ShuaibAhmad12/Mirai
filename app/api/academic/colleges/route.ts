// app/api/academic/colleges/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { svcCreateCollege, svcListColleges } from "@/lib/services/academic";

export async function GET() {
  try {
    const data = await svcListColleges();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

const CreateCollegeSchema = z
  .object({
    code: z.string().min(1).max(50).optional().or(z.literal("")),
    name: z
      .string()
      .min(1, "College name is required")
      .max(200, "College name must be less than 200 characters"),
    address: z
      .string()
      .max(500, "Address must be less than 500 characters")
      .optional()
      .or(z.literal("")),
    website: z
      .string()
      .max(200, "Website must be less than 200 characters")
      .optional()
      .or(z.literal("")),
    email: z
      .string()
      .email("Invalid email format")
      .max(100, "Email must be less than 100 characters")
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .max(20, "Phone must be less than 20 characters")
      .optional()
      .or(z.literal("")),
    affiliation: z
      .string()
      .max(200, "Affiliation must be less than 200 characters")
      .optional()
      .or(z.literal("")),
    approved_by: z
      .string()
      .max(100, "Approved by must be less than 100 characters")
      .optional()
      .or(z.literal("")),
    admission_number: z.number().int().min(0).optional(),
    status: z.number().int().min(0).max(1).optional(),
  })
  .transform((data) => ({
    ...data,
    code: data.code === "" ? null : data.code ?? null,
    address: data.address === "" ? null : data.address ?? null,
    website: data.website === "" ? null : data.website ?? null,
    email: data.email === "" ? null : data.email ?? null,
    phone: data.phone === "" ? null : data.phone ?? null,
    affiliation: data.affiliation === "" ? null : data.affiliation ?? null,
    approved_by: data.approved_by === "" ? null : data.approved_by ?? null,
    admission_number:
      typeof data.admission_number === "number" ? data.admission_number : 10000,
  }));

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Received college data:", body);
    const input = CreateCollegeSchema.parse(body);
    console.log("Validated input:", input);
    const created = await svcCreateCollege(input);
    console.log("Created college:", created);
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    console.error("College creation error:", error);
    if (error instanceof z.ZodError) {
      const message = `Validation error: ${error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ")}`;
      return NextResponse.json({ error: { message } }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
