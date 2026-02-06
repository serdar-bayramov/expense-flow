/**
 * Currency utilities for multi-currency support
 */

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

// Top 30 currencies for UI
export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "CAD", name: "Canadian Dollar", symbol: "$", flag: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar", symbol: "$", flag: "🇦🇺" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr", flag: "🇨🇭" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "$", flag: "🇳🇿" },
  { code: "SGD", name: "Singapore Dollar", symbol: "$", flag: "🇸🇬" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "$", flag: "🇭🇰" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", flag: "🇳🇴" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", flag: "🇸🇪" },
  { code: "DKK", name: "Danish Krone", symbol: "kr", flag: "🇩🇰" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", flag: "🇵🇱" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", flag: "🇨🇿" },
  { code: "THB", name: "Thai Baht", symbol: "฿", flag: "🇹🇭" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", flag: "🇹🇷" },
];

/**
 * Get currency symbol for a given ISO code
 */
export function getCurrencySymbol(currencyCode: string): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.symbol || currencyCode;
}

/**
 * Get full currency info
 */
export function getCurrencyInfo(currencyCode: string): CurrencyInfo | null {
  return SUPPORTED_CURRENCIES.find(c => c.code === currencyCode) || null;
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number, currencyCode: string = "GBP", showCode: boolean = false): string {
  const symbol = getCurrencySymbol(currencyCode);
  
  // Currencies with symbol after amount
  const symbolAfter = ['kr', 'zł', 'Kč'];
  
  const formatted = amount.toFixed(2);
  
  if (symbolAfter.includes(symbol)) {
    return showCode ? `${formatted} ${symbol} ${currencyCode}` : `${formatted} ${symbol}`;
  }
  
  return showCode ? `${symbol}${formatted} ${currencyCode}` : `${symbol}${formatted}`;
}

/**
 * Format receipt amount - shows original currency with GBP conversion if needed
 */
export function formatReceiptAmount(
  totalAmount: number,
  currency: string = "GBP",
  originalAmount?: number | null
): string {
  if (currency === "GBP" || !originalAmount || originalAmount === totalAmount) {
    return formatCurrency(totalAmount, "GBP");
  }
  
  // Foreign currency: show both
  return `${formatCurrency(originalAmount, currency)} (£${totalAmount.toFixed(2)})`;
}

/**
 * Format short receipt amount for cards/lists
 */
export function formatReceiptAmountShort(
  totalAmount: number,
  currency: string = "GBP"
): string {
  if (currency === "GBP") {
    return formatCurrency(totalAmount, "GBP");
  }
  
  return `£${totalAmount.toFixed(2)}`;
}

/**
 * Get display text for exchange rate
 */
export function formatExchangeRate(
  rate: number,
  fromCurrency: string,
  toCurrency: string = "GBP"
): string {
  return `1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}`;
}
