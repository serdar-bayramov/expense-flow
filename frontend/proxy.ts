import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/privacy',
  '/terms',
  '/contact',
  '/docs',
]);

export default clerkMiddleware(async (auth, request) => {
  try {
    const path = request.nextUrl.pathname;
    console.log('🔍 Middleware called for:', path);
    console.log('🔍 Is public route:', isPublicRoute(request));
    console.log('🔍 CLERK_PUBLISHABLE_KEY exists:', !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
    
    // Only protect routes that are NOT public
    if (!isPublicRoute(request)) {
      console.log('🔒 Protecting route:', path);
      await auth.protect();
    }
    
    console.log('✅ Middleware completed for:', path);
  } catch (error) {
    console.error('❌ Middleware error:', error);
    throw error;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
