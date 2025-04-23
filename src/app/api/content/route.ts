import { type NextRequest, NextResponse } from "next/server";
import { updateHomeContent } from "@/lib/data";
import { z } from "zod";

// Define schema for validation
const contentSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = contentSchema.parse(body);

    // Update content in database
    await updateHomeContent({
      title: validatedData.title,
      description: validatedData.description,
      image: validatedData.image,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error("Error updating content:", error);
    return NextResponse.json(
      { error: "Failed to update content" },
      { status: 500 }
    );
  }
}

// Specify that this route should run in the Node.js runtime, not Edge
export const runtime = "nodejs";
