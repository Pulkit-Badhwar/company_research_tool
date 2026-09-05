import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: "5rem", margin: 0 }}>404</h1>
        <h2 style={{ marginTop: "1rem", marginBottom: 0 }}>Page not found</h2>
        <p style={{ color: "#5f6787", marginTop: "0.75rem" }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div style={{ marginTop: "1.5rem" }}>
          <Link to="/" style={{ display: "inline-block", padding: "0.8rem 1.2rem", borderRadius: 16, background: "#5a46d9", color: "#fff", fontWeight: 600 }}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  useEffect(() => {
    // no-op: keep this simple and avoid external telemetry hooks.
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>This page didn't load</h1>
        <p style={{ color: "#5f6787", marginTop: "0.75rem" }}>
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            style={{ padding: "0.8rem 1.2rem", borderRadius: 14, border: "none", background: "#5a46d9", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
          <a href="/" style={{ display: "inline-block", padding: "0.8rem 1.2rem", borderRadius: 14, border: "1px solid rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.45)", color: "#1a1d2d", fontWeight: 600 }}>
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Research Frontend — Company Research" },
      { name: "description", content: "Live AI-generated company research reports for sales teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
