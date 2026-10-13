import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Culture2Commerce",
  description:
    "Find one small business bet worth testing: a specific concept, locality, audience and pilot, grounded in Qloo's taste graph.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
