import { API_URL } from './api';

export const stripeService = {
  async createCheckoutSession(token: string, plan: 'professional' | 'pro_plus'): Promise<string> {
    const response = await fetch(`${API_URL}/api/v1/stripe/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create checkout session' }));
      throw new Error(error.detail || 'Failed to create checkout session');
    }

    const data = await response.json();
    return data.url;
  },

  async createBillingPortalSession(token: string): Promise<string> {
    const response = await fetch(`${API_URL}/api/v1/stripe/create-billing-portal-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create billing portal session' }));
      throw new Error(error.detail || 'Failed to create billing portal session');
    }

    const data = await response.json();
    return data.url;
  },
};
