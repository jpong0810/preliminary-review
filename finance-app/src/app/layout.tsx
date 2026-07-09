import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Personal Finance & Research Dashboard",
  description: "Single-user finance tracker and research workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NavBar />
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
