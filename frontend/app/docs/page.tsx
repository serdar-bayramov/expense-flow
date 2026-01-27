import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, Mail, Car, FileText, BarChart3 } from 'lucide-react';

export default function DocumentationPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold mb-4">Documentation</h1>
        <p className="text-xl text-muted-foreground mb-12">
          Everything you need to know about using ExpenseFlow
        </p>

        <div className="space-y-8">
          {/* Getting Started */}
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Set up your account and start tracking expenses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">1. Create Your Account</h3>
                <p className="text-sm text-muted-foreground">
                  Sign up at <Link href="/signup" className="text-primary hover:underline">expenseflow.co.uk/signup</Link>. 
                  You'll receive a unique receipt email address like <code className="bg-muted px-2 py-1 rounded">yourname-abc123@receipts.expenseflow.co.uk</code>
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2. Choose Your Plan</h3>
                <p className="text-sm text-muted-foreground">
                  Start with our Free plan (10 receipts/month) or upgrade to Professional (100 receipts/month) for £10/month.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Uploading Receipts */}
          <Card>
            <CardHeader>
              <Upload className="h-6 w-6 mb-2" />
              <CardTitle>Uploading Receipts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Method 1: Upload Directly</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Click "Upload Receipt" in your dashboard</li>
                  <li>Select JPG, PNG, or PDF (max 10MB)</li>
                  <li>Our AI extracts merchant, amount, date, and tax</li>
                  <li>Review and save - takes seconds!</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Method 2: Email Forwarding</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Forward receipts to your unique email address</li>
                  <li>Send multiple receipts in one email</li>
                  <li>Works from any email provider (Gmail, Outlook, etc.)</li>
                  <li>Perfect for capturing expenses on-the-go</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Mileage Tracking */}
          <Card>
            <CardHeader>
              <Car className="h-6 w-6 mb-2" />
              <CardTitle>Mileage Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Create Journey Templates</h3>
                <p className="text-sm text-muted-foreground">
                  Save frequent routes (e.g., "Office to Client Site") to log mileage in 3 taps. 
                  We use Google Maps for accurate distances and HMRC rates for calculations.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">HMRC Mileage Rates</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Car: 45p per mile (first 10,000 miles), then 25p</li>
                  <li>Motorcycle: 24p per mile</li>
                  <li>Bike: 20p per mile</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Analytics */}
          <Card>
            <CardHeader>
              <BarChart3 className="h-6 w-6 mb-2" />
              <CardTitle>Analytics Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                View your spending patterns, category breakdowns, and monthly trends. Filter by date range to see exactly where your money goes.
              </p>
              <div>
                <h3 className="font-semibold mb-2">HMRC Expense Categories</h3>
                <p className="text-sm text-muted-foreground">
                  All expenses are categorised according to HMRC guidelines: Office Costs, Travel, Staff Costs, Marketing, Stock & Materials, and more.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Exporting Reports */}
          <Card>
            <CardHeader>
              <FileText className="h-6 w-6 mb-2" />
              <CardTitle>Exporting Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Export Formats</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li><strong>CSV:</strong> Import into Excel or accounting software</li>
                  <li><strong>PDF:</strong> Professional reports for accountants (Pro Plus)</li>
                  <li><strong>Images:</strong> Bulk download all receipt images (Pro Plus)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Tax Year Reports</h3>
                <p className="text-sm text-muted-foreground">
                  Generate reports by tax year (6 April - 5 April) ready for Self Assessment or your accountant.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Need Help? */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Still have questions?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Check our <Link href="/#faq" className="text-primary hover:underline">FAQ section</Link> or 
                reach out via our <Link href="/contact" className="text-primary hover:underline">contact page</Link>.
              </p>
              <Button asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
