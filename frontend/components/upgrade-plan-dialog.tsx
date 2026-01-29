'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { stripeService } from '@/lib/stripe';
import { useToast } from '@/hooks/use-toast';
import { PLANS } from '@/lib/plans';
import { PricingCard } from '@/components/pricing-card';

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: 'free' | 'professional' | 'pro_plus';
  onPlanUpdated?: () => void;
}

export function UpgradePlanDialog({ open, onOpenChange, currentPlan, onPlanUpdated }: UpgradePlanDialogProps) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSelectPlan = async (planId: 'free' | 'professional' | 'pro_plus') => {
    if (planId === currentPlan || planId === 'free') {
      return;
    }

    setLoading(true);
    setSelectedPlan(planId);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Create Stripe Checkout session
      const checkoutUrl = await stripeService.createCheckoutSession(token, planId);
      
      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;

    } catch (error: any) {
      console.error('Failed to start checkout:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to start checkout. Please try again.',
      });
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
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              currentPlan={currentPlan}
              onSelectPlan={handleSelectPlan}
              isLoading={loading}
              selectedPlan={selectedPlan}
              showCTA={true}
            />
          ))}
        </div>

        <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 text-center leading-relaxed">
            💳 <strong>Secure Payment:</strong> All payments are processed securely through Stripe. Cancel anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
