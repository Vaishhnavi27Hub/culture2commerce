import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { APP_NAME, TEAM_CREDIT } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });

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

export const viewport: Viewport = { themeColor: "#14122b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <header className="no-print border-b border-line bg-card">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload intentionally resets the app */}
            <a href="/" className="flex items-center gap-2" aria-label={`${APP_NAME} home`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo */}
              <img src="/brand/logo-full.svg" alt={APP_NAME} width={212} height={36} className="h-9 w-auto" />
            </a>
            <p className="hidden text-sm text-muted sm:block">Micro-business opportunity discovery agent</p>
          </div>
        </header>
        <div id="content" className="flex-1">
          {children}
        </div>
        <footer className="no-print border-t border-line bg-card">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              <span className="font-semibold text-ink">{TEAM_CREDIT}</span> · Built for the Qloo Agentic Hackathon
            </p>
            <p>Cultural signals from Qloo. Costs are illustrative estimates.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
