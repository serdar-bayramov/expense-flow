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
      <div className="space-y-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isSelected = plan.id === selectedPlan;
          const Icon = plan.icon;

          return (
            <Card
              key={plan.id}
              className={cn(
                'cursor-pointer transition-all hover:border-primary/50',
                isSelected && 'border-primary ring-2 ring-primary/20',
                isCurrent && 'bg-muted/30'
              )}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Radio Button */}
                  <div className="flex items-center pt-1">
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
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

                  {/* Plan Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={cn('h-5 w-5', plan.popular ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400')} />
                      <h3 className="font-semibold text-base">
                        {plan.name}
                      </h3>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Current Plan
                        </Badge>
                      )}
                      {plan.popular && !isCurrent && (
                        <Badge className="text-xs bg-blue-500">
                          Popular
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">
                      {plan.description}
                    </p>

                    {/* Price */}
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-2xl font-bold">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">
                        {plan.period}
                      </span>
                    </div>

                    {/* Key Features */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {plan.limits.receipts && (
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          {plan.limits.receipts} receipts/month
                        </span>
                      )}
                      {plan.limits.mileage && (
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          {plan.limits.mileage} mileage/month
                        </span>
                      )}
                      {plan.features
                        .filter(f => f.highlight)
                        .slice(0, 2)
                        .map((feature, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <Check className="h-3 w-3 text-green-500" />
                            {feature.text}
                          </span>
                        ))}
                    </div>

                    {plan.betaNote && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                        {plan.betaNote}
                      </p>
                    )}
                  </div>
                </div>
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
                ? 'Downgrade to Free plan?' 
                : `Upgrade to ${PLANS.find(p => p.id === selectedPlan)?.name}?`}
            </p>
            <p className="text-muted-foreground text-xs">
              {selectedPlan === 'free'
                ? 'You will lose access to premium features'
                : 'You will be charged immediately and have instant access'}
            </p>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm Change'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
