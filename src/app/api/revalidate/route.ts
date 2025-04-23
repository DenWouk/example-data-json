import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function GET(): Promise<NextResponse> {
  try {
    // Revalidate the home page
    revalidatePath("/");

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (error) {
    console.error("Error revalidating:", error);
    return NextResponse.json(
      { error: "Failed to revalidate" },
      { status: 500 }
    );
  }
}

// Specify that this route should run in the Node.js runtime, not Edge
export const runtime = "nodejs";
