'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, CheckCircle, Loader2, Pencil, AlertTriangle, FileText, Clock } from 'lucide-react';
import { receiptsAPI, Receipt, EXPENSE_CATEGORIES, ExpenseCategory } from '@/lib/api';
import { SUPPORTED_CURRENCIES, formatExchangeRate } from '@/lib/currency';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ReceiptHistory } from '@/components/receipt-history';

export default function ReceiptDetailPage() {
  const { getToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const receiptId = parseInt(params.id as string);

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Currency conversion preview state
  const [previewGbpAmount, setPreviewGbpAmount] = useState<number | null>(null);
  const [previewExchangeRate, setPreviewExchangeRate] = useState<number | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    vendor: '',
    date: '',
    currency: 'GBP',
    original_amount: '',
    total_amount: '',
    tax_amount: '',
    category: '',
    notes: '',
  });

  useEffect(() => {
    const fetchReceipt = async () => {
      const token = await getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const data = await receiptsAPI.getById(token, receiptId);
        setReceipt(data);
        
        // Populate form with existing data
        setFormData({
          vendor: data.vendor || '',
          date: data.date ? format(new Date(data.date), 'yyyy-MM-dd') : '',
          currency: data.currency || 'GBP',
          original_amount: data.original_amount?.toString() || data.total_amount?.toString() || '',
          total_amount: data.total_amount?.toString() || '',
          tax_amount: data.tax_amount?.toString() || '',
          category: data.category || '',
          notes: data.notes || '',
        });
      } catch (error) {
        console.error('Failed to fetch receipt:', error);
        toast.error('Failed to load receipt');
        router.push('/dashboard/receipts');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [receiptId, router]);

  // Real-time currency conversion preview
  useEffect(() => {
    const fetchExchangeRateAndConvert = async () => {
      // Only calculate if currency is not GBP and we have an original amount
      if (formData.currency === 'GBP' || !formData.original_amount) {
        setPreviewGbpAmount(null);
        setPreviewExchangeRate(null);
        return;
      }

      const originalAmount = parseFloat(formData.original_amount);
      if (isNaN(originalAmount)) {
        setPreviewGbpAmount(null);
        return;
      }

      setFetchingRate(true);
      try {
        const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.currency}`);
        const data = await response.json();
        const rate = data.rates['GBP'];
        const gbpAmount = originalAmount * rate;
        
        setPreviewExchangeRate(rate);
        setPreviewGbpAmount(gbpAmount);
      } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
        setPreviewGbpAmount(null);
        setPreviewExchangeRate(null);
      } finally {
        setFetchingRate(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      fetchExchangeRateAndConvert();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.currency, formData.original_amount]);

  const handleSave = async () => {
    const token = await getToken();
    if (!token) return;

    try {
      // Check if currency changed - need to recalculate GBP amount
      const currencyChanged = receipt && formData.currency !== receipt.currency;
      const originalAmountChanged = receipt && parseFloat(formData.original_amount) !== receipt.original_amount;
      
      let gbpAmount = formData.total_amount ? parseFloat(formData.total_amount) : undefined;
      let exchangeRate: number | undefined = undefined;
      let exchangeRateDate: string | undefined = undefined;
      
      // If currency is not GBP, we need exchange rate
      if (formData.currency !== 'GBP') {
        const originalAmount = parseFloat(formData.original_amount);
        
        // Use preview rate if available (already fetched), otherwise fetch new one
        if (previewExchangeRate !== null && previewGbpAmount !== null) {
          gbpAmount = previewGbpAmount;
          exchangeRate = previewExchangeRate;
          exchangeRateDate = new Date().toISOString();
          
          toast.info(`Converted ${originalAmount} ${formData.currency} to £${gbpAmount.toFixed(2)} GBP`);
        } else if (!isNaN(originalAmount)) {
          // Fetch exchange rate if not already available
          try {
            const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.currency}`);
            const data = await response.json();
            const rate = data.rates['GBP'];
            gbpAmount = originalAmount * rate;
            exchangeRate = rate;
            exchangeRateDate = new Date().toISOString();
            
            toast.info(`Converted ${originalAmount} ${formData.currency} to £${gbpAmount.toFixed(2)} GBP`);
          } catch (error) {
            toast.error('Failed to fetch exchange rate. Please try again.');
            throw error;
          }
        }
      } else {
        // If GBP, original_amount and total_amount should be the same
        gbpAmount = parseFloat(formData.original_amount);
        exchangeRate = 1.0;
        exchangeRateDate = new Date().toISOString();
      }

      const updateData: any = {
        vendor: formData.vendor || undefined,
        date: formData.date || undefined,
        currency: formData.currency || undefined,
        original_amount: formData.original_amount ? parseFloat(formData.original_amount) : undefined,
        total_amount: gbpAmount,
        tax_amount: formData.tax_amount ? parseFloat(formData.tax_amount) : undefined,
        category: (formData.category as ExpenseCategory) || undefined,
        notes: formData.notes || undefined,
      };

      // Add exchange rate data if available
      if (exchangeRate !== undefined) {
        updateData.exchange_rate = exchangeRate;
      }
      if (exchangeRateDate !== undefined) {
        updateData.exchange_rate_date = exchangeRateDate;
      }

      const updated = await receiptsAPI.update(token, receiptId, updateData);
      setReceipt(updated);
      
      // Update form with new GBP amount and reset preview
      setFormData(prev => ({
        ...prev,
        total_amount: updated.total_amount?.toString() || '',
      }));
      
      // Clear preview states after save
      setPreviewGbpAmount(null);
      setPreviewExchangeRate(null);
    } catch (error) {
      console.error('Failed to update receipt:', error);
      throw error;
    }
  };

  const handleApprove = async () => {
    const token = await getToken();
    if (!token) return;

    setApproving(true);
    try {
      // Save changes first
      await handleSave();
      
      // Then approve
      const approved = await receiptsAPI.approve(token, receiptId);
      setReceipt(approved);
      toast.success('Receipt approved and completed!');
      
      // Redirect back to receipts list after a delay
      setTimeout(() => {
        router.push('/dashboard/receipts');
      }, 1500);
    } catch (error: any) {
      console.error('Failed to approve receipt:', error);
      toast.error(error.response?.data?.detail || 'Failed to approve receipt');
    } finally {
      setApproving(false);
    }
  };

  const handleSaveChanges = async () => {
    const token = await getToken();
    if (!token) return;

    setSaving(true);
    try {
      await handleSave();
      toast.success('Changes saved successfully!');
      setIsEditing(false);
    } catch (error: any) {
      console.error('Failed to save changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-300" />
      </div>
    );
  }

  if (!receipt) {
    return null;
  }

  const isPending = receipt.status === 'pending';
  const isCompleted = receipt.status === 'completed';
  const isFormEditable = isPending || (isCompleted && isEditing);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/receipts')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Receipt Details</h1>
        </div>
        <Badge className={getStatusColor(receipt.status)}>
          {receipt.status}
        </Badge>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="details" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Receipt Image */}
            <Card>
              <CardHeader>
                <CardTitle className="dark:text-white">Receipt Image</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <img
                    src={receipt.image_url}
                    alt="Receipt"
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Editable Form */}
            <Card>
              <CardHeader>
                <CardTitle className="dark:text-white">
                  {isPending 
                    ? 'Review & Edit Details' 
                    : isEditing 
                      ? 'Editing Receipt' 
                      : 'Receipt Information'
                  }
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Warning banner when editing completed receipt */}
                {isCompleted && isEditing && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800 dark:text-yellow-300">
                      <p className="font-medium">Editing completed receipt</p>
                      <p className="text-yellow-700 dark:text-yellow-400">Make sure changes are accurate before saving.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Vendor */}
                  <div>
                    <Label htmlFor="vendor" className="mb-2 block dark:text-gray-300">Vendor</Label>
                    <Input
                      id="vendor"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      placeholder="Enter vendor name"
                      disabled={!isFormEditable}
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <Label htmlFor="date" className="mb-2 block dark:text-gray-300">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      disabled={!isFormEditable}
                    />
                  </div>

                  {/* Currency Selector */}
                  <div>
                    <Label htmlFor="currency" className="mb-2 block dark:text-gray-300">Currency</Label>
                    <select
                      id="currency"
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      disabled={!isFormEditable}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-transparent dark:bg-input/30 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {SUPPORTED_CURRENCIES.map((curr) => (
                        <option key={curr.code} value={curr.code}>
                          {curr.flag} {curr.code} - {curr.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Currency will be converted to GBP for HMRC reporting
                    </p>
                  </div>

                  {/* Original Amount (in selected currency) */}
                  <div>
                    <Label htmlFor="original_amount" className="mb-2 block dark:text-gray-300">
                      Amount ({formData.currency})
                    </Label>
                    <Input
                      id="original_amount"
                      type="number"
                      step="0.01"
                      value={formData.original_amount}
                      onChange={(e) => setFormData({ ...formData, original_amount: e.target.value })}
                      placeholder="0.00"
                      disabled={!isFormEditable}
                    />
                  </div>

                  {/* Show GBP Equivalent and Exchange Rate if foreign currency */}
                  {formData.currency !== 'GBP' && (previewGbpAmount !== null || receipt?.exchange_rate) && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                      {fetchingRate && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Fetching exchange rate...</span>
                        </div>
                      )}
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">GBP Equivalent:</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            £{(previewGbpAmount !== null ? previewGbpAmount : receipt?.total_amount || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Exchange Rate:</span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {previewExchangeRate !== null 
                              ? formatExchangeRate(previewExchangeRate, formData.currency, 'GBP')
                              : receipt?.exchange_rate 
                                ? formatExchangeRate(receipt.exchange_rate, formData.currency, 'GBP')
                                : 'Loading...'}
                          </span>
                        </div>
                        {previewExchangeRate !== null ? (
                          <div className="text-xs text-green-600 dark:text-green-400 pt-1">
                            ✓ Live rate (will be saved)
                          </div>
                        ) : receipt?.exchange_rate_date && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                            Rate from {format(new Date(receipt.exchange_rate_date), 'MMM dd, yyyy')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Total Amount (GBP - read-only for foreign currency) */}
                  <div>
                    <Label htmlFor="total_amount" className="mb-2 block dark:text-gray-300">
                      Total Amount (GBP)
                      {formData.currency !== 'GBP' && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(Auto-calculated)</span>
                      )}
                    </Label>
                    <Input
                      id="total_amount"
                      type="number"
                      step="0.01"
                      value={formData.total_amount}
                      onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                      placeholder="0.00"
                      disabled={!isFormEditable || formData.currency !== 'GBP'}
                      className={formData.currency !== 'GBP' ? 'bg-gray-100 dark:bg-gray-700' : ''}
                    />
                    {formData.currency !== 'GBP' && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        This will be recalculated when you save
                      </p>
                    )}
                  </div>

                  {/* VAT Amount */}
                  <div>
                    <Label htmlFor="tax_amount" className="mb-2 block dark:text-gray-300">VAT Amount (£)</Label>
                    <Input
                      id="tax_amount"
                      type="number"
                      step="0.01"
                      value={formData.tax_amount}
                      onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                      placeholder="0.00"
                      disabled={!isFormEditable}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <Label htmlFor="category" className="mb-2 block dark:text-gray-300">HMRC Expense Category</Label>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      disabled={!isFormEditable}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-transparent dark:bg-input/30 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      <option value="">Select a category...</option>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Choose the HMRC allowable expense category
                    </p>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes" className="mb-2 block dark:text-gray-300">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Add any additional notes..."
                      rows={3}
                      disabled={!isFormEditable}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4">
                    {isPending ? (
                      <Button
                        onClick={handleApprove}
                        disabled={approving}
                        className="w-full"
                      >
                        {approving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving & Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve & Complete
                          </>
                        )}
                      </Button>
                    ) : isCompleted ? (
                      isEditing ? (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setIsEditing(false)}
                            variant="outline"
                            disabled={saving}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSaveChanges}
                            disabled={saving}
                            className="flex-1"
                          >
                            {saving ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Save Changes
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => setIsEditing(true)}
                          variant="outline"
                          className="w-full"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Receipt
                        </Button>
                      )
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        This receipt is {receipt.status}.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <ReceiptHistory receiptId={receiptId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
