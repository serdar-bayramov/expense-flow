'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { LayoutDashboard, ReceiptPoundSterling, Settings, Upload, LogOut, BarChart3, Car, Crown, Zap, Sparkles, Menu } from 'lucide-react';
import { authAPI, API_URL } from '@/lib/api';
import { UploadReceiptModal } from '@/components/upload-receipt-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { UpgradePlanDialog } from '@/components/upgrade-plan-dialog';
import { useTheme } from 'next-themes';
import { useAuth, useUser, SignOutButton } from '@clerk/nextjs';


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPlan, setUserPlan] = useState<'free' | 'professional' | 'pro_plus'>('free');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [subscriptionUsage, setSubscriptionUsage] = useState<any>(null);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check authentication and fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      if (!isLoaded) return;
      
      if (!isSignedIn) {
        router.push('/login');
        return;
      }
      
      try {
        const token = await getToken();
        if (!token) {
          router.push('/login');
          return;
        }
        
        // Fetch user info from our backend
        const [user, usageResponse] = await Promise.all([
          authAPI.me(token),
          fetch(`${API_URL}/api/v1/users/me/subscription`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(res => {
            if (!res.ok) throw new Error('Subscription fetch failed');
            return res.json();
          }).catch(() => null) // Don't fail if subscription endpoint fails
        ]);
        setUserEmail(user.email);
        setUserPlan((user.subscription_plan || 'free') as 'free' | 'professional' | 'pro_plus');
        if (usageResponse) {
          setSubscriptionUsage(usageResponse);
        }
      } catch (error) {
        // Silently handle 401 errors (user not authenticated with backend yet)
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as any;
          if (axiosError.response?.status === 401) {
            console.log('User not yet created in backend, will be auto-created');
            setUserEmail('loading@example.com');
            setUserPlan('free');
            return;
          }
        }
        console.error('Failed to fetch user:', error);
        // Don't redirect to login - this causes infinite loop if backend returns 403
        // User is authenticated with Clerk, so show error state instead
        setUserEmail('error@example.com');
        setUserPlan('free');
      }
    };

    fetchUser();
  }, [isLoaded, isSignedIn, getToken, router]);

  const handlePlanUpdated = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const [user, usageResponse] = await Promise.all([
        authAPI.me(token),
        fetch(`${API_URL}/api/v1/users/me/subscription`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
          if (!res.ok) throw new Error('Subscription fetch failed');
          return res.json();
        }).catch(() => null)
      ]);
      setUserPlan((user.subscription_plan || 'free') as 'free' | 'professional' | 'pro_plus');
      if (usageResponse) {
        setSubscriptionUsage(usageResponse);
      }
    } catch (error) {
      console.error('Failed to refresh plan:', error);
    }
  };

  // Listen for subscription updates from settings page
  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      handlePlanUpdated();
    };
    
    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
  }, [getToken]);

  const getPlanBadge = () => {
    switch (userPlan) {
      case 'professional':
        return {
          label: 'Professional',
          icon: Sparkles,
          className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
        };
      case 'pro_plus':
        return {
          label: 'Pro Plus',
          icon: Crown,
          className: 'bg-gradient-to-r from-purple-100 to-yellow-100 text-purple-700 dark:from-purple-900/30 dark:to-yellow-900/30 dark:text-yellow-400 hover:from-purple-200 hover:to-yellow-200 dark:hover:from-purple-900/50 dark:hover:to-yellow-900/50'
        };
      default:
        return {
          label: 'Free',
          icon: Zap,
          className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        };
    }
  };

  const planBadge = getPlanBadge();
  const PlanIcon = planBadge.icon;

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Receipts', href: '/dashboard/receipts', icon: ReceiptPoundSterling },
    { name: 'Mileage', href: '/dashboard/mileage', icon: Car },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-800">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col grow border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center shrink-0 px-4 pt-0 pb-1">
            {mounted && (
              <Image 
                src={theme === 'dark' ? '/dark_logo.svg' : '/light_logo.svg'}
                alt="Expense Flow" 
                width={200} 
                height={65}
                className="w-40 h-auto -mt-2"
                priority
              />
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                              (item.href !== '/dashboard' && pathname?.startsWith(item.href));
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-lg
                    transition-colors
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                    }
                  `}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <div className="flex flex-col h-full bg-white dark:bg-zinc-800">
            {/* Logo */}
            <div className="flex items-center shrink-0 px-4 pt-4 pb-3">
              {mounted && (
                <Image 
                  src={theme === 'dark' ? '/dark_logo.svg' : '/light_logo.svg'}
                  alt="Expense Flow" 
                  width={200} 
                  height={65}
                  className="w-40 h-auto"
                  priority
                />
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const isActive = pathname === item.href || 
                                (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center px-3 py-2 text-sm font-medium rounded-lg
                      transition-colors
                      ${isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                      }
                    `}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="w-full">
          <div className="relative z-10 shrink-0 h-16 bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
            {/* Left side - Mobile menu button */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-4">
              {/* Plan Badge */}
              {mounted && (
                <div className="flex flex-col items-end">
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${planBadge.className}`}
                    title={`Current plan: ${planBadge.label}`}
                  >
                    <PlanIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{planBadge.label}</span>
                  </div>
                  {subscriptionUsage?.subscription_cancel_at_period_end && subscriptionUsage?.subscription_current_period_end && (
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 mt-0.5 hidden sm:block">
                      Cancels {new Date(subscriptionUsage.subscription_current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              )}
              
              {/* Theme toggle */}
              <ThemeToggle />
              
              {/* Upload button */}
              <Button className="gap-2" onClick={() => setUploadModalOpen(true)}>
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload Receipt</span>
              </Button>

              {/* User menu */}
              <div className="relative">
                <SignOutButton>
                  <button
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    <span className="hidden sm:inline">{userEmail}</span>
                    <LogOut className="h-4 w-4" />
                  </button>
                </SignOutButton>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-800">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Upload Modal */}
      <UploadReceiptModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        subscriptionUsage={subscriptionUsage}
        onUpgradeRequired={() => {
          setUploadModalOpen(false);
          setUpgradeDialogOpen(true);
        }}
        onUploadComplete={() => {
          // Refresh page to show new receipt
          window.location.reload();
        }}
      />

      {/* Upgrade Plan Dialog */}
      <UpgradePlanDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        currentPlan={userPlan}
        onPlanUpdated={handlePlanUpdated}
      />
    </div>
  );
}