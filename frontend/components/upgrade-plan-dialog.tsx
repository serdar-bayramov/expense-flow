'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Zap, Crown, Loader2 } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: 'free' | 'professional' | 'pro_plus';
  onPlanUpdated?: () => void;
}

const plans = [
  {
    id: 'free' as const,
    name: 'Free',
    icon: Zap,
    description: 'Perfect for getting started',
    price: '£0',
    period: 'forever',
    features: [
      '10 receipts per month',
      '5 mileage claims per month',
      'Basic OCR scanning',
      'Email support',
    ],
    limitations: [
      'No analytics dashboard',
      'No journey templates',
      'No export options',
    ],
  },
  {
    id: 'professional' as const,
    name: 'Professional',
    icon: Zap,
    description: 'For growing businesses',
    price: '£9.99',
    period: 'per month',
    popular: true,
    features: [
      '100 receipts per month',
      '50 mileage claims per month',
      'Analytics dashboard',
      'Journey templates',
      'Advanced OCR',
      'CSV export',
      'Email support',
    ],
  },
  {
    id: 'pro_plus' as const,
    name: 'Pro Plus',
    icon: Crown,
    description: 'For power users',
    price: '£19.99',
    period: 'per month',
    features: [
      '500 receipts per month',
      '200 mileage claims per month',
      'All Professional features',
      'PDF & Image exports',
      'Priority support',
      'Advanced analytics',
    ],
  },
];

export function UpgradePlanDialog({ open, onOpenChange, currentPlan, onPlanUpdated }: UpgradePlanDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSelectPlan = async (planId: 'free' | 'professional' | 'pro_plus') => {
    if (planId === currentPlan) {
      return;
    }

    setLoading(true);
    setSelectedPlan(planId);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      await authAPI.updateSubscription(token, planId);

      // Close dialog immediately
      onOpenChange(false);
      
      // Show success toast
      toast({
        title: 'Plan Updated!',
        description: `Successfully switched to ${plans.find(p => p.id === planId)?.name} plan.`,
        duration: 3000,
      });

      // Notify parent
      if (onPlanUpdated) {
        await onPlanUpdated();
      }
      
      // Wait for user to see the toast before reloading
      await new Promise(resolve => setTimeout(resolve, 2500));
      window.location.reload();
    } catch (error) {
      console.error('Failed to update plan:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update subscription plan. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-none w-[95vw] sm:w-[90vw] lg:w-[1200px] xl:w-[1400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-2xl sm:text-3xl font-bold">Choose Your Plan</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Select the plan that best fits your needs. You can change your plan anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = plan.id === currentPlan;
            const isLoading = loading && selectedPlan === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col min-h-[500px] ${
                  plan.popular
                    ? 'border-blue-500 shadow-lg ring-2 ring-blue-500'
                    : isCurrent
                    ? 'border-green-500 ring-2 ring-green-500'
                    : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-blue-500 text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-md whitespace-nowrap">
                      POPULAR
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-green-500 text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-md whitespace-nowrap">
                      CURRENT PLAN
                    </span>
                  </div>
                )}

                <CardHeader className="pb-4 sm:pb-6">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <Icon className={`h-6 w-6 sm:h-7 sm:w-7 shrink-0 ${plan.id === 'pro_plus' ? 'text-yellow-500' : 'text-blue-500'}`} />
                    <CardTitle className="text-xl sm:text-2xl font-bold">{plan.name}</CardTitle>
                  </div>
                  <CardDescription className="text-sm sm:text-base leading-relaxed min-h-[40px]">{plan.description}</CardDescription>
                  <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t">
                    <span className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm sm:text-base ml-2">{plan.period}</span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col pt-0">
                  <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 flex-1">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 sm:gap-3">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-sm sm:text-base leading-relaxed">{feature}</span>
                      </li>
                    ))}
                    {plan.limitations?.map((limitation, index) => (
                      <li key={`limit-${index}`} className="flex items-start gap-2 sm:gap-3 opacity-50">
                        <span className="text-sm sm:text-base line-through leading-relaxed">{limitation}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrent || loading}
                    className="w-full h-10 sm:h-12 text-sm sm:text-base font-semibold mt-auto"
                    variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                        Updating...
                      </>
                    ) : isCurrent ? (
                      'Current Plan'
                    ) : (
                      'Select Plan'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xs sm:text-base text-gray-600 dark:text-gray-400 text-center leading-relaxed">
            💡 This is a demo environment. Plan changes are instant with no payment required.
            In production, this would integrate with Stripe for secure payments.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
