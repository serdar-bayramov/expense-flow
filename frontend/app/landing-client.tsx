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
  CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function LandingClientPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

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
      <section className="container mx-auto px-4 py-20 md:py-32">
        <motion.div
          className="text-center space-y-8"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
        >
          <Badge className="mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            Built to HMRC Guidelines
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl mx-auto">
            Email or upload receipts. We'll handle the rest.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Just email or upload your receipts. Our AI extracts the data, categorises for HMRC, and organises everything. Track mileage, view analytics, and export tax-ready reports.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/signup">
                Get Started
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
      </section>

      {/* Problem/Solution Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold mb-6">Tired of messy expense tracking?</h2>
            <ul className="space-y-4">
              <li className="flex items-start">
                <XCircle className="h-5 w-5 text-destructive mt-1 mr-3 shrink-0" />
                <span>Lost receipts at tax time</span>
              </li>
              <li className="flex items-start">
                <XCircle className="h-5 w-5 text-destructive mt-1 mr-3 shrink-0" />
                <span>No time to log expenses during busy day</span>
              </li>
              <li className="flex items-start">
                <XCircle className="h-5 w-5 text-destructive mt-1 mr-3 shrink-0" />
                <span>Hours spent on manual data entry</span>
              </li>
              <li className="flex items-start">
                <XCircle className="h-5 w-5 text-destructive mt-1 mr-3 shrink-0" />
                <span>Confused by HMRC compliance rules</span>
              </li>
              <li className="flex items-start">
                <XCircle className="h-5 w-5 text-destructive mt-1 mr-3 shrink-0" />
                <span>Mileage logs scattered everywhere</span>
              </li>
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold mb-6">ExpenseFlow makes it effortless</h2>
            <ul className="space-y-4">
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 mr-3 shrink-0" />
                <span>Upload or email receipts - process multiple at once</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 mr-3 shrink-0" />
                <span>Auto-categorised with HMRC categories</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 mr-3 shrink-0" />
                <span>Automatic duplicate detection - never claim twice</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 mr-3 shrink-0" />
                <span>Track mileage with saved journey templates</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 mr-3 shrink-0" />
                <span>View spending analytics and insights</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 mr-3 shrink-0" />
                <span>Save 3-5 hours per month on expense tracking</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-1 mr-3 shrink-0" />
                <span>Generate tax-ready reports in seconds</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20 bg-muted/30">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need</h2>
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
              icon: Upload,
              title: 'Email Receipt Forwarding',
              description: 'Got a receipt while out? Just forward it to your unique email address. No app needed - perfect for capturing expenses on-the-go.'
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

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
          <p className="text-xl text-muted-foreground">Three simple steps to organized expenses</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              number: 1,
              title: 'Upload or Email Receipts',
              description: 'Sign up and start uploading receipts directly, or use your unique email address to forward them on-the-go.'
            },
            {
              number: 2,
              title: 'AI Extracts Everything',
              description: 'Our AI automatically extracts all data and categorises expenses for HMRC. Track mileage with journey templates.'
            },
            {
              number: 3,
              title: 'Export Tax Reports',
              description: 'View organised expenses in your dashboard. Generate tax-ready reports in one click.'
            }
          ].map((step) => (
            <motion.div
              key={step.number}
              className="text-center space-y-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: step.number * 0.1 }}
            >
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold mx-auto">
                {step.number}
              </div>
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-4 py-20 bg-muted/30">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-xl text-muted-foreground">Beta launch: 50 receipts free!</p>
          <p className="text-sm text-muted-foreground mt-2">Paid plans coming soon</p>
        </div>
        <motion.div
          className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          variants={staggerChildren}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          {/* Free Plan - Beta Active */}
          <motion.div variants={fadeInUp}>
            <Card className="h-full border-primary shadow-lg scale-105">
              <CardContent className="p-6 space-y-6">
                <Badge className="mb-2">Beta Launch - Active Now</Badge>
                <div>
                  <h3 className="text-2xl font-bold">Free Beta</h3>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold">£0</span>
                    <span className="text-muted-foreground ml-2">/month</span>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                    🎉 50 receipts during beta (returns to 10 after)
                  </p>
                </div>
                <ul className="space-y-3">
                  {[
                    '50 receipts per month (beta)',
                    '10 mileage claims per month',
                    'Upload or email receipts',
                    'AI-powered OCR scanning',
                    'Analytics dashboard',
                    'CSV export',
                    'Journey templates',
                    'Email support'
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" asChild>
                  <Link href="/signup">Get Started</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Professional Plan - Coming Soon */}
          <motion.div variants={fadeInUp}>
            <Card className="h-full opacity-60">
              <CardContent className="p-6 space-y-6">
                <Badge variant="secondary" className="mb-2">Coming Soon</Badge>
                <div>
                  <h3 className="text-2xl font-bold">Professional</h3>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold">£10</span>
                    <span className="text-muted-foreground ml-2">/month</span>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    '100 receipts per month',
                    '50 mileage claims per month',
                    'Upload or email receipts',
                    'AI-powered OCR scanning',
                    'Analytics dashboard',
                    'CSV export',
                    'Journey templates',
                    'Email support'
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <CheckCircle2 className="h-5 w-5 text-gray-400 mr-2 shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full" disabled>
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pro Plus Plan - Coming Soon */}
          <motion.div variants={fadeInUp}>
            <Card className="h-full opacity-60">
              <CardContent className="p-6 space-y-6">
                <Badge variant="secondary" className="mb-2">Coming Soon</Badge>
                <div>
                  <h3 className="text-2xl font-bold">Pro Plus</h3>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold">£17</span>
                    <span className="text-muted-foreground ml-2">/month</span>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    '500 receipts per month',
                    '200 mileage claims per month',
                    'Upload or email receipts',
                    'AI-powered OCR scanning',
                    'Analytics dashboard',
                    'CSV + PDF + Image export',
                    'Journey templates',
                    'Priority support'
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <CheckCircle2 className="h-5 w-5 text-gray-400 mr-2 shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full" disabled>
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </motion.div>
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

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <motion.div
          className="bg-linear-to-r from-primary to-primary/80 rounded-2xl p-12 text-center text-primary-foreground"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to simplify your expenses?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join UK freelancers, sole traders & contractors saving 3-5 hours every month
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/signup">
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <p className="text-sm mt-4 opacity-75">
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
