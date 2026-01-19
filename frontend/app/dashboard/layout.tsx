'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, ReceiptPoundSterling, Settings, Upload, LogOut } from 'lucide-react';
import { authAPI } from '@/lib/api';


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string>('');

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
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col grow border-r border-gray-200 bg-white overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center shrink-0 px-4 pt-4 pb-3">
            <Image 
              src="/xpense_5_light.png" 
              alt="Expense Flow" 
              width={160} 
              height={40}
              className="w-32 h-auto"
              priority
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-2 text-sm font-medium rounded-lg
                    transition-colors
                    ${isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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
          <div className="relative z-10 shrink-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
            {/* Left side - could add breadcrumbs later */}
            <div className="flex-1" />

            {/* Right side - Actions */}
            <div className="flex items-center gap-4">
              {/* Upload button */}
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Receipt
              </Button>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  <span>{userEmail}</span>
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}