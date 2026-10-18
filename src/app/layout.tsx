import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { APP_NAME, TEAM_CREDIT } from "@/lib/brand";
import { THEME_SCRIPT } from "@/lib/theme";
import { listConceptOptions } from "@/server/data/concepts";
import { knownLocalities } from "@/server/data/local-market";
import { readServerEnv } from "@/server/env";
import { loadSnapshotFromDisk } from "@/server/qloo/recorded";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["SOFT", "opsz"] });

const description =
  "Find one small business bet worth testing: a specific concept, locality, audience and pilot, grounded in Qloo's taste graph.";

export const metadata: Metadata = {
  title: { default: `${APP_NAME}: find a small business bet worth testing`, template: `%s · ${APP_NAME}` },
  description,
  applicationName: APP_NAME,
  authors: [{ name: "Team VKY" }],
  openGraph: { title: APP_NAME, description, type: "website", siteName: APP_NAME },
  twitter: { card: "summary", title: APP_NAME, description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#123d32" },
    { media: "(prefers-color-scheme: dark)", color: "#101a17" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Rendered per request so the data-source badge reflects the current configuration.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const env = readServerEnv();
  const qlooStatus = env.qlooMode === "live" && env.qlooApiKey ? "live" : loadSnapshotFromDisk() ? "recorded" : "sample";
  const config = { concepts: listConceptOptions(), knownLocalities: { bengaluru: knownLocalities("Bengaluru") }, qlooStatus } as const;
  return (
    // suppressHydrationWarning: the theme script sets data-theme before React hydrates.
    <html lang="en" className={`${inter.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        <Providers config={config}>
          <SiteHeader />
          <main id="content" className="flex-1">
            {children}
          </main>
        </Providers>
        <footer className="no-print mt-8 bg-hero text-white/80">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              <span className="font-semibold text-white">{TEAM_CREDIT}</span> · Built for the Qloo Agentic Hackathon
            </p>
            <p>Cultural signals from Qloo. Costs are illustrative estimates.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
