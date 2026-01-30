'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { authAPI, API_URL } from '@/lib/api';
import { stripeService } from '@/lib/stripe';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Crown, Sparkles, Zap, Check, X, TrendingUp, CreditCard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PlanSelector } from '@/components/plan-selector';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SubscriptionUsage {
  plan: string;
  receipts_used: number;
  receipts_limit: number;
  mileage_used: number;
  mileage_limit: number;
  is_beta_tester: boolean;
  subscription_cancel_at_period_end: boolean;
  subscription_current_period_end: string | null;
  features: {
    analytics_dashboard: boolean;
    export_reports: boolean;
    journey_templates: boolean;
    advanced_ocr: boolean;
    export_formats: string[];
    support_level: string;
  };
}

export default function SettingsPage() {
  const { getToken, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const token = await getToken();
      if (token) {
        try {
          // Check if user just returned from Stripe portal
          const returnedFromPortal = sessionStorage.getItem('stripe_portal_visited') === 'true';
          
          if (returnedFromPortal) {
            sessionStorage.removeItem('stripe_portal_visited');
            
            // Manually sync with Stripe to get latest status
            try {
              await stripeService.syncSubscription(token);
            } catch (error) {
              console.error('Failed to sync subscription:', error);
            }
          }
          
          const userData = await authAPI.me(token);
          setUser(userData);
          
          // Fetch subscription usage
          const response = await fetch(`${API_URL}/api/v1/users/me/subscription`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const usageData = await response.json();
          setUsage(usageData);
          
          if (returnedFromPortal) {
            // Show appropriate message based on cancellation status
            if (usageData.subscription_cancel_at_period_end) {
              toast({
                title: 'Subscription Scheduled to Cancel',
                description: 'Your subscription is scheduled to cancel at the end of your billing period.',
                className: 'border-orange-200 dark:border-orange-800',
              });
            } else if (userData.subscription_plan !== 'free') {
              toast({
                title: 'Subscription Active',
                description: 'Your subscription is active and will renew automatically.',
              });
            }
          }
        } catch (error) {
          console.error('Failed to fetch user:', error);
        }
      }
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast({
        variant: 'destructive',
        title: 'Confirmation Required',
        description: 'Please type DELETE to confirm account deletion',
      });
      return;
    }

    const token = await getToken();
    if (!token) return;

    try {
      setIsDeleting(true);
      // For Clerk users, password is not needed - authentication is via Clerk token
      await authAPI.deleteAccount(token, '', deleteConfirmText);
      
      toast({
        title: 'Account Deleted',
        description: 'Your account and all data have been permanently deleted',
        className: 'border-gray-200 dark:border-gray-700',
      });

      // Sign out from Clerk and redirect to signup page
      await signOut();
      router.push('/signup');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: error.response?.data?.detail || 'Failed to delete account. Please try again.',
        className: 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return <div className="dark:text-white">Loading...</div>;
  }

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'professional': return Sparkles;
      case 'pro_plus': return Crown;
      default: return Zap;
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'professional': return 'text-blue-600 dark:text-blue-400';
      case 'pro_plus': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const handleSelectPlan = async (planId: 'free' | 'professional' | 'pro_plus') => {
    const token = await getToken();
    if (!token) return;

    setIsChangingPlan(true);
    try {
      if (planId === 'free') {
        // Cancel subscription at end of billing period
        const result = await stripeService.cancelSubscription(token);
        
        // Refresh user data to show cancellation warning
        const userData = await authAPI.me(token);
        setUser(userData);
        
        const response = await fetch(`${API_URL}/api/v1/users/me/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const usageData = await response.json();
        setUsage(usageData);
        
        toast({
          title: 'Subscription Scheduled to Cancel',
          description: `Your subscription will be cancelled at the end of your billing period. You'll keep access until then.`,
        });
        
        setIsChangingPlan(false);
      } else {
        // Upgrade/change to paid plan - create checkout session
        const checkoutUrl = await stripeService.createCheckoutSession(token, planId);
        window.location.href = checkoutUrl;
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to change plan',
      });
      setIsChangingPlan(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoadingBilling(true);
    try {
      const token = await getToken();
      if (!token) return;

      const portalUrl = await stripeService.createBillingPortalSession(token);
      
      // Store a flag to refresh data when user returns
      sessionStorage.setItem('stripe_portal_visited', 'true');
      
      window.location.href = portalUrl;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to open billing portal',
      });
      setIsLoadingBilling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Plan & Billing */}
      {usage && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {(() => {
                    const PlanIcon = getPlanIcon(usage.plan);
                    return <PlanIcon className={`h-6 w-6 ${getPlanColor(usage.plan)}`} />;
                  })()}
                  Plan & Billing
                </CardTitle>
                <CardDescription>Choose your plan and manage billing</CardDescription>
              </div>
              {usage.plan !== 'free' && (
                <Button 
                  onClick={handleManageSubscription} 
                  variant="outline" 
                  size="sm"
                  disabled={isLoadingBilling}
                >
                  {isLoadingBilling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Manage Billing
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {usage.is_beta_tester && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                Beta Tester - Thank you for your support!
              </Badge>
            )}
            
            {usage.subscription_cancel_at_period_end && usage.subscription_current_period_end && (
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-900 dark:text-orange-100">Subscription Cancellation Scheduled</h4>
                    <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                      Your subscription will be cancelled on{' '}
                      <strong>{new Date(usage.subscription_current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                      You'll keep your current plan benefits until then.
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-2">
                      Want to keep your subscription? Use the "Manage Billing" button to reactivate it.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <PlanSelector 
              currentPlan={usage.plan}
              onSelectPlan={handleSelectPlan}
              isLoading={isChangingPlan}
            />
          </CardContent>
        </Card>
      )}

      {/* Monthly Usage */}
      {usage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Usage</CardTitle>
              <CardDescription>Current billing period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Receipts</span>
                  <span className="text-gray-600 dark:text-gray-400">{usage.receipts_used} / {usage.receipts_limit}</span>
                </div>
                <Progress value={(usage.receipts_used / usage.receipts_limit) * 100} className="h-2" />
                {((usage.receipts_used / usage.receipts_limit) * 100 >= 80) && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">⚠️ Approaching monthly limit</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Mileage Claims</span>
                  <span className="text-gray-600 dark:text-gray-400">{usage.mileage_used} / {usage.mileage_limit}</span>
                </div>
                <Progress value={(usage.mileage_used / usage.mileage_limit) * 100} className="h-2" />
                {((usage.mileage_used / usage.mileage_limit) * 100 >= 80) && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">⚠️ Approaching monthly limit</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Account Status</CardTitle>
              <CardDescription>Your subscription details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Current Plan</span>
                <span className="text-lg font-bold capitalize">
                  {usage.plan === 'pro_plus' ? 'Pro Plus' : usage.plan}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Active
                </Badge>
              </div>
              {usage.features.support_level && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Support Level</span>
                  <span className="text-sm font-medium capitalize">{usage.features.support_level}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="dark:text-white">Profile</CardTitle>
          <CardDescription className="dark:text-gray-400">Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="dark:text-gray-300">Email</Label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="bg-gray-50 dark:bg-gray-700 dark:text-gray-400"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName" className="dark:text-gray-300">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              value={user.full_name || ''}
              placeholder="Enter your name"
              disabled
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Name editing coming soon
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Email */}
      <Card>
        <CardHeader>
          <CardTitle className="dark:text-white">Receipt Forwarding Email</CardTitle>
          <CardDescription className="dark:text-gray-400">
            Forward receipts to this email to automatically add them to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <code className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg text-sm font-mono break-all">
              {user.unique_receipt_email}
            </code>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(user.unique_receipt_email);
                toast({
                  title: 'Copied!',
                  description: 'Receipt email address copied to clipboard',
                });
              }}
              className="w-full sm:w-auto"
            >
              Copy
            </Button>
          </div>
          
          {/* How to Use Instructions */}
          <div className="pt-4 border-t space-y-3">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">How to use:</h4>
            <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex gap-2">
                <span className="font-semibold text-gray-900 dark:text-white">1.</span>
                <span>Take a photo of your receipt on your phone</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-gray-900 dark:text-white">2.</span>
                <span>Email it to your receipt forwarding address above</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-gray-900 dark:text-white">3.</span>
                <span>The receipt will automatically appear in your dashboard</span>
              </li>
            </ol>
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>💡 Tip:</strong> Add this email to your phone's contacts for quick access. 
                Supported formats: JPG, PNG, PDF (max 10MB per file)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
          <CardDescription className="dark:text-gray-400">
            Irreversible actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-600 dark:text-red-400">Delete Account</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                <strong>This will delete:</strong>
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside mt-1 space-y-0.5">
                <li>All receipts and their images</li>
                <li>All mileage claims and history</li>
                <li>All expense analytics and reports</li>
                <li>Your account and profile information</li>
              </ul>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            className="w-full sm:w-auto"
          >
            Delete Account
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Delete Account Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="text-sm font-medium text-red-800 dark:text-red-400 mb-2">
                The following will be deleted:
              </div>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                <li>✗ All receipts and images</li>
                <li>✗ All mileage claims</li>
                <li>✗ All expense history and analytics</li>
                <li>✗ Your account information</li>
              </ul>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <Label htmlFor="delete-confirm" className="text-sm font-medium">
                  Type <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono">DELETE</code> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  type="text"
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  You are authenticated via Clerk. No password verification needed.
                </p>
              </div>
            </div>
          </div>
          
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeletePassword('');
                setDeleteConfirmText('');
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmText !== 'DELETE'}
            >
              {isDeleting ? 'Deleting...' : 'Delete Account Permanently'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}