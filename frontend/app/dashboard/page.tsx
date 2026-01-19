'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReceiptPoundSterling, PoundSterling, TrendingUp } from 'lucide-react';
import { authAPI } from '@/lib/api';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await authAPI.me(token);
          setUser(userData);
        } catch (error) {
          console.error('Failed to fetch user:', error);
        }
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back{user?.full_name ? `, ${user.full_name}` : ''}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here's what's happening with your expenses
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Receipts
            </CardTitle>
            <ReceiptPoundSterling className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-500 mt-1">
              Start uploading receipts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Spent
            </CardTitle>
            <PoundSterling className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£0.00</div>
            <p className="text-xs text-gray-500 mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              This Month
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£0.00</div>
            <p className="text-xs text-gray-500 mt-1">
              January 2026
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Receipt Email Card */}
      {user?.unique_receipt_email && (
        <Card>
          <CardHeader>
            <CardTitle>📧 Your Receipt Email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-2">
              Forward receipts to this email and they'll automatically appear in your account:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-2 bg-gray-100 rounded-lg text-sm font-mono">
                {user.unique_receipt_email}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(user.unique_receipt_email);
                }}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Copy
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <ReceiptPoundSterling className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No receipts yet</h3>
            <p className="mt-2 text-sm text-gray-500">
              Get started by uploading your first receipt
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}