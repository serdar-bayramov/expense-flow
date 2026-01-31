'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { PLANS, Plan } from '@/lib/plans';
import { cn } from '@/lib/utils';

interface PlanSelectorProps {
  currentPlan: string;
  onSelectPlan: (planId: 'free' | 'professional' | 'pro_plus') => void;
  isLoading?: boolean;
}

export function PlanSelector({ currentPlan, onSelectPlan, isLoading = false }: PlanSelectorProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>(currentPlan);
  const hasChanges = selectedPlan !== currentPlan;

  const handleConfirm = () => {
    if (hasChanges && selectedPlan) {
      onSelectPlan(selectedPlan as 'free' | 'professional' | 'pro_plus');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isSelected = plan.id === selectedPlan;
          const Icon = plan.icon;

          return (
            <Card
              key={plan.id}
              className={cn(
                'cursor-pointer transition-all hover:border-primary/50 h-full',
                isSelected && 'border-primary ring-2 ring-primary/20',
                isCurrent && 'bg-muted/30'
              )}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <CardContent className="p-4 flex flex-col h-full">
                {/* Header with Radio + Icon */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-5 w-5', plan.popular ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400')} />
                    <h3 className="font-semibold text-base">
                      {plan.name}
                    </h3>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0',
                      isSelected
                        ? 'border-primary bg-primary'
                        : 'border-gray-300 dark:border-gray-600'
                    )}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div className="flex gap-2 mb-2">
                  {isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      Current
                    </Badge>
                  )}
                  {plan.popular && !isCurrent && (
                    <Badge className="text-xs bg-blue-500">
                      Popular
                    </Badge>
                  )}
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">
                    {plan.period}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-3">
                  {plan.description}
                </p>

                {/* Key Features - vertical list */}
                <div className="space-y-1 text-xs text-muted-foreground flex-1">
                  {plan.features
                    .filter(f => f.highlight)
                    .slice(0, 4)
                    .map((feature, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature.text}</span>
                      </div>
                    ))}
                </div>

                {plan.betaNote && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-3">
                    {plan.betaNote}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Button */}
      {hasChanges && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
          <div className="text-sm">
            <p className="font-medium">
              {selectedPlan === 'free' 
                ? 'Cancel subscription at end of billing period?' 
                : `Change to ${PLANS.find(p => p.id === selectedPlan)?.name}?`}
            </p>
            <p className="text-muted-foreground text-xs">
              {selectedPlan === 'free'
                ? "You'll keep your current plan until your billing period ends"
                : 'Changes take effect immediately'}
            </p>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            size="lg"
            variant={selectedPlan === 'free' ? 'outline' : 'default'}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              selectedPlan === 'free' ? 'Cancel Subscription' : 'Confirm Change'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
