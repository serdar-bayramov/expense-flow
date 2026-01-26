'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight } from 'lucide-react';

export function LandingHero() {
  return (
    <section className="relative py-20 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-8"
        >
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            Built to HMRC Guidelines
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl mx-auto">
            Expense tracking made simple for UK freelancers
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Stop losing receipts and wasting hours on spreadsheets. ExpenseFlow automates your expense tracking with AI-powered receipt scanning and intelligent categorisation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            No credit card required • Free forever plan available
          </p>
        </motion.div>
      </div>
    </section>
  );
}
