import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>
              <p className="text-muted-foreground mb-4">
                ExpenseFlow collects information you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Account information (email address, name)</li>
                <li>Receipt images and expense data</li>
                <li>Mileage and journey information</li>
                <li>Payment information (processed securely by third-party providers)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
              <p className="text-muted-foreground mb-4">We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Provide, maintain, and improve our services</li>
                <li>Process receipt data using OCR and AI</li>
                <li>Generate expense reports and analytics</li>
                <li>Send you technical notices and support messages</li>
                <li>Comply with HMRC guidelines and legal obligations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">3. Data Storage and Security</h2>
              <p className="text-muted-foreground mb-4">
                Your data is stored securely using industry-standard encryption:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Receipt images stored in Google Cloud Storage (UK/EU regions)</li>
                <li>Database hosted on secure servers with encryption at rest and in transit</li>
                <li>Regular security audits and updates</li>
                <li>Access limited to essential personnel only</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">4. Data Sharing</h2>
              <p className="text-muted-foreground mb-4">
                We do not sell your personal data. We share data only with:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Service providers (hosting, OCR, email processing) under strict confidentiality</li>
                <li>When required by law or to protect our legal rights</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">5. Your Rights (GDPR)</h2>
              <p className="text-muted-foreground mb-4">
                Under UK GDPR, you have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Object to processing of your data</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">6. Data Retention</h2>
              <p className="text-muted-foreground mb-4">
                We retain your data for as long as your account is active. If you delete your account:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Data is retained for 30 days to allow for recovery</li>
                <li>After 30 days, all personal data is permanently deleted</li>
                <li>Some aggregated, anonymised data may be retained for analytics</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">7. Cookies</h2>
              <p className="text-muted-foreground">
                We use essential cookies to maintain your login session and preferences. 
                No tracking or advertising cookies are used.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">8. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this privacy policy from time to time. We will notify you of any 
                significant changes by email or through the service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">9. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about this privacy policy or your data, contact us at:{' '}
                <a href="mailto:suppport@expenseflow.co.uk" className="text-primary hover:underline font-medium">
                  support@expenseflow.co.uk
                </a>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-sm">
                <strong className="text-foreground">Data Controller:</strong> <span className="text-muted-foreground">ExpenseFlow</span><br />
                <strong className="text-foreground">Contact:</strong> <a href="mailto:support@expenseflow.co.uk" className="text-primary hover:underline">support@expenseflow.co.uk</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
