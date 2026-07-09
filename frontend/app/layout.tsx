import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import Header from "@/components/Header";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Keystone — Milestone Escrow on Stellar",
  description:
    "Milestone-based escrow for client/freelancer payments on Stellar Soroban testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} antialiased min-h-screen`}>
        <WalletProvider>
          <Header />
          <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
            {children}
          </main>
          <footer className="border-t hairline py-6 text-center annotation">
            Keystone — Stellar Soroban testnet · drawn to scale
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
