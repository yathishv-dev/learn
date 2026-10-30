import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vyapaar Voice — Your shop. Your language.",
  description:
    "Understand your shop’s sales, stock and expenses. Speak in English or Kannada, review your entries and get answers from your own business records.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
