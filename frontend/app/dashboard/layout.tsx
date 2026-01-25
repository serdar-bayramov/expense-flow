'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, ReceiptPoundSterling, Settings, Upload, LogOut, BarChart3, Car, Crown, Zap, Sparkles } from 'lucide-react';
import { authAPI, API_URL } from '@/lib/api';
import { UploadReceiptModal } from '@/components/upload-receipt-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { UpgradePlanDialog } from '@/components/upgrade-plan-dialog';
import { useTheme } from 'next-themes';


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPlan, setUserPlan] = useState<'free' | 'professional' | 'pro_plus'>('free');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [subscriptionUsage, setSubscriptionUsage] = useState<any>(null);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check authentication
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      try {
        // Fetch user info from backend
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
        // Token invalid or expired, redirect to login
        console.error('Failed to fetch user:', error);
        localStorage.removeItem('token');
        router.push('/login');
      }
    };

    fetchUser();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const handlePlanUpdated = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const user = await authAPI.me(token);
      setUserPlan((user.subscription_plan || 'free') as 'free' | 'professional' | 'pro_plus');
    } catch (error) {
      console.error('Failed to refresh plan:', error);
    }
  };

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
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col grow border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center shrink-0 px-4 pt-0 pb-1">
            {mounted && (
              <Image 
                src={theme === 'dark' ? '/dark_logo.svg' : '/light_logo.svg'}
                alt="Expense Flow" 
                width={240} 
                height={80}
                className="w-48 h-auto -mt-2"
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

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="w-full">
          <div className="relative z-10 shrink-0 h-16 bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
            {/* Left side - could add breadcrumbs later */}
            <div className="flex-1" />

            {/* Right side - Actions */}
            <div className="flex items-center gap-4">
              {/* Plan Badge */}
              {mounted && (
                <button
                  onClick={() => setUpgradeDialogOpen(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${planBadge.className}`}
                  title="Click to manage subscription"
                >
                  <PlanIcon className="h-4 w-4" />
                  {planBadge.label}
                </button>
              )}
              
              {/* Theme toggle */}
              <ThemeToggle />
              
              {/* Upload button */}
              <Button className="gap-2" onClick={() => setUploadModalOpen(true)}>
                <Upload className="h-4 w-4" />
                Upload Receipt
              </Button>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  <span>{userEmail}</span>
                  <LogOut className="h-4 w-4" />
                </button>
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