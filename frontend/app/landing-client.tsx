'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SignedIn, SignedOut, UserButton, useAuth } from '@clerk/nextjs';
import { 
  Receipt, 
  Car, 
  TrendingUp, 
  FileText, 
  Shield, 
  Clock, 
  Check,
  X,
  Upload,
  BarChart3,
  Download,
  ChevronRight,
  Sparkles,
  ArrowRight,
  XCircle,
  CheckCircle2,
  Calculator,
  RefreshCw,
  Zap
} from 'lucide-react';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useEffect, useState, useRef } from 'react';
import { PLANS } from '@/lib/plans';
import { PricingCard } from '@/components/pricing-card';

export default function LandingClientPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Animated Counter Component
  function AnimatedCounter({ 
    from = 0, 
    to, 
    duration = 2, 
    suffix = '',
    prefix = '' 
  }: { 
    from?: number; 
    to: number; 
    duration?: number; 
    suffix?: string;
    prefix?: string;
  }) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true });
    const count = useMotionValue(from);
    const rounded = useTransform(count, (latest) => Math.round(latest));
    const [displayValue, setDisplayValue] = useState(from);

    useEffect(() => {
      if (inView) {
        const controls = animate(count, to, { duration });
        return controls.stop;
      }
    }, [inView, count, to, duration]);

    useEffect(() => {
      const unsubscribe = rounded.on('change', (latest) => {
        setDisplayValue(latest);
      });
      return unsubscribe;
    }, [rounded]);

    return (
      <div ref={ref} className="text-3xl font-bold text-primary mb-1">
        {prefix}{displayValue}{suffix}
      </div>
    );
  }

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/dashboard');
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const staggerChildren = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            {mounted && (
              <Image
                src={theme === 'dark' ? '/dark_logo.svg' : '/light_logo.svg'}
                alt="ExpenseFlow Logo"
                width={200}
                height={65}
                className="h-32 w-auto"
                priority
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

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 py-20 md:py-32 overflow-hidden">
        {/* Floating Receipt Mockups Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50 dark:opacity-10">
          {/* Receipt 1 - Top Left */}
          <motion.div
            className="absolute top-20 -left-10 w-48 h-64 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-lg shadow-2xl backdrop-blur-sm border border-gray-300/40 dark:border-white/20"
            animate={{
              y: [0, -20, 0],
              rotate: [-5, -8, -5],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="p-4 space-y-2">
              <div className="h-3 bg-gray-800/30 dark:bg-white/40 rounded w-3/4"></div>
              <div className="h-2 bg-gray-700/25 dark:bg-white/30 rounded w-1/2"></div>
              <div className="h-2 bg-gray-700/25 dark:bg-white/30 rounded w-2/3"></div>
              <div className="mt-4 h-4 bg-gray-900/35 dark:bg-white/50 rounded w-1/3"></div>
            </div>
          </motion.div>

          {/* Receipt 2 - Top Right */}
          <motion.div
            className="absolute top-32 -right-10 w-48 h-64 bg-gradient-to-br from-green-500/30 to-blue-500/30 rounded-lg shadow-2xl backdrop-blur-sm border border-gray-300/40 dark:border-white/20"
            animate={{
              y: [0, 20, 0],
              rotate: [5, 8, 5],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          >
            <div className="p-4 space-y-2">
              <div className="h-3 bg-gray-800/30 dark:bg-white/40 rounded w-3/4"></div>
              <div className="h-2 bg-gray-700/25 dark:bg-white/30 rounded w-1/2"></div>
              <div className="h-2 bg-gray-700/25 dark:bg-white/30 rounded w-2/3"></div>
              <div className="mt-4 h-4 bg-gray-900/35 dark:bg-white/50 rounded w-1/3"></div>
            </div>
          </motion.div>

          {/* Receipt 3 - Bottom Left */}
          <motion.div
            className="absolute -bottom-32 left-20 w-48 h-64 bg-gradient-to-br from-orange-500/30 to-red-500/30 rounded-lg shadow-2xl backdrop-blur-sm border border-gray-300/40 dark:border-white/20 hidden md:block"
            animate={{
              y: [0, -15, 0],
              rotate: [3, 6, 3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2
            }}
          >
            <div className="p-4 space-y-2">
              <div className="h-3 bg-gray-800/30 dark:bg-white/40 rounded w-3/4"></div>
              <div className="h-2 bg-gray-700/25 dark:bg-white/30 rounded w-1/2"></div>
              <div className="h-2 bg-gray-700/25 dark:bg-white/30 rounded w-2/3"></div>
              <div className="mt-4 h-4 bg-gray-900/35 dark:bg-white/50 rounded w-1/3"></div>
            </div>
          </motion.div>

          {/* Receipt 4 - Bottom Right */}
          <motion.div
            className="absolute -bottom-24 right-32 w-48 h-64 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-lg shadow-2xl backdrop-blur-sm border border-gray-300/40 dark:border-white/20 hidden md:block"
            animate={{
              y: [0, 15, 0],
              rotate: [-3, -6, -3],
            }}
            transition={{
              duration: 7.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5
            }}
          >
            <div className="p-4 space-y-2">
              <div className="h-3 bg-gray-800/30 dark:bg-white/40 rounded w-3/4"></div>
              <div className="h-2 bg-gray-700/25 dark:bg-white/30 rounded w-1/2"></div>
              <div className="h-2 bg-gray-700/25 dark:bg-white/30 rounded w-2/3"></div>
              <div className="mt-4 h-4 bg-gray-900/35 dark:bg-white/50 rounded w-1/3"></div>
            </div>
          </motion.div>
        </div>

        {/* Hero Content */}
        <motion.div
          className="relative z-10 text-center space-y-8"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
        >
          <Badge className="mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            Xero Integration - Built to HMRC Guidelines
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl mx-auto">
            Email receipts. Auto-sync to Xero. Tax returns sorted.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Just email or upload your receipts. Our AI extracts the data, categorises for HMRC, and syncs to Xero. Track mileage, view analytics, and export tax-ready reports.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/signup">
                Start Tracking Expenses Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">Learn More</a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            No credit card required • Free plan available • Snap and send from your phone
          </p>
        </motion.div>

        {/* Animated Flow Visualization */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-20 relative h-48 md:h-64 w-full max-w-6xl mx-auto px-4 overflow-hidden"
        >
          <div className="absolute inset-0 scale-[0.6] sm:scale-75 md:scale-90 lg:scale-100 origin-center">
          {/* Incoming Receipts (Left Side) - Mobile/Tablet */}
          {[0, 1, 2, 3, 4].map((index) => (
            <motion.div
              key={`receipt-sm-${index}`}
              className="absolute -left-24 sm:-left-16 md:left-0 top-1/2 w-20 h-28 bg-white rounded-sm shadow-lg border border-gray-200 lg:hidden"
              initial={{ x: -100, y: -40, opacity: 0, rotate: -15 }}
              animate={{
                x: [0, 160, 320],
                y: [-40, -40, -40],
                opacity: [0, 1, 1, 0],
                rotate: [-15, -8, 0],
                scale: [0.8, 1, 0.85]
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                delay: index * 1,
                ease: "easeInOut"
              }}
              style={{ transformOrigin: 'center' }}
            >
              <div className="p-2 space-y-0.5 text-[5px] leading-tight">
                {/* Receipt Header */}
                <div className="text-center font-bold border-b border-gray-300 pb-0.5 mb-1">
                  <div className="h-1.5 bg-gray-800 rounded w-2/3 mx-auto mb-0.5"></div>
                  <div className="h-0.5 bg-gray-500 rounded w-1/2 mx-auto"></div>
                </div>
                
                {/* Receipt Items */}
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <div className="h-1 bg-gray-700 rounded w-2/3"></div>
                    <div className="h-1 bg-gray-700 rounded w-1/5"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-1 bg-gray-600 rounded w-1/2"></div>
                    <div className="h-1 bg-gray-600 rounded w-1/5"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-1 bg-gray-600 rounded w-3/5"></div>
                    <div className="h-1 bg-gray-600 rounded w-1/5"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-1 bg-gray-600 rounded w-1/2"></div>
                    <div className="h-1 bg-gray-600 rounded w-1/5"></div>
                  </div>
                </div>
                
                {/* Total */}
                <div className="border-t border-gray-300 pt-0.5 mt-1">
                  <div className="flex justify-between items-center">
                    <div className="h-1.5 bg-gray-900 rounded w-1/3"></div>
                    <div className="h-1.5 bg-gray-900 rounded w-1/4"></div>
                  </div>
                </div>
                
                {/* Footer text */}
                <div className="mt-1 space-y-0.5">
                  <div className="h-0.5 bg-gray-400 rounded w-3/4 mx-auto"></div>
                  <div className="h-0.5 bg-gray-400 rounded w-2/3 mx-auto"></div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Incoming Receipts (Left Side) - Large Screen */}
          {[0, 1, 2, 3, 4].map((index) => (
            <motion.div
              key={`receipt-lg-${index}`}
              className="absolute left-0 top-1/2 w-20 h-28 bg-white rounded-sm shadow-lg border border-gray-200 hidden lg:block"
              initial={{ x: -100, y: -40, opacity: 0, rotate: -15 }}
              animate={{
                x: [0, 210, 420],
                y: [-40, -40, -40],
                opacity: [0, 1, 1, 0],
                rotate: [-15, -8, 0],
                scale: [0.8, 1, 0.85]
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                delay: index * 1,
                ease: "easeInOut"
              }}
              style={{ transformOrigin: 'center' }}
            >
              <div className="p-2 space-y-0.5 text-[5px] leading-tight">
                {/* Receipt Header */}
                <div className="text-center font-bold border-b border-gray-300 pb-0.5 mb-1">
                  <div className="h-1.5 bg-gray-800 rounded w-2/3 mx-auto mb-0.5"></div>
                  <div className="h-0.5 bg-gray-500 rounded w-1/2 mx-auto"></div>
                </div>
                
                {/* Receipt Items */}
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <div className="h-1 bg-gray-700 rounded w-2/3"></div>
                    <div className="h-1 bg-gray-700 rounded w-1/5"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-1 bg-gray-600 rounded w-1/2"></div>
                    <div className="h-1 bg-gray-600 rounded w-1/5"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-1 bg-gray-600 rounded w-3/5"></div>
                    <div className="h-1 bg-gray-600 rounded w-1/5"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-1 bg-gray-600 rounded w-1/2"></div>
                    <div className="h-1 bg-gray-600 rounded w-1/5"></div>
                  </div>
                </div>
                
                {/* Total */}
                <div className="border-t border-gray-300 pt-0.5 mt-1">
                  <div className="flex justify-between items-center">
                    <div className="h-1.5 bg-gray-900 rounded w-1/3"></div>
                    <div className="h-1.5 bg-gray-900 rounded w-1/4"></div>
                  </div>
                </div>
                
                {/* Footer text */}
                <div className="mt-1 space-y-0.5">
                  <div className="h-0.5 bg-gray-400 rounded w-3/4 mx-auto"></div>
                  <div className="h-0.5 bg-gray-400 rounded w-2/3 mx-auto"></div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Central App Box - AI Processing */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              className="relative w-64 h-56 bg-gradient-to-br from-primary/20 to-purple-500/20 backdrop-blur-md rounded-2xl border-2 border-primary/40 shadow-2xl overflow-hidden"
              animate={{
                boxShadow: [
                  '0 0 20px rgba(59, 130, 246, 0.3)',
                  '0 0 40px rgba(147, 51, 234, 0.5)',
                  '0 0 20px rgba(59, 130, 246, 0.3)',
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {/* Receipt Being Scanned */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="relative w-32 h-40 bg-white dark:bg-gray-100 rounded shadow-lg p-3"
                  animate={{
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  {/* Receipt Content */}
                  <div className="space-y-2">
                    <div className="h-2 bg-gray-800 rounded w-3/4"></div>
                    <div className="h-1.5 bg-gray-600 rounded w-1/2"></div>
                    <div className="h-1 bg-gray-400 rounded w-2/3"></div>
                    <div className="border-t border-gray-300 my-2"></div>
                    <div className="h-1 bg-gray-500 rounded w-full"></div>
                    <div className="h-1 bg-gray-500 rounded w-4/5"></div>
                    <div className="border-t border-gray-300 my-2"></div>
                    <div className="h-2 bg-gray-700 rounded w-1/2"></div>
                  </div>

                  {/* Scanning Highlight */}
                  <motion.div
                    className="absolute inset-0 border-2 border-primary rounded"
                    animate={{
                      opacity: [0, 1, 0],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                </motion.div>
              </div>

              {/* AI Sparkle - Top Right Corner */}
              <div className="absolute top-3 right-3 z-20">
                <motion.div
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.3, 1],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-6 w-6 text-primary" />
                </motion.div>
              </div>

              {/* App Label */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                <p className="text-xs font-semibold text-primary">AI Extracting Data</p>
              </div>
            </motion.div>
          </div>

          {/* Flying Data Tags - Going to Xero (Outside the box) */}
          {[
            { text: '£45.20', delay: 0, offset: -60, color: 'bg-green-500' },
            { text: 'IKEA', delay: 0.5, offset: -30, color: 'bg-blue-500' },
            { text: 'Office Supplies', delay: 1, offset: 0, color: 'bg-purple-500' },
            { text: 'VAT £9.04', delay: 1.5, offset: 30, color: 'bg-orange-500' },
            { text: '15 Feb 2026', delay: 2, offset: 60, color: 'bg-pink-500' },
          ].map((item, index) => (
            <motion.div
              key={'data-tag-' + index}
              className={'absolute left-1/2 top-1/2 px-2 py-1 text-white text-xs rounded-md shadow-lg whitespace-nowrap font-semibold z-30 ' + item.color}
              style={{ marginTop: item.offset + 'px' }}
              animate={{
                x: [0, 200, 360, 380],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: item.delay,
                ease: "easeInOut"
              }}
            >
              {item.text}
            </motion.div>
          ))}

          {/* Xero Logo/Badge (Right Side) */}
          <motion.div
            className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:block"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <motion.div
              className="w-32 h-32 bg-white dark:bg-white rounded-2xl flex items-center justify-center border-2 border-blue-500/30 p-4"
            >
              <Image 
                src="/XeroLogo.png" 
                alt="Xero" 
                width={96} 
                height={96}
                className="object-contain"
              />
            </motion.div>
          </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Problem/Solution Section */}
      <section className="container mx-auto px-4 py-20 bg-gradient-to-b from-background to-muted/20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Stop Losing Money to Poor Expense Management
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            UK freelancers waste 3-5 hours monthly on expense tracking. We automate it all.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 items-start max-w-6xl mx-auto">
          {/* Problems Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-card border-2 border-red-200 dark:border-red-900/30 rounded-xl p-8 shadow-lg"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-2xl font-bold">The Old Way</h3>
            </div>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Lost receipts at tax time</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Scrambling through emails and photos when HMRC asks</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Hours on manual data entry</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Typing receipts into spreadsheets or Xero one by one</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Confused by HMRC compliance</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Which category? Can I claim this? What rate?</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Mileage logs scattered everywhere</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Sticky notes, phone notes, memory – never accurate</p>
                </div>
              </li>
            </ul>
            <div className="mt-6 pt-6 border-t border-red-200 dark:border-red-900/30">
              <p className="text-center text-red-700 dark:text-red-300 font-semibold">
                💸 Average loss: £2,000+ in unclaimed expenses yearly
              </p>
            </div>
          </motion.div>

          {/* Solutions Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-card border-2 border-green-200 dark:border-green-900/30 rounded-xl p-8 shadow-lg"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold">The ExpenseFlow Way</h3>
            </div>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Email receipts, we handle the rest</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Forward to your unique email. AI extracts everything.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Auto-syncs to Xero</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Approved receipts flow directly to your accounting</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">HMRC-compliant categories</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">AI suggests correct categories. Built-in tax calculator.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Smart mileage tracking</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Save routes as templates. One tap to log journeys.</p>
                </div>
              </li>
            </ul>
            <div className="mt-6 pt-6 border-t border-green-200 dark:border-green-900/30">
              <p className="text-center text-green-700 dark:text-green-300 font-semibold">
                ⚡ Save 3-5 hours monthly. Claim every expense.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto"
        >
          <div className="text-center p-4">
            <AnimatedCounter from={0} to={5} duration={2} suffix="hrs" />
            <div className="text-sm text-muted-foreground">Saved Monthly</div>
          </div>
          <div className="text-center p-4">
            <AnimatedCounter from={0} to={2} duration={1.5} suffix=" secs" />
            <div className="text-sm text-muted-foreground">Receipt Processing</div>
          </div>
          <div className="text-center p-4">
            <AnimatedCounter from={0} to={100} duration={2} suffix="%" />
            <div className="text-sm text-muted-foreground">HMRC Compliant</div>
          </div>
          <div className="text-center p-4">
            <AnimatedCounter from={0} to={0} duration={1} prefix="£" />
            <div className="text-sm text-muted-foreground">To Get Started</div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-12 bg-muted/30">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to know</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Built specifically for UK freelancers, sole traders & contractors
          </p>
        </div>
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={staggerChildren}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          {[
            {
              icon: Receipt,
              title: 'AI-Powered Receipt Scanning',
              description: 'Upload or email receipts - our advanced OCR extracts merchant, amount, date, and tax in seconds. Process multiple receipts at once.'
            },
            {
              icon: RefreshCw,
              title: 'Xero Integration',
              description: 'Automatically sync expenses to Xero. Connect once and let receipts flow directly into your accounting system - saves hours of manual data entry.'
            },
            {
              icon: Upload,
              title: 'Email Receipt Forwarding',
              description: 'Got a receipt while out? Just forward it to your unique email address. No app needed - perfect for capturing expenses on-the-go.'
            },
            {
              icon: Calculator,
              title: 'Real-Time UK Tax Calculator',
              description: 'See exactly how much tax you\'ll save with every expense tracked.'
            },
            {
              icon: Shield,
              title: 'Duplicate Detection',
              description: 'Automatically flags potential duplicate receipts. Never accidentally claim the same expense twice - keeps your records clean and compliant.'
            },
            {
              icon: Car,
              title: 'Mileage Tracking with Templates',
              description: 'Save frequent routes (office-client, home-warehouse). Log mileage in 3 taps with HMRC-compliant rate calculation'
            },
            {
              icon: TrendingUp,
              title: 'Real-time Analytics',
              description: 'Track spending patterns and category breakdowns with visual dashboards'
            },
            {
              icon: FileText,
              title: 'Tax Year Reports',
              description: 'Generate professional reports ready for your accountant or HMRC submission'
            }
          ].map((feature, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently asked questions</h2>
          <p className="text-xl text-muted-foreground">Everything you need to know</p>
        </div>
        <motion.div
          className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          variants={staggerChildren}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          {[
            {
              question: 'Can I email multiple receipts at once?',
              answer: 'Yes! Send as many attachments as you want in one email. We\'ll process each receipt separately and add them all to your account. Perfect for end-of-day expense batches.'
            },
            {
              question: 'How does Xero integration work?',
              answer: 'Connect your Xero account once with secure OAuth. Approved receipts automatically sync as bank transactions with images attached. Saves hours of manual data entry each month.'
            },
            {
              question: 'What file types work with email forwarding?',
              answer: 'JPG, PNG, and PDF files up to 10MB per attachment. Just forward receipts directly from your phone or email - no app download needed.'
            },
            {
              question: 'Is my data secure?',
              answer: 'Yes. All data is encrypted in transit and at rest. We use industry-standard security practices and your data is stored in secure UK data centers.'
            },
            {
              question: 'Does this follow HMRC guidelines?',
              answer: 'Yes. ExpenseFlow is built following Making Tax Digital guidelines for expense categorisation, record keeping, and mileage rates. Reports are designed to be tax-ready.'
            },
            {
              question: 'Do I need accounting knowledge?',
              answer: 'Not at all. ExpenseFlow handles the complex stuff automatically. Just email or upload receipts and we\'ll organise everything for HMRC.'
            },
            {
              question: 'Can I cancel anytime?',
              answer: 'Absolutely. No contracts, no hidden fees. Cancel with one click and keep access until the end of your billing period.'
            }
          ].map((faq, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card>
                <CardContent className="p-6 space-y-2">
                  <h3 className="font-semibold">{faq.question}</h3>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-xl text-muted-foreground">
            Choose the plan that fits your business. Upgrade or downgrade anytime.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <PricingCard
                plan={plan}
                onSelectPlan={() => {
                  // All plans start with free signup - user upgrades from dashboard
                  router.push('/signup');
                }}
                showCTA={true}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to simplify your expenses?
          </h2>
          <p className="text-xl mb-8 text-muted-foreground">
            Join UK freelancers, sole traders & contractors saving 3-5 hours every month
          </p>
          <Button size="lg" asChild>
            <Link href="/signup">
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <p className="text-sm mt-4 text-muted-foreground">
            No credit card required • Cancel anytime
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                {mounted && (
                  <Image
                    src={theme === 'dark' ? '/dark_logo.svg' : '/light_logo.svg'}
                    alt="ExpenseFlow Logo"
                    width={200}
                    height={65}
                    className="h-32 w-auto"
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Email-powered expense tracking for UK freelancers, sole traders & contractors.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary">Pricing</a></li>
                <li><a href="#faq" className="hover:text-primary">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a className="hover:text-primary" href="/contact">Contact</a></li>
                <li><a className="hover:text-primary" href="/privacy">Privacy</a></li>
                <li><a className="hover:text-primary" href="/terms">Terms</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a className="hover:text-primary" href="/docs">Documentation</a></li>
                <li><a className="hover:text-primary" href="/login">Login</a></li>
                <li><a className="hover:text-primary" href="/signup">Sign Up</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} ExpenseFlow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
