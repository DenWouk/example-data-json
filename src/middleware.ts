import { type NextRequest, NextResponse } from "next/server"

// This is a simple middleware to protect the admin route
// In a real application, you would implement proper authentication
export function middleware(request: NextRequest) {
  // Check if the request is for the admin route
  if (request.nextUrl.pathname.startsWith("/admin")) {
    // In a real app, you would check for authentication here
    // For this example, we'll use a simple secret query parameter
    const secretKey = request.nextUrl.searchParams.get("key")

    if (secretKey !== "your-secret-key") {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
