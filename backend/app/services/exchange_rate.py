"""
Exchange Rate Service

Handles currency conversion using ExchangeRate-API.com (free tier).
Converts foreign currencies to GBP for HMRC compliance.
"""

import requests
from datetime import date, datetime
from typing import Dict, Optional
from functools import lru_cache


# Fallback rates (updated quarterly) - used if API fails
FALLBACK_RATES_TO_GBP = {
    "GBP": 1.0,
    "EUR": 0.85,   # 1 EUR = 0.85 GBP
    "USD": 0.79,   # 1 USD = 0.79 GBP
    "CAD": 0.58,   # 1 CAD = 0.58 GBP
    "AUD": 0.52,   # 1 AUD = 0.52 GBP
    "CHF": 0.92,   # 1 CHF = 0.92 GBP
    "JPY": 0.0053, # 1 JPY = 0.0053 GBP
    "CNY": 0.11,   # 1 CNY = 0.11 GBP
    "INR": 0.0095, # 1 INR = 0.0095 GBP
    "NZD": 0.49,   # 1 NZD = 0.49 GBP
    "SGD": 0.59,   # 1 SGD = 0.59 GBP
    "HKD": 0.10,   # 1 HKD = 0.10 GBP
    "NOK": 0.072,  # 1 NOK = 0.072 GBP
    "SEK": 0.074,  # 1 SEK = 0.074 GBP
    "DKK": 0.11,   # 1 DKK = 0.11 GBP
    "PLN": 0.20,   # 1 PLN = 0.20 GBP
    "CZK": 0.034,  # 1 CZK = 0.034 GBP
    "THB": 0.022,  # 1 THB = 0.022 GBP
    "MYR": 0.18,   # 1 MYR = 0.18 GBP
    "ZAR": 0.043,  # 1 ZAR = 0.043 GBP
    "TRY": 0.023,  # 1 TRY = 0.023 GBP
}


# Supported currencies (top 30 for UI)
SUPPORTED_CURRENCIES = [
    {"code": "GBP", "name": "British Pound", "symbol": "£", "flag": "🇬🇧"},
    {"code": "EUR", "name": "Euro", "symbol": "€", "flag": "🇪🇺"},
    {"code": "USD", "name": "US Dollar", "symbol": "$", "flag": "🇺🇸"},
    {"code": "CAD", "name": "Canadian Dollar", "symbol": "$", "flag": "🇨🇦"},
    {"code": "AUD", "name": "Australian Dollar", "symbol": "$", "flag": "🇦🇺"},
    {"code": "CHF", "name": "Swiss Franc", "symbol": "Fr", "flag": "🇨🇭"},
    {"code": "JPY", "name": "Japanese Yen", "symbol": "¥", "flag": "🇯🇵"},
    {"code": "CNY", "name": "Chinese Yuan", "symbol": "¥", "flag": "🇨🇳"},
    {"code": "INR", "name": "Indian Rupee", "symbol": "₹", "flag": "🇮🇳"},
    {"code": "NZD", "name": "New Zealand Dollar", "symbol": "$", "flag": "🇳🇿"},
    {"code": "SGD", "name": "Singapore Dollar", "symbol": "$", "flag": "🇸🇬"},
    {"code": "HKD", "name": "Hong Kong Dollar", "symbol": "$", "flag": "🇭🇰"},
    {"code": "NOK", "name": "Norwegian Krone", "symbol": "kr", "flag": "🇳🇴"},
    {"code": "SEK", "name": "Swedish Krona", "symbol": "kr", "flag": "🇸🇪"},
    {"code": "DKK", "name": "Danish Krone", "symbol": "kr", "flag": "🇩🇰"},
    {"code": "PLN", "name": "Polish Zloty", "symbol": "zł", "flag": "🇵🇱"},
    {"code": "CZK", "name": "Czech Koruna", "symbol": "Kč", "flag": "🇨🇿"},
    {"code": "THB", "name": "Thai Baht", "symbol": "฿", "flag": "🇹🇭"},
    {"code": "MYR", "name": "Malaysian Ringgit", "symbol": "RM", "flag": "🇲🇾"},
    {"code": "ZAR", "name": "South African Rand", "symbol": "R", "flag": "🇿🇦"},
    {"code": "TRY", "name": "Turkish Lira", "symbol": "₺", "flag": "🇹🇷"},
]


