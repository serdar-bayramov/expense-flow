'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authAPI } from '@/lib/api';
import { toast } from 'sonner';

// Beta mode - matches backend setting
const IS_BETA_MODE = process.env.NEXT_PUBLIC_BETA_MODE !== 'false';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [inviteCode, setInviteCode] = useState(searchParams.get('code') || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const registerData = { 
        email, 
        password,
        full_name: fullName || undefined,
        invite_code: inviteCode || undefined
      };
      
      // Call register API with invite code
      await authAPI.register(registerData);
      
      // Show success message
      toast.success('Account created! Please sign in.');
      
      // Redirect to login
      router.push('/login');
    } catch (error: any) {
      // Show error message
      const message = error.response?.data?.detail || 'Signup failed';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-800 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold dark:text-white">
            {IS_BETA_MODE ? 'Join the Beta' : 'Create an account'}
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            {IS_BETA_MODE 
              ? 'Enter your beta invite code to get started'
              : 'Enter your details to get started with xpense'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {IS_BETA_MODE && (
              <div className="space-y-2">
                <Label htmlFor="inviteCode" className="dark:text-gray-300">
                  Beta Invite Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inviteCode"
                  type="text"
                  placeholder="BETA-XXXX-XXXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  required={IS_BETA_MODE}
                  disabled={isLoading}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Don't have a code? Contact us to request beta access.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="dark:text-gray-300">Full Name (optional)</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="dark:text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="dark:text-gray-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Must be at least 8 characters
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
          
          <div className="mt-4 text-center text-sm dark:text-gray-300">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}