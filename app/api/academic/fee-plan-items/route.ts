import { NextResponse } from "next/server";
import { z } from "zod";
import {
  svcAddFeePlanItem,
  svcListFeePlanItems,
  svcListAllFeePlanItems,
} from "@/lib/services/academic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fee_plan_id = searchParams.get("fee_plan_id");

    if (!fee_plan_id) {
      // Return all fee plan items if no specific plan is requested
      const data = await svcListAllFeePlanItems();
      return NextResponse.json(data);
    }

    const data = await svcListFeePlanItems(fee_plan_id);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

const CreateFeePlanItemSchema = z.object({
  fee_plan_id: z.string().uuid(),
  component_id: z.string().uuid(),
  amount: z.number().min(0),
  year_number: z.union([z.number().int().min(1), z.null()]).optional(),
  is_admission_phase: z.boolean().default(false),
  notes: z.union([z.string(), z.null()]).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Received request body:", body);

    const input = CreateFeePlanItemSchema.parse(body);
    console.log("Parsed input:", input);

    const created = await svcAddFeePlanItem(input);
    console.log("Created item:", created);

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    console.error("POST fee-plan-items error:", error);

    if (error instanceof z.ZodError) {
      const message = `Validation error: ${JSON.stringify(error.issues)}`;
      return NextResponse.json({ error: { message } }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Detailed error:", message);

    // Check for specific error types
    if (message.includes("duplicate key value violates unique constraint")) {
      return NextResponse.json(
        {
          error: {
            message:
              "A fee plan item with this combination of plan, component, year, and admission phase already exists",
          },
        },
        { status: 409 }
      );
    }

    if (message.includes("does not exist")) {
      return NextResponse.json(
        {
          error: {
            message: message,
          },
        },
        { status: 400 }
      );
    }

    if (message.includes("violates foreign key constraint")) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid fee plan or component ID",
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