@lru_cache(maxsize=100)
def get_exchange_rate(from_currency: str, to_currency: str = "GBP") -> float:
    """
    Get exchange rate from one currency to another.
    Uses ExchangeRate-API.com (free tier: 1,500 requests/month).
    
    Results are cached to minimize API calls.
    
    Args:
        from_currency: Source currency ISO code (EUR, USD, etc.)
        to_currency: Target currency (default: GBP)
        
    Returns:
        float: Exchange rate (e.g., 1 EUR = 0.85 GBP returns 0.85)
        
    Example:
        >>> get_exchange_rate("EUR", "GBP")
        0.85
        >>> get_exchange_rate("USD", "GBP")
        0.79
    """
    # Same currency - no conversion needed
    if from_currency == to_currency:
        return 1.0
    
    # Normalize to uppercase
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()
    
    try:
        # Free tier API endpoint
        url = f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
        
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        
        data = response.json()
        
        # Extract rate
        if to_currency in data.get('rates', {}):
            rate = data['rates'][to_currency]
            print(f"[Exchange Rate] {from_currency} → {to_currency}: {rate}")
            return float(rate)
        else:
            print(f"[Exchange Rate] Currency {to_currency} not found in API response")
            return FALLBACK_RATES_TO_GBP.get(from_currency, 1.0)
            
    except requests.exceptions.RequestException as e:
        print(f"[Exchange Rate] API call failed: {e}")
        return FALLBACK_RATES_TO_GBP.get(from_currency, 1.0)
    
    except Exception as e:
        print(f"[Exchange Rate] Unexpected error: {e}")
        return FALLBACK_RATES_TO_GBP.get(from_currency, 1.0)


def convert_to_gbp(
    amount: float,
    from_currency: str,
    receipt_date: Optional[date] = None
) -> Dict[str, any]:
    """
    Convert an amount from any currency to GBP.
    
    Args:
        amount: Amount in source currency
        from_currency: Source currency ISO code
        receipt_date: Date of receipt (for audit trail)
        
    Returns:
        dict: Conversion details
        {
            'gbp_amount': 42.35,
            'exchange_rate': 0.85,
            'rate_date': '2026-02-06',
            'original_amount': 50.00,
            'original_currency': 'EUR'
        }
        
    Example:
        >>> convert_to_gbp(50.0, "EUR")
        {
            'gbp_amount': 42.50,
            'exchange_rate': 0.85,
            'rate_date': '2026-02-06',
            'original_amount': 50.0,
            'original_currency': 'EUR'
        }
    """
    from_currency = from_currency.upper()
    
    # Already in GBP
    if from_currency == "GBP":
        return {
            'gbp_amount': round(amount, 2),
            'exchange_rate': 1.0,
            'rate_date': datetime.now(),
            'original_amount': amount,
            'original_currency': 'GBP'
        }
    
    # Get current exchange rate
    rate = get_exchange_rate(from_currency, "GBP")
    
    # Convert
    gbp_amount = amount * rate
    
    return {
        'gbp_amount': round(gbp_amount, 2),
        'exchange_rate': round(rate, 6),  # 6 decimal places for accuracy
        'rate_date': datetime.now(),
        'original_amount': amount,
        'original_currency': from_currency
    }


def format_currency_display(
    amount: float,
    currency: str,
    show_symbol: bool = True
) -> str:
    """
    Format amount with currency symbol for display.
    
    Args:
        amount: Numeric amount
        currency: ISO currency code
        show_symbol: Whether to show currency symbol
        
    Returns:
        str: Formatted currency string
        
    Example:
        >>> format_currency_display(50.00, "EUR")
        "€50.00"
        >>> format_currency_display(50.00, "GBP")
        "£50.00"
    """
    # Find currency info
    currency_info = next(
        (c for c in SUPPORTED_CURRENCIES if c['code'] == currency),
        None
    )
    
    if currency_info and show_symbol:
        symbol = currency_info['symbol']
        # Handle currencies with symbol after amount (like kr, zł)
        if symbol in ['kr', 'zł', 'Kč']:
            return f"{amount:.2f} {symbol}"
        else:
            return f"{symbol}{amount:.2f}"
    else:
        return f"{amount:.2f} {currency}"


def get_currency_symbol(currency_code: str) -> str:
    """
    Get currency symbol for a given ISO code.
    
    Args:
        currency_code: ISO 4217 currency code
        
    Returns:
        str: Currency symbol or code if not found
    """
    currency_info = next(
        (c for c in SUPPORTED_CURRENCIES if c['code'] == currency_code),
        None
    )
    return currency_info['symbol'] if currency_info else currency_code


def is_currency_supported(currency_code: str) -> bool:
    """
    Check if a currency is supported.
    
    Args:
        currency_code: ISO 4217 currency code
        
    Returns:
        bool: True if supported
    """
    return currency_code.upper() in [c['code'] for c in SUPPORTED_CURRENCIES]
