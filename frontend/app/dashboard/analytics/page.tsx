'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { receiptsAPI, AnalyticsResponse } from '@/lib/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, PieChartIcon, Calendar, FileText } from 'lucide-react';
import { format, subDays, startOfYear, getYear } from 'date-fns';

type DateFilter = 'all' | 'week' | 'month' | 'quarter' | 'year' | 'custom' | string;

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  // Helper function to get UK tax year dates
  const getUKTaxYearDates = (startYear: number): { start: string; end: string } => {
    return {
      start: format(new Date(startYear, 3, 6), 'yyyy-MM-dd'), // April 6
      end: format(new Date(startYear + 1, 3, 5), 'yyyy-MM-dd'), // April 5 next year
    };
  };

  const fetchAnalytics = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (dateFilter === 'custom') {
        startDate = customFromDate || undefined;
        endDate = customToDate || undefined;
      } else if (dateFilter.startsWith('tax-')) {
        const year = parseInt(dateFilter.replace('tax-', ''));
        const dates = getUKTaxYearDates(year);
        startDate = dates.start;
        endDate = dates.end;
      } else if (dateFilter !== 'all') {
        const now = new Date();
        switch (dateFilter) {
          case 'week':
            startDate = format(subDays(now, 7), 'yyyy-MM-dd');
            break;
          case 'month':
            startDate = format(subDays(now, 30), 'yyyy-MM-dd');
            break;
          case 'quarter':
            startDate = format(subDays(now, 90), 'yyyy-MM-dd');
            break;
          case 'year':
            startDate = format(startOfYear(now), 'yyyy-MM-dd');
            break;
        }
      }

      const data = await receiptsAPI.getAnalytics(token, startDate, endDate);
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateFilter, customFromDate, customToDate]);

  // Colors for pie chart
  const COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
  ];

  // Get current tax year for filter
  const currentYear = getYear(new Date());
  const currentTaxYear = new Date().getMonth() >= 3 && new Date().getDate() >= 6
    ? currentYear
    : currentYear - 1;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Analyze your expenses by category</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return <div className="dark:text-white">No data available</div>;
  }

  // Prepare data for charts
  const pieChartData = analytics.categories.map((cat) => ({
    name: cat.category,
    value: cat.total,
    count: cat.count,
    percentage: cat.percentage,
  }));

  const barChartData = analytics.monthly_breakdown.map((month) => ({
    month: format(new Date(month.month + '-01'), 'MMM yyyy'),
    amount: month.total,
    vat: month.vat,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Analyse your expenses by HMRC category</p>
        </div>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-300" />
            <select
              value={dateFilter}
              onChange={(e) => {
                const value = e.target.value as DateFilter;
                setDateFilter(value);
                if (value !== 'custom') {
                  setCustomFromDate('');
                  setCustomToDate('');
                }
              }}
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-transparent dark:bg-input/30 dark:text-white"
            >
              <option value="all">All Time</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
              <option value="year">This Year</option>
              <option disabled>──────────</option>
              <option value={`tax-${currentTaxYear}`}>
                {currentTaxYear}-{currentTaxYear + 1} Tax Year
              </option>
              <option value={`tax-${currentTaxYear - 1}`}>
                {currentTaxYear - 1}-{currentTaxYear} Tax Year
              </option>
              <option disabled>──────────</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-transparent dark:bg-input/30 dark:text-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-transparent dark:bg-input/30 dark:text-white"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium dark:text-gray-300">Total Expenses</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold dark:text-white">£{analytics.total_amount.toFixed(2)}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Across {analytics.receipt_count} receipts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium dark:text-gray-300">Total VAT</CardTitle>
            <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold dark:text-white">£{analytics.total_vat.toFixed(2)}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {((analytics.total_vat / analytics.total_amount) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium dark:text-gray-300">Categories</CardTitle>
            <PieChartIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold dark:text-white">{analytics.categories.length}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Expense categories used
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="dark:text-white">Expenses by Category</CardTitle>
            <CardDescription className="dark:text-gray-400">Breakdown of spending across HMRC categories</CardDescription>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={false}
                    outerRadius={140}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `£${value.toFixed(2)}`}
                    contentStyle={{ fontSize: '12px' }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px' }}
                    iconSize={8}
                    formatter={(value, entry: any) => `${value} (${entry.payload.percentage}%)`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-75 text-gray-500 dark:text-gray-400">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category List */}
        <Card>
          <CardHeader>
            <CardTitle className="dark:text-white">Category Details</CardTitle>
            <CardDescription className="dark:text-gray-400">Detailed breakdown with amounts and counts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-75 overflow-y-auto">
              {analytics.categories.map((cat, index) => (
                <div key={cat.category} className="flex items-center justify-between py-2 border-b last:border-0 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div>
                      <p className="font-medium text-sm dark:text-white">{cat.category}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{cat.count} receipts</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm dark:text-white">£{cat.total.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{cat.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend - Bar Chart */}
      {barChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="dark:text-white">Monthly Spending Trend</CardTitle>
            <CardDescription className="dark:text-gray-400">Total expenses and VAT by month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `£${value.toFixed(2)}`}
                />
                <Legend />
                <Bar dataKey="amount" fill="#3b82f6" name="Total Amount" />
                <Bar dataKey="vat" fill="#10b981" name="VAT" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
