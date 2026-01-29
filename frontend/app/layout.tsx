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
  title: "ExpenseFlow - Smart Expense Tracking for UK Self-Employed & Freelancers",
  description: "Smart expense management for UK self-employed, freelancers and sole traders. AI receipt scanning, HMRC categorisation, mileage tracking. Free plan available.",
  keywords: ["expense tracking uk", "expense management uk", "self employed expense tracker", "freelancer expenses", "sole trader expenses", "receipt scanner uk", "mileage tracker uk", "HMRC compliant", "business expense app", "uk tax expenses"],
  authors: [{ name: "ExpenseFlow" }],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: "ExpenseFlow - Expense Tracking UK for Self-Employed",
    description: "Smart expense management for UK self-employed, freelancers and sole traders. HMRC compliant tracking.",
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
  // Structured data for better SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ExpenseFlow",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "GBP"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "127"
    },
    "description": "Smart expense tracking for UK self-employed, freelancers and sole traders. AI-powered receipt scanning, HMRC-compliant categorisation, and automated mileage tracking.",
    "featureList": [
      "Expense tracking",
      "Receipt scanning",
      "Mileage tracking",
      "HMRC compliance",
      "Tax reports",
      "Analytics dashboard"
    ],
    "keywords": "expense tracking uk, expense management, self employed, freelancer, sole trader, HMRC, receipt scanner, mileage tracker"
  };

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
        </head>
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
