'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, ReceiptPoundSterling, Settings, Upload, LogOut, BarChart3, Car } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { UploadReceiptModal } from '@/components/upload-receipt-modal';
import { ThemeToggle } from '@/components/theme-toggle';
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
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

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
        const user = await authAPI.me(token);
        setUserEmail(user.email);
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
          <div className="flex items-center shrink-0 px-4 pt-4 pb-3">
            {mounted && (
              <Image 
                src={theme === 'dark' ? '/xpense_5_dark.svg' : '/xpense_5_light.svg'}
                alt="Expense Flow" 
                width={240} 
                height={80}
                className="w-44 h-auto"
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
        onUploadComplete={() => {
          // Refresh page to show new receipt
          window.location.reload();
        }}
      />
    </div>
  );
}