import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoulEvents.dk",
  description: "Find events, arrangører og fællesskaber i Danmark.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
