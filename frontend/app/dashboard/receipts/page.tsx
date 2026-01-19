'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ReceiptPoundSterling, Calendar, Store, Search, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { receiptsAPI, Receipt } from '@/lib/api';
import { format, subDays, startOfYear, isWithinInterval, getYear } from 'date-fns';

type StatusFilter = 'all' | 'pending' | 'completed' | 'failed';
type DateFilter = 'all' | 'week' | 'month' | 'quarter' | 'year' | 'custom' | string; // string for tax years

export default function ReceiptsPage() {
  const router = useRouter();
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter and pagination state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');  const [currentPage, setCurrentPage] = useState(1);
  const receiptsPerPage = 20;

  // Helper function to get UK tax year dates (April 6 - April 5)
  const getUKTaxYearDates = (startYear: number): { start: Date; end: Date } => {
    return {
      start: new Date(startYear, 3, 6), // April 6
      end: new Date(startYear + 1, 3, 5, 23, 59, 59), // April 5 next year
    };
  };

  // Calculate available tax years based on receipts
  const getTaxYears = (): string[] => {
    if (allReceipts.length === 0) return [];
    
    const oldestReceipt = allReceipts.reduce((oldest, r) => {
      const date = new Date(r.date || r.created_at);
      return date < new Date(oldest.date || oldest.created_at) ? r : oldest;
    });
    
    const oldestDate = new Date(oldestReceipt.date || oldestReceipt.created_at);
    const oldestYear = getYear(oldestDate);
    const oldestTaxYear = oldestDate.getMonth() >= 3 && oldestDate.getDate() >= 6 
      ? oldestYear 
      : oldestYear - 1;
    
    const currentYear = new Date().getFullYear();
    const currentTaxYear = new Date().getMonth() >= 3 && new Date().getDate() >= 6
      ? currentYear
      : currentYear - 1;
    
    const taxYears: string[] = [];
    for (let year = currentTaxYear; year >= oldestTaxYear; year--) {
      taxYears.push(`tax-${year}`);
    }
    
    return taxYears;
  };

  useEffect(() => {
    const fetchReceipts = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const data = await receiptsAPI.getAll(token);
        setAllReceipts(data);
      } catch (error) {
        console.error('Failed to fetch receipts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReceipts();
  }, []);

  // Apply filters whenever receipts, status, date, or search changes
  useEffect(() => {
    let filtered = [...allReceipts];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Filter by date range
    if (dateFilter !== 'all') {
      if (dateFilter === 'custom') {
        // Custom date range
        if (customFromDate || customToDate) {
          filtered = filtered.filter(r => {
            const receiptDate = new Date(r.date || r.created_at);
            const from = customFromDate ? new Date(customFromDate) : new Date(0);
            const to = customToDate ? new Date(customToDate + 'T23:59:59') : new Date();
            return receiptDate >= from && receiptDate <= to;
          });
        }
      } else if (dateFilter.startsWith('tax-')) {
        // UK Tax year filter
        const year = parseInt(dateFilter.replace('tax-', ''));
        const { start, end } = getUKTaxYearDates(year);
        
        filtered = filtered.filter(r => {
          const receiptDate = new Date(r.date || r.created_at);
          return isWithinInterval(receiptDate, { start, end });
        });
      } else {
        // Preset filters (week, month, quarter, year)
        const now = new Date();
        let cutoffDate: Date;

        switch (dateFilter) {
          case 'week':
            cutoffDate = subDays(now, 7);
            break;
          case 'month':
            cutoffDate = subDays(now, 30);
            break;
          case 'quarter':
            cutoffDate = subDays(now, 90);
            break;
          case 'year':
            cutoffDate = startOfYear(now);
            break;
          default:
            cutoffDate = new Date(0);
        }

        filtered = filtered.filter(r => {
          const receiptDate = new Date(r.date || r.created_at);
          return receiptDate >= cutoffDate;
        });
      }
    }

    // Filter by search query (vendor name or amount)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.vendor?.toLowerCase().includes(query) ||
        r.total_amount?.toString().includes(query)
      );
    }

    setFilteredReceipts(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allReceipts, statusFilter, dateFilter, searchQuery, customFromDate, customToDate]);

  // Pagination
  const totalPages = Math.ceil(filteredReceipts.length / receiptsPerPage);
  const startIndex = (currentPage - 1) * receiptsPerPage;
  const endIndex = startIndex + receiptsPerPage;
  const paginatedReceipts = filteredReceipts.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusCount = (status: StatusFilter) => {
    if (status === 'all') return allReceipts.length;
    return allReceipts.filter(r => r.status === status).length;
  };

  const statusTabs: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending Review', value: 'pending' },
    { label: 'Completed', value: 'completed' },
    { label: 'Failed', value: 'failed' },
  ];

  const taxYears = getTaxYears();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Receipts</h1>
        <p className="mt-2 text-gray-600">
          Manage and organize all your receipts
        </p>
      </div>

      {/* Search and Date Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by vendor or amount..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Date Filter Dropdown */}
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
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
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer min-w-45"
          >
            <option value="all">All Time</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
            <option value="year">This Year</option>
            
            {taxYears.length > 0 && (
              <>
                <option disabled>──────────</option>
                {taxYears.map((taxYear) => {
                  const year = parseInt(taxYear.replace('tax-', ''));
                  return (
                    <option key={taxYear} value={taxYear}>
                      {year}-{year + 1} Tax Year
                    </option>
                  );
                })}
              </>
            )}
            
            <option disabled>──────────</option>
            <option value="custom">Custom Range</option>
          </select>
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {dateFilter === 'custom' && (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-md border">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
            <Input
              type="date"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
            <Input
              type="date"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex gap-2 border-b">
        {statusTabs.map((tab) => {
          const count = getStatusCount(tab.value);
          const isActive = statusFilter === tab.value;
          
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`
                px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
                }
              `}
            >
              {tab.label}
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-48 w-full mb-4" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredReceipts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <ReceiptPoundSterling className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                {searchQuery || statusFilter !== 'all' ? 'No receipts found' : 'No receipts yet'}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters or search query'
                  : 'Upload your first receipt to get started'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Results info */}
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredReceipts.length)} of {filteredReceipts.length} receipts
          </div>

          {/* Receipts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedReceipts.map((receipt) => (
              <Card 
                key={receipt.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/dashboard/receipts/${receipt.id}`)}
              >
                <CardContent className="pt-6">
                  {/* Receipt Image */}
                  <div className="relative h-48 mb-4 bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={receipt.image_url}
                      alt={receipt.vendor || 'Receipt'}
                      className="w-full h-full object-cover"
                    />
                    <Badge className={`absolute top-2 right-2 ${getStatusColor(receipt.status)}`}>
                      {receipt.status}
                    </Badge>
                  </div>

                  {/* Receipt Details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {receipt.vendor || 'Unknown Vendor'}
                      </span>
                    </div>

                    {receipt.date && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {format(new Date(receipt.date), 'MMM dd, yyyy')}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-gray-500">Total</span>
                      <span className="text-lg font-bold text-gray-900">
                        {receipt.total_amount ? `£${receipt.total_amount.toFixed(2)}` : 'N/A'}
                      </span>
                    </div>

                    {receipt.tax_amount && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">VAT</span>
                        <span className="text-gray-700">
                          £{receipt.tax_amount.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Show first page, last page, current page, and pages around current
                  const showPage = 
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1);
                  
                  const showEllipsis = 
                    (page === currentPage - 2 && currentPage > 3) ||
                    (page === currentPage + 2 && currentPage < totalPages - 2);

                  if (showEllipsis) {
                    return <span key={page} className="px-2">...</span>;
                  }

                  if (!showPage) return null;

                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="min-w-10"
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}