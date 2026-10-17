import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { APP_NAME, TEAM_CREDIT } from "@/lib/brand";
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

export const viewport: Viewport = { themeColor: "#123d32", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <header className="no-print border-b border-line/70 bg-paper/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload intentionally resets the app */}
            <a href="/" className="flex items-center gap-2 rounded-lg" aria-label={`${APP_NAME} home`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo */}
              <img src="/brand/logo-full.svg" alt={APP_NAME} width={212} height={36} className="h-8 w-auto sm:h-9" />
            </a>
            <p className="hidden items-center gap-2 text-sm text-muted sm:flex">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-spark" />
              Cultural signals → small business bets
            </p>
          </div>
        </header>
        <div id="content" className="flex-1">
          {children}
        </div>
        <footer className="no-print mt-8 bg-brand text-white/80">
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
