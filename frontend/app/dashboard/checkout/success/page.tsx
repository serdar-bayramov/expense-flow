'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Optional: Verify session with backend
    if (sessionId) {
      console.log('Checkout session:', sessionId);
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-24 w-24 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold">Payment Successful!</h1>
        <p className="text-muted-foreground text-lg">
          Your subscription has been activated. You now have access to all premium features.
        </p>
        <div className="space-y-4 pt-4">
          <Button onClick={() => router.push('/dashboard')} className="w-full" size="lg">
            Go to Dashboard
          </Button>
          <p className="text-sm text-muted-foreground">
            Your invoice has been sent to your email address.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
