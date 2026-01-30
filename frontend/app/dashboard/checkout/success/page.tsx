'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@clerk/nextjs';
import { stripeService } from '@/lib/stripe';

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const sessionId = searchParams.get('session_id');
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    // Sync subscription immediately after successful checkout
    const syncSubscription = async () => {
      if (sessionId) {
        console.log('Checkout session:', sessionId);
        try {
          const token = await getToken();
          if (token) {
            // Call sync endpoint to update database with Stripe subscription data
            await stripeService.syncSubscription(token);
            console.log('✅ Subscription synced successfully');
          }
        } catch (error) {
          console.error('Failed to sync subscription:', error);
          // Don't block user, they can still proceed
        } finally {
          setSyncing(false);
        }
      } else {
        setSyncing(false);
      }
    };

    syncSubscription();
  }, [sessionId, getToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-24 w-24 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold">Payment Successful!</h1>
        <p className="text-muted-foreground text-lg">
          {syncing ? 'Activating your subscription...' : 'Your subscription has been activated. You now have access to all premium features.'}
        </p>
        <div className="space-y-4 pt-4">
          <Button 
            onClick={() => router.push('/dashboard')} 
            className="w-full" 
            size="lg"
            disabled={syncing}
          >
            {syncing ? 'Please wait...' : 'Go to Dashboard'}
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
