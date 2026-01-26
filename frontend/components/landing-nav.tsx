'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export function LandingNav() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center space-x-2">
          {mounted && (
            <Image 
              src={theme === 'dark' ? '/dark_logo.svg' : '/light_logo.svg'} 
              alt="ExpenseFlow" 
              width={240} 
              height={80} 
              className="h-32 w-auto" 
            />
          )}
        </div>
        <div className="hidden md:flex items-center space-x-6">
          <a href="#features" className="text-sm font-medium hover:text-primary">Features</a>
          <a href="#pricing" className="text-sm font-medium hover:text-primary">Pricing</a>
          <a href="#faq" className="text-sm font-medium hover:text-primary">FAQ</a>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="ghost" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
