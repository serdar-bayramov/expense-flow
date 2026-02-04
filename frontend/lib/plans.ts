import { Zap, Crown, LucideIcon } from 'lucide-react';

export interface PlanFeature {
  text: string;
  highlight?: boolean;
}

export interface Plan {
  id: 'free' | 'professional' | 'pro_plus';
  name: string;
  icon: LucideIcon;
  description: string;
  price: string;
  priceMonthly: number; // Numeric value for calculations
  period: string;
  popular?: boolean;
  features: PlanFeature[];
  betaNote?: string;
  limits: {
    receipts: number;
    mileage: number;
    analytics: boolean;
    templates: boolean;
    exportFormats: string[];
    support: string;
  };
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    icon: Zap,
    description: 'Perfect for getting started',
    price: '£0',
    priceMonthly: 0,
    period: 'forever',
    features: [
      { text: '50 receipts/month (10 after beta)', highlight: true },
      { text: '20 mileage claims/month (5 after beta)', highlight: true },
      { text: 'Upload or email receipts' },
      { text: 'AI-powered OCR scanning' },
      { text: 'Real-time UK tax calculator' },
      { text: 'Analytics dashboard' },
      { text: 'CSV export' },
      { text: 'Journey templates' },
      { text: 'Email support' },
    ],
    betaNote: '🎉 Increased limits during beta',
    limits: {
      receipts: 50,
      mileage: 20,
      analytics: true,
      templates: true,
      exportFormats: ['csv'],
      support: 'email',
    },
  },
  {
    id: 'professional',
    name: 'Professional',
    icon: Zap,
    description: 'For active freelancers',
    price: '£10',
    priceMonthly: 10,
    period: 'per month',
    popular: true,
    features: [
      { text: '100 receipts per month', highlight: true },
      { text: '50 mileage claims per month', highlight: true },
      { text: 'Upload or email receipts' },
      { text: 'AI-powered OCR scanning' },
      { text: 'Real-time UK tax calculator' },
      { text: 'Analytics dashboard' },
      { text: 'CSV export' },
      { text: 'Journey templates' },
      { text: 'Email support' },
    ],
    limits: {
      receipts: 100,
      mileage: 50,
      analytics: true,
      templates: true,
      exportFormats: ['csv'],
      support: 'email',
    },
  },
  {
    id: 'pro_plus',
    name: 'Pro Plus',
    icon: Crown,
    description: 'For high-volume businesses',
    price: '£17',
    priceMonthly: 17,
    period: 'per month',
    features: [
      { text: '500 receipts per month', highlight: true },
      { text: '200 mileage claims per month', highlight: true },
      { text: 'Upload or email receipts' },
      { text: 'AI-powered OCR scanning' },
      { text: 'Real-time UK tax calculator' },
      { text: 'Analytics dashboard' },
      { text: 'CSV + PDF + Image export', highlight: true },
      { text: 'Journey templates' },
      { text: 'Priority support', highlight: true },
    ],
    limits: {
      receipts: 500,
      mileage: 200,
      analytics: true,
      templates: true,
      exportFormats: ['csv', 'pdf', 'images'],
      support: 'priority',
    },
  },
];

export const getPlanById = (id: string): Plan | undefined => {
  return PLANS.find(plan => plan.id === id);
};

export const getPlanByPrice = (priceMonthly: number): Plan | undefined => {
  return PLANS.find(plan => plan.priceMonthly === priceMonthly);
};
