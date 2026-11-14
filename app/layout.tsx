import type { Metadata } from "next";
import { Archivo, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Same two families the kitchen frame loads, self-hosted so a page view
// makes no third-party request.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Home",
  description: "A kitchen wall display with a private web dashboard",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
