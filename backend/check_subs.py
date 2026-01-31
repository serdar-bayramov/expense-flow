#!/usr/bin/env python3
import stripe
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

customer = stripe.Customer.list(email='serdar.bayramov@outlook.com', limit=1).data[0]
subs = stripe.Subscription.list(customer=customer.id)

print('🔍 Your subscriptions:\n')
for i, sub in enumerate(subs.data, 1):
    price_id = sub['items']['data'][0]['price']['id']
    price = stripe.Price.retrieve(price_id)
    product = stripe.Product.retrieve(price.product)
    
    print(f'{i}. {sub.id}')
    print(f'   Product: {product.name}')
    print(f'   Price: ${price.unit_amount/100:.2f}/month')
    print(f'   Status: {sub.status}')
    print(f'   Created: {datetime.fromtimestamp(sub.created).strftime("%Y-%m-%d %H:%M:%S")}')
    print(f'   Cancel at period end: {sub.cancel_at_period_end}')
    if sub.cancel_at_period_end:
        print(f'   ⚠️  Cancels on: {datetime.fromtimestamp(sub.current_period_end).strftime("%Y-%m-%d")}')
    print(f'   Period end: {datetime.fromtimestamp(sub.current_period_end).strftime("%Y-%m-%d")}')
    print()

print('\n💡 Recommendation:')
print('If you upgraded from Professional to Pro Plus:')
print('  → KEEP: Pro Plus subscription')
print('  → CANCEL: Professional subscription (the duplicate)')
