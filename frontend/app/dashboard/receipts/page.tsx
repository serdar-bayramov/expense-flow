'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ReceiptPoundSterling } from 'lucide-react';

export default function ReceiptsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Receipts</h1>
        <p className="mt-2 text-gray-600">
          Manage and organize all your receipts
        </p>
      </div>

      {/* Empty state - we'll add receipt list later */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <ReceiptPoundSterling className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No receipts yet</h3>
            <p className="mt-2 text-sm text-gray-500">
              Upload your first receipt to get started
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}