import { Metadata } from 'next';
import LandingClientPage from './landing-client';

export const metadata: Metadata = {
  title: 'ExpenseFlow - Smart Expense Tracking for UK Freelancers',
  description: 'Automate your expense tracking with AI-powered receipt scanning and HMRC-compliant categorisation. Perfect for UK freelancers and sole traders.',
  keywords: 'expense tracking, receipt scanner, UK freelancers, HMRC compliant, mileage tracking, sole traders, tax reports, OCR receipt scanning',
  openGraph: {
    title: 'ExpenseFlow - Smart Expense Tracking for UK Freelancers',
    description: 'Automate your expense tracking with AI-powered receipt scanning and HMRC-compliant categorisation.',
    url: 'https://expenseflow.co.uk',
    siteName: 'ExpenseFlow',
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ExpenseFlow - Smart Expense Tracking for UK Freelancers',
    description: 'Automate your expense tracking with AI-powered receipt scanning and HMRC-compliant categorisation.',
  },
};

export default function LandingPage() {
  return <LandingClientPage />;
}
