import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail, MessageSquare } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
        <p className="text-xl text-muted-foreground mb-12">
          We're here to help. Get in touch with any questions.
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Mail className="h-6 w-6 mb-2" />
              <CardTitle>Email Support</CardTitle>
              <CardDescription>We typically respond within 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                For general inquiries, technical support, or feedback:
              </p>
              <a 
                href="mailto:support@expenseflow.co.uk" 
                className="text-primary hover:underline font-medium"
              >
                support@expenseflow.co.uk
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <MessageSquare className="h-6 w-6 mb-2" />
              <CardTitle>Before You Contact Us</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Check if your question is answered in our resources:
              </p>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/docs" className="text-primary hover:underline">
                    📚 Documentation
                  </Link>
                  {' '}- Complete guides on using ExpenseFlow
                </li>
                <li>
                  <Link href="/#faq" className="text-primary hover:underline">
                    ❓ FAQ
                  </Link>
                  {' '}- Frequently asked questions
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Business Owner</h3>
              <p className="text-sm text-muted-foreground">
                ExpenseFlow is an expense tracking tool currently in beta stage 
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
