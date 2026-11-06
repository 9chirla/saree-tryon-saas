import type { Metadata } from "next";
import { Playfair_Display, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Trail9 — Your Saree. Virtually.",
  description: "Try · Explore · Choose — AI virtual saree try-on for Indian textile retailers",
  icons: {
    icon: "/brand/favicon.png",
    apple: "/brand/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-[family-name:var(--font-sans)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
