import type { Metadata } from "next";
import { Raleway, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Verkeer | Retainer, Capacity & Overservicing Dashboard",
  description: "Contracted, planned, actual, and forecast hours — Verkeer Digital Marketing Agency.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/favicon-96x96.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${raleway.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#f7f7f8] text-[#121212] selection:bg-[#b5018b]/20 selection:text-[#121212]">
        <TooltipProvider delay={120}>{children}</TooltipProvider>
      </body>
    </html>
  );
}

