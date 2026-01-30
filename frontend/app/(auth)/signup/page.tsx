'use client';

import { SignUp } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SignupContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  
  const redirectUrl = plan ? `/dashboard?upgrade=${plan}` : '/dashboard';
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp 
        routing="hash" 
        signInUrl="/login" 
        afterSignInUrl={redirectUrl}
        afterSignUpUrl={redirectUrl}
      />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <SignUp routing="hash" signInUrl="/login" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
