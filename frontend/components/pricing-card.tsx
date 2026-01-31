'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { Plan } from '@/lib/plans';
import { cn } from '@/lib/utils';

interface PricingCardProps {
  plan: Plan;
  currentPlan?: string;
  onSelectPlan?: (planId: 'free' | 'professional' | 'pro_plus') => void;
  isLoading?: boolean;
  selectedPlan?: string | null;
  showCTA?: boolean;
}

export function PricingCard({
  plan,
  currentPlan,
  onSelectPlan,
  isLoading = false,
  selectedPlan = null,
  showCTA = true,
}: PricingCardProps) {
  const Icon = plan.icon;
  const isCurrent = plan.id === currentPlan;
  const isProcessing = isLoading && selectedPlan === plan.id;

  return (
    <Card
      className={cn(
        'relative flex flex-col min-h-[500px]',
        plan.popular && !isCurrent && 'border-blue-500 shadow-lg ring-2 ring-blue-500',
        isCurrent && 'border-green-500 ring-2 ring-green-500'
      )}
    >
      {plan.popular && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-blue-500 text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-md whitespace-nowrap">
            MOST POPULAR
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
          <Icon
            className={cn(
              'h-6 w-6 sm:h-7 sm:w-7 shrink-0',
              plan.id === 'pro_plus' ? 'text-yellow-500' : 'text-blue-500'
            )}
          />
          <CardTitle className="text-xl sm:text-2xl font-bold">{plan.name}</CardTitle>
        </div>
        <CardDescription className="text-sm sm:text-base leading-relaxed min-h-[40px]">
          {plan.description}
        </CardDescription>
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t">
          <span className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            {plan.price}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-sm sm:text-base ml-2">
            {plan.period}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col pt-0">
        <ul className="space-y-3 sm:space-y-4 mb-4 sm:mb-6 flex-1">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 sm:gap-3">
              <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0 mt-0.5" />
              <span
                className={cn(
                  'text-sm sm:text-base leading-relaxed',
                  feature.highlight && 'font-semibold text-blue-600 dark:text-blue-400'
                )}
              >
                {feature.text}
              </span>
            </li>
          ))}
        </ul>

        {plan.betaNote && (
          <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 mb-4 sm:mb-6 px-3 py-2 bg-orange-50 dark:bg-orange-950 rounded-md">
            {plan.betaNote}
          </p>
        )}

        {showCTA && onSelectPlan && (
          <Button
            onClick={() => onSelectPlan(plan.id)}
            disabled={isCurrent || isLoading}
            className="w-full h-10 sm:h-12 text-sm sm:text-base font-semibold mt-auto"
            variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                Redirecting...
              </>
            ) : isCurrent ? (
              'Current Plan'
            ) : (
              'Get Started'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
