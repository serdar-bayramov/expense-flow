'use client';

import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex justify-center">
          <XCircle className="h-24 w-24 text-amber-500" />
        </div>
        <h1 className="text-3xl font-bold">Checkout Cancelled</h1>
        <p className="text-muted-foreground text-lg">
          No charges were made. You can upgrade your plan anytime from your settings.
        </p>
        <div className="flex gap-4 pt-4">
          <Button variant="outline" onClick={() => router.push('/dashboard')} className="flex-1" size="lg">
            Go to Dashboard
          </Button>
          <Button onClick={() => router.push('/dashboard/settings')} className="flex-1" size="lg">
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
