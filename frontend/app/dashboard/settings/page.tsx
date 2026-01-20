'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (!user) {
    return <div className="dark:text-white">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Manage your account settings and preferences
        </p>
      </div>

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
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg text-sm font-mono">
              {user.unique_receipt_email}
            </code>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(user.unique_receipt_email);
              }}
            >
              Copy
            </Button>
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
          <Button
            variant="destructive"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}