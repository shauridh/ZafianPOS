import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sabana POS",
  description: "Kasir dan operasional fried chicken",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
