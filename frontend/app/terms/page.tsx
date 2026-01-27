import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using ExpenseFlow ("the Service"), you accept and agree to be bound by 
                these Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground mb-4">
                ExpenseFlow provides expense tracking, receipt scanning, mileage tracking, and reporting 
                services for UK freelancers, sole traders, and contractors. The Service includes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>AI-powered receipt scanning and data extraction</li>
                <li>Email receipt forwarding</li>
                <li>Mileage tracking with HMRC-compliant calculations</li>
                <li>Expense analytics and reporting</li>
                <li>Data export in various formats</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">3. User Accounts</h2>
              <p className="text-muted-foreground mb-4">To use the Service, you must:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Be at least 18 years old</li>
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                You are responsible for all activity that occurs under your account.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">4. Subscription Plans and Payment</h2>
              <p className="text-muted-foreground mb-4">
                ExpenseFlow offers Free, Professional, and Pro Plus plans:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Free plan: No payment required, limited features</li>
                <li>Paid plans: Monthly subscription, auto-renewal unless cancelled</li>
                <li>Payments processed securely via third-party providers</li>
                <li>You can cancel anytime - no long-term contracts</li>
                <li>Refunds: Pro-rated if cancelled within billing period</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">5. Usage Limits</h2>
              <p className="text-muted-foreground mb-4">
                Each plan has monthly limits on receipts and mileage claims. If you exceed your limits:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You'll be prompted to upgrade to a higher plan</li>
                <li>No additional charges without your explicit consent</li>
                <li>Limits reset on your billing date each month</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">6. Acceptable Use</h2>
              <p className="text-muted-foreground mb-4">You agree not to:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Upload illegal, harmful, or offensive content</li>
                <li>Attempt to breach security or access others' accounts</li>
                <li>Use the Service for fraudulent purposes</li>
                <li>Reverse engineer or copy the Service</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">7. Data Accuracy and HMRC Compliance</h2>
              <p className="text-muted-foreground mb-4">
                While ExpenseFlow categorises expenses according to HMRC guidelines:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You are responsible for verifying data accuracy</li>
                <li>We recommend consulting a qualified accountant for tax advice</li>
                <li>ExpenseFlow is a record-keeping tool, not tax advice</li>
                <li>You remain responsible for your tax obligations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">8. Intellectual Property</h2>
              <p className="text-muted-foreground">
                The Service and its content (excluding user-uploaded data) are owned by ExpenseFlow. 
                You retain ownership of your uploaded receipts and expense data.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">9. Service Availability</h2>
              <p className="text-muted-foreground mb-4">
                We strive for 99.9% uptime but cannot guarantee uninterrupted service. We are not 
                liable for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Temporary service interruptions</li>
                <li>Scheduled maintenance downtime</li>
                <li>Third-party service failures</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">10. Limitation of Liability</h2>
              <p className="text-muted-foreground mb-4">
                ExpenseFlow is provided "as is". We are not liable for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Loss of data (though we maintain regular backups)</li>
                <li>Business losses or lost profits</li>
                <li>Tax penalties resulting from incorrect data entry</li>
                <li>Indirect or consequential damages</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Our total liability is limited to the amount you paid in the past 12 months.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">11. Termination</h2>
              <p className="text-muted-foreground mb-4">
                You can delete your account at any time from Settings. We may terminate accounts that:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Violate these terms</li>
                <li>Engage in abusive or fraudulent behaviour</li>
                <li>Remain inactive for extended periods (after notice)</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Upon termination, your data is retained for 30 days then permanently deleted.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">12. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may update these terms from time to time. Significant changes will be communicated 
                via email. Continued use after changes constitutes acceptance.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">13. Governing Law</h2>
              <p className="text-muted-foreground">
                These terms are governed by the laws of England and Wales. Any disputes will be 
                resolved in UK courts.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">14. Contact</h2>
              <p className="text-muted-foreground">
                Questions about these terms? Contact us at:{' '}
                <a href="mailto:support@expenseflow.co.uk" className="text-primary hover:underline font-medium">
                  support@expenseflow.co.uk
                </a>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-sm">
                By using ExpenseFlow, you acknowledge that you have read, understood, and agree to 
                be bound by these Terms of Service and our <Link href="/privacy" className="text-primary hover:underline font-medium">Privacy Policy</Link>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
