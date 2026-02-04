import { Metadata } from 'next';
import LandingClientPage from './landing-client';

export const metadata: Metadata = {
  title: 'Expense Tracking UK | Smart Expense Management for Self-Employed & Freelancers',
  description: 'Smart expense tracking for UK self-employed, freelancers and sole traders. AI-powered receipt scanning, real-time UK tax calculator, HMRC-compliant categorisation, and automated mileage tracking. Try free.',
  keywords: ['expense tracking uk', 'expense management uk', 'smart expense tracking', 'expense tracker uk', 'self employed expense tracking', 'freelancer expense tracking', 'sole trader expenses', 'receipt scanner uk', 'HMRC expense tracking', 'mileage tracker uk', 'business expense app uk', 'expense app self employed', 'uk freelancer accounting', 'receipt management uk', 'expense reporting uk', 'uk tax calculator', 'self employment tax calculator uk', 'freelancer tax calculator'],
  openGraph: {
    title: 'Expense Tracking UK | Smart Management for Self-Employed & Freelancers',
    description: 'Smart expense tracking for UK self-employed and freelancers. AI receipt scanning, real-time tax calculator, HMRC categorisation, automated mileage tracking. Start free.',
    url: 'https://expenseflow.co.uk',
    siteName: 'ExpenseFlow',
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Expense Tracking UK | For Self-Employed & Freelancers',
    description: 'Smart expense management for UK self-employed. AI receipt scanning, real-time tax calculator, HMRC categorisation, mileage tracking. Free plan available.',
  },
};

export default function LandingPage() {
  return <LandingClientPage />;
}
