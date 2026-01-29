import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { ClerkProvider } from '@clerk/nextjs'


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ExpenseFlow - Smart Expense Tracking for UK Freelancers",
  description: "AI-powered receipt scanning and mileage tracking built for HMRC compliance. Automate your expense management with ExpenseFlow.",
  keywords: ["expense tracking", "receipt scanner", "mileage tracker", "HMRC", "UK freelancers", "sole traders", "tax", "accounting"],
  authors: [{ name: "ExpenseFlow" }],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: "ExpenseFlow - Smart Expense Tracking",
    description: "AI-powered receipt scanning and mileage tracking for UK freelancers",
    url: "https://expenseflow.co.uk",
    siteName: "ExpenseFlow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ExpenseFlow - Smart Expense Tracking",
    description: "AI-powered receipt scanning and mileage tracking for UK freelancers",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
