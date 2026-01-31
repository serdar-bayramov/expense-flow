'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReceiptPoundSterling, PoundSterling, TrendingUp, Calendar, Store, AlertCircle, Car } from 'lucide-react';
import { authAPI, receiptsAPI, Receipt, mileageAPI, MileageStats } from '@/lib/api';
import { format } from 'date-fns';
import { useAuth } from '@clerk/nextjs';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [mileageStats, setMileageStats] = useState<MileageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReceipts: 0,
    totalSpent: 0,
    totalVAT: 0,
    pendingReview: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) return;

        // Fetch user data
        const userData = await authAPI.me(token);
        setUser(userData);

        // Fetch all receipts and mileage stats
        const [allReceipts, mileageData] = await Promise.all([
          receiptsAPI.getAll(token),
          mileageAPI.getStats(token).catch(() => null) // Don't fail if mileage API fails
        ]);
        
        setMileageStats(mileageData);
        
        // Get receipts from last 7 days based on upload date (created_at)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentReceipts = allReceipts
          .filter(r => new Date(r.created_at) >= sevenDaysAgo)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5);
        
        setReceipts(recentReceipts);

        // Calculate stats
        const totalSpent = allReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
        const totalVAT = allReceipts.reduce((sum, r) => sum + (r.tax_amount || 0), 0);
        const pendingCount = allReceipts.filter(r => r.status === 'pending').length;

        setStats({
          totalReceipts: allReceipts.length,
          totalSpent,
          totalVAT,
          pendingReview: pendingCount,
        });

      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getToken, router]);

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

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back{user?.full_name ? `, ${user.full_name}` : ''}!
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Here's what's happening with your expenses
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Total Receipts
            </CardTitle>
            <ReceiptPoundSterling className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold dark:text-white">{stats.totalReceipts}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {stats.totalReceipts === 0 ? 'Start uploading' : 'All time'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Total Spent
            </CardTitle>
            <PoundSterling className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold dark:text-white">£{stats.totalSpent.toFixed(2)}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  All time
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Total VAT
            </CardTitle>
            <PoundSterling className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold dark:text-white">£{(stats.totalVAT || 0).toFixed(2)}</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  All time
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Pending Review
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="h-8 w-16 bg-yellow-200 dark:bg-yellow-700 rounded animate-pulse" />
                <div className="h-3 w-20 bg-yellow-200 dark:bg-yellow-700 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-300">{stats.pendingReview || 0}</div>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                  {stats.pendingReview === 0 ? 'All caught up!' : 'Need approval'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mileage Stats (if available) */}
      {mileageStats && mileageStats.total_claims > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Mileage Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Claims</p>
                <p className="text-2xl font-bold">{mileageStats.total_claims}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Miles</p>
                <p className="text-2xl font-bold">{mileageStats.total_miles.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Claimed</p>
                <p className="text-2xl font-bold text-green-600">£{mileageStats.total_amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tax Year Miles</p>
                <p className="text-2xl font-bold">{mileageStats.current_tax_year_miles.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {mileageStats.current_rate_for_new_claim === 0.45 ? 'At 45p/mile' : 'At 25p/mile'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Receipt Email Card */}
      {user?.unique_receipt_email && (
        <Card>
          <CardHeader>
            <CardTitle>📧 Your Receipt Email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Forward receipts to this email and they'll automatically appear in your account:
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <code className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono dark:text-white break-all">
                {user.unique_receipt_email}
              </code>
              <button
                onClick={() => {
                  toast({
                    title: 'Copied!',
                    description: 'Receipt email address copied to clipboard',
                  });
                  navigator.clipboard.writeText(user.unique_receipt_email);
                }}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
              >
                Copy
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Receipts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Receipts (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <div className="text-center py-12">
              <ReceiptPoundSterling className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No recent receipts</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Upload receipts to see them here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer dark:border-gray-700"
                  onClick={() => router.push(`/dashboard/receipts/${receipt.id}`)}
                >
                  {/* Receipt Image Thumbnail */}
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden shrink-0">
                    <img
                      src={receipt.image_url}
                      alt={receipt.vendor || 'Receipt'}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Receipt Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Store className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {receipt.vendor || 'Unknown Vendor'}
                      </span>
                      <Badge className={`ml-auto ${getStatusColor(receipt.status)}`}>
                        {receipt.status}
                      </Badge>
                    </div>
                    {receipt.date && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(receipt.date), 'MMM dd, yyyy')}
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {receipt.total_amount ? `£${receipt.total_amount.toFixed(2)}` : 'N/A'}
                    </div>
                    {receipt.tax_amount && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        VAT: £{receipt.tax_amount.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}