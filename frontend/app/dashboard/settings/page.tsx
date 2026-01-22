'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast({
        variant: 'destructive',
        title: 'Confirmation Required',
        description: 'Please type DELETE to confirm account deletion',
      });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setIsDeleting(true);
      await authAPI.deleteAccount(token, deletePassword, deleteConfirmText);
      
      toast({
        title: 'Account Deleted',
        description: 'Your account and all data have been permanently deleted',
        className: 'border-gray-200 dark:border-gray-700',
      });

      // Clear local storage and redirect
      localStorage.removeItem('token');
      router.push('/login');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: error.response?.data?.detail || 'Failed to delete account. Please check your password.',
        className: 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100',
      });
    } finally {
      setIsDeleting(false);
    }
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
                <Label htmlFor="delete-password" className="text-sm font-medium">
                  Enter your password to confirm
                </Label>
                <Input
                  id="delete-password"
                  type="password"
                  placeholder="Your password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="mt-1.5"
                />
              </div>

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
              disabled={isDeleting || deleteConfirmText !== 'DELETE' || !deletePassword}
            >
              {isDeleting ? 'Deleting...' : 'Delete Account Permanently'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}