'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, TrendingDown, Calculator, Loader2 } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { taxAPI, TaxCalculationResult } from '@/lib/api';

export function TaxCalculator() {
  const { getToken } = useAuth();
  const [income, setIncome] = useState<string>('45000');
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<TaxCalculationResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (income && parseFloat(income) > 0) {
        calculateTax();
      }
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [income]);

  const calculateTax = async () => {
    try {
      setCalculating(true);
      const token = await getToken();
      if (!token) return;

      const data = await taxAPI.calculate(token, parseFloat(income));
      setResult(data);
    } catch (error) {
      console.error('Tax calculation error:', error);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Card className="border-2 border-green-200 dark:border-green-800 min-h-[600px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-green-600" />
          Estimated Tax Impact
        </CardTitle>
        <CardDescription>
          See how your expense tracking saves you money
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Income Input */}
        <div className="space-y-2">
          <Label htmlFor="income">Estimated Annual Income (£)</Label>
          <Input
            id="income"
            type="number"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            placeholder="45000"
            className="text-lg"
          />
        </div>

        {calculating && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-green-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Calculating...</span>
          </div>
        )}

        {result && !calculating && (
          <>
            {/* Tax Savings Highlight */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-2 border-green-300 dark:border-green-700">
              <div className="flex items-start gap-3">
                <TrendingDown className="h-6 w-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-lg text-green-900 dark:text-green-100">
                    You've saved approximately £{result.deductions_saved_tax.toFixed(0)} in tax
                  </h4>
                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                    By tracking £{result.total_deductions.toFixed(2)} in deductions
                  </p>
                </div>
              </div>
            </div>

            {/* Deductions Summary */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Income:</span>
                <span className="font-semibold">£{result.income.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Expenses:</span>
                <span className="font-semibold">-£{result.expenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">
                  Mileage ({result.mileage_miles.toFixed(0)} miles):
                </span>
                <span className="font-semibold">-£{result.mileage_allowance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base">
                <span className="font-semibold">Taxable Profit:</span>
                <span className="font-bold">£{result.taxable_profit.toFixed(2)}</span>
              </div>
            </div>

            {/* Tax Breakdown */}
            <div className="border-t pt-4 space-y-2">
              <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">
                Estimated Tax Liability (2025/26):
              </h4>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">Income Tax:</span>
                <span>£{result.income_tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">National Insurance:</span>
                <span>£{result.total_ni.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total Tax Due:</span>
                <span className="text-red-600 dark:text-red-400">£{result.total_tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Effective Rate:</span>
                <span>{result.effective_tax_rate.toFixed(1)}%</span>
              </div>
            </div>

            {/* Helpful Tip */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm border border-blue-200 dark:border-blue-800">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">💡 Pro Tip:</p>
              <p className="text-blue-800 dark:text-blue-200">
                Save <span className="font-bold">£{result.monthly_savings_needed.toFixed(2)}/month</span> to cover your tax bill (due by 31 Jan)
              </p>
            </div>
          </>
        )}

        {/* Disclaimer */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription className="text-xs">
            This is an estimate only, not tax advice. Your actual tax liability may differ based on other income,
            allowances, and circumstances. Consult an accountant or use HMRC's official calculator for accurate figures.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
