'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ReceiptPoundSterling, Calendar, Store, Search, ChevronLeft, ChevronRight, CalendarDays, Trash2, Tag, RotateCcw, Archive, AlertTriangle, Download, ChevronDown } from 'lucide-react';
import { receiptsAPI, Receipt, EXPENSE_CATEGORY_OPTIONS, ExpenseCategory } from '@/lib/api';
import { format, subDays, startOfYear, isWithinInterval, getYear } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type StatusFilter = 'all' | 'pending' | 'completed' | 'failed' | 'deleted';
type DateFilter = 'all' | 'week' | 'month' | 'quarter' | 'year' | 'custom' | string; // string for tax years

export default function ReceiptsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([]);
  const [deletedReceipts, setDeletedReceipts] = useState<Receipt[]>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null);
  
  // Filter and pagination state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
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
        const activeData = await receiptsAPI.getAll(token);
        const deletedData = await receiptsAPI.getDeleted(token);
        setAllReceipts(activeData);
        setDeletedReceipts(deletedData);
      } catch (error) {
        console.error('Failed to fetch receipts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReceipts();
  }, []);

  // Set mounted state after first render
  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply filters whenever receipts, status, date, or search changes
  useEffect(() => {
    // Use active or deleted receipts based on status filter
    const sourceReceipts = statusFilter === 'deleted' ? deletedReceipts : allReceipts;
    let filtered = [...sourceReceipts];

    // Filter by status (skip if viewing deleted)
    if (statusFilter !== 'all' && statusFilter !== 'deleted') {
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

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(r => r.category === categoryFilter);
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
  }, [allReceipts, deletedReceipts, statusFilter, dateFilter, categoryFilter, searchQuery, customFromDate, customToDate]);

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
    if (status === 'deleted') return deletedReceipts.length;
    return allReceipts.filter(r => r.status === status).length;
  };

  const handleDeleteClick = (receipt: Receipt, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setReceiptToDelete(receipt);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!receiptToDelete) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await receiptsAPI.delete(token, receiptToDelete.id);
      
      // Move from active to deleted
      setAllReceipts(prev => prev.filter(r => r.id !== receiptToDelete.id));
      setDeletedReceipts(prev => [...prev, receiptToDelete]);
      
      toast({
        title: 'Receipt deleted',
        description: 'The receipt has been moved to Deleted. You can restore it if needed.',
      });
    } catch (error) {
      console.error('Failed to delete receipt:', error);
      toast({
        title: 'Failed to delete',
        description: 'Could not delete the receipt. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setReceiptToDelete(null);
    }
  };

  const handleRestore = async (receipt: Receipt, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const restored = await receiptsAPI.restore(token, receipt.id);
      
      // Move from deleted to active
      setDeletedReceipts(prev => prev.filter(r => r.id !== receipt.id));
      setAllReceipts(prev => [...prev, restored]);
      
      toast({
        title: 'Receipt restored',
        description: 'The receipt has been successfully restored.',
      });
    } catch (error) {
      console.error('Failed to restore receipt:', error);
      toast({
        title: 'Failed to restore',
        description: 'Could not restore the receipt. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDismissDuplicate = async (receipt: Receipt, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const updated = await receiptsAPI.dismissDuplicate(token, receipt.id);
      
      // Update receipt in state
      setAllReceipts(prev => prev.map(r => r.id === receipt.id ? updated : r));
      
      toast({
        title: 'Duplicate dismissed',
        description: 'This receipt is confirmed as not a duplicate.',
      });
    } catch (error) {
      console.error('Failed to dismiss duplicate:', error);
      toast({
        title: 'Failed to dismiss',
        description: 'Could not dismiss duplicate warning. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const downloadCSV = () => {
    if (filteredReceipts.length === 0) {
      toast({
        title: 'No receipts to download',
        description: 'Try adjusting your filters.',
        variant: 'destructive',
      });
      return;
    }

    // Create CSV content
    const headers = ['Date', 'Vendor', 'Category', 'Amount', 'VAT', 'Status', 'Notes'];
    const rows = filteredReceipts.map(receipt => [
      receipt.date ? format(new Date(receipt.date), 'yyyy-MM-dd') : '',
      receipt.vendor || '',
      receipt.category || '',
      receipt.total_amount?.toFixed(2) || '',
      receipt.tax_amount?.toFixed(2) || '',
      receipt.status,
      receipt.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Add UTF-8 BOM for proper encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipts-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'CSV downloaded',
      description: `${filteredReceipts.length} receipt(s) exported to CSV.`,
    });
  };

  const downloadPDF = async () => {
    if (filteredReceipts.length === 0) {
      toast({
        title: 'No receipts to download',
        description: 'Try adjusting your filters.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Dynamic imports
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(18);
      doc.setTextColor(40);
      doc.text('Receipt Report', 14, 22);
      
      // Add metadata
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
      doc.text(`Total Receipts: ${filteredReceipts.length}`, 14, 36);
      
      // Calculate totals
      const totalAmount = filteredReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
      const totalVAT = filteredReceipts.reduce((sum, r) => sum + (r.tax_amount || 0), 0);
      doc.text(`Total Amount: £${totalAmount.toFixed(2)}`, 14, 42);
      doc.text(`Total VAT: £${totalVAT.toFixed(2)}`, 14, 48);
      
      // Prepare table data
      const tableData = filteredReceipts.map(receipt => [
        receipt.date ? format(new Date(receipt.date), 'dd/MM/yyyy') : '-',
        receipt.vendor || '-',
        receipt.category || '-',
        `£${(receipt.total_amount || 0).toFixed(2)}`,
        `£${(receipt.tax_amount || 0).toFixed(2)}`,
        receipt.status,
        receipt.notes || '-'
      ]);

      // Add table
      autoTable(doc, {
        startY: 55,
        head: [['Date', 'Vendor', 'Category', 'Amount', 'VAT', 'Status', 'Notes']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [59, 130, 246], // Blue
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        columnStyles: {
          0: { cellWidth: 22 },  // Date
          1: { cellWidth: 35 },  // Vendor
          2: { cellWidth: 30 },  // Category
          3: { cellWidth: 20, halign: 'right' },  // Amount
          4: { cellWidth: 18, halign: 'right' },  // VAT
          5: { cellWidth: 20 },  // Status
          6: { cellWidth: 'auto' },  // Notes
        },
      });

      // Save PDF
      doc.save(`receipts-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      toast({
        title: 'PDF downloaded',
        description: `${filteredReceipts.length} receipt(s) exported to PDF.`,
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({
        title: 'Download failed',
        description: 'Failed to generate PDF. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const downloadImages = async () => {
    const receiptsWithImages = filteredReceipts.filter(r => r.image_url);
    
    if (receiptsWithImages.length === 0) {
      toast({
        title: 'No images to download',
        description: 'None of the filtered receipts have images.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Preparing download...',
      description: 'Fetching and zipping receipt images. This may take a moment.',
    });

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Dynamic import of JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Fetch all images through backend proxy and add to zip
      await Promise.all(
        receiptsWithImages.map(async (receipt, index) => {
          try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/v1/receipts/${receipt.id}/download-image`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              }
            );
            
            if (!response.ok) {
              console.error(`Failed to download image for receipt ${receipt.id}`);
              return;
            }
            
            const blob = await response.blob();
            
            // Create filename: date-vendor-index.ext
            const ext = receipt.image_url!.split('.').pop()?.split('?')[0] || 'jpg';
            const date = receipt.date ? format(new Date(receipt.date), 'yyyy-MM-dd') : 'no-date';
            const vendor = (receipt.vendor || 'unknown').replace(/[^a-z0-9]/gi, '-').toLowerCase();
            const filename = `${date}-${vendor}-${index + 1}.${ext}`;
            
            zip.file(filename, blob);
          } catch (error) {
            console.error(`Failed to download image for receipt ${receipt.id}:`, error);
          }
        })
      );

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-images-${format(new Date(), 'yyyy-MM-dd')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Images downloaded',
        description: `${receiptsWithImages.length} receipt image(s) downloaded as ZIP.`,
      });
    } catch (error) {
      console.error('Failed to create ZIP:', error);
      toast({
        title: 'Download failed',
        description: 'Failed to create ZIP file. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const statusTabs: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending Review', value: 'pending' },
    { label: 'Completed', value: 'completed' },
    { label: 'Failed', value: 'failed' },
    { label: 'Deleted', value: 'deleted' },
  ];

  const taxYears = getTaxYears();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Receipts</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Manage and organize all your receipts
          </p>
        </div>
        {mounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download Receipts
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={downloadCSV}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadPDF}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadImages}>
                <Download className="mr-2 h-4 w-4" />
                Download Images (ZIP)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3">
        <div className="relative w-130">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search vendor or amount..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Category Filter Dropdown */}
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-300 pointer-events-none z-10" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-transparent dark:bg-input/30 dark:text-white appearance-none cursor-pointer min-w-50"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORY_OPTIONS.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="h-4 w-4 text-gray-400 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {/* Date Filter Dropdown */}
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-300 pointer-events-none z-10" />
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
            className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-transparent dark:bg-input/30 dark:text-white appearance-none cursor-pointer min-w-45"
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
            <svg className="h-4 w-4 text-gray-400 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {dateFilter === 'custom' && (
        <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-md border dark:border-gray-600">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
            <Input
              type="date"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
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
      <div className="flex gap-2 border-b dark:border-gray-700">
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
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              {tab.label}
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
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
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                {searchQuery || statusFilter !== 'all' ? 'No receipts found' : 'No receipts yet'}
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
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
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredReceipts.length)} of {filteredReceipts.length} receipts
          </div>

          {/* Receipts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedReceipts.map((receipt) => (
              <Card 
                key={receipt.id} 
                className={`hover:shadow-lg transition-shadow relative group ${
                  statusFilter === 'deleted' ? 'opacity-60' : 'cursor-pointer'
                }`}
                onClick={statusFilter === 'deleted' ? undefined : () => router.push(`/dashboard/receipts/${receipt.id}`)}
              >
                <CardContent className="pt-6">
                  {/* Receipt Image */}
                  <div className="relative h-48 mb-4 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                    <img
                      src={receipt.image_url}
                      alt={receipt.vendor || 'Receipt'}
                      className="w-full h-full object-cover"
                    />
                    <Badge className={`absolute top-2 right-2 ${getStatusColor(receipt.status)}`}>
                      {receipt.status}
                    </Badge>
                    
                    {/* Show Restore button for deleted receipts, Delete button for active ones */}
                    {statusFilter === 'deleted' ? (
                      <button
                        onClick={(e) => handleRestore(receipt, e)}
                        className="absolute top-2 left-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-sm font-medium"
                        title="Restore receipt"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Restore</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleDeleteClick(receipt, e)}
                        className="absolute top-2 left-2 p-2 bg-red-500 text-white rounded-md hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete receipt"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Receipt Details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {receipt.vendor || 'Unknown Vendor'}
                      </span>
                    </div>

                    {receipt.date && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {format(new Date(receipt.date), 'MMM dd, yyyy')}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t dark:border-gray-700">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {receipt.total_amount ? `£${receipt.total_amount.toFixed(2)}` : 'N/A'}
                      </span>
                    </div>

                    {receipt.tax_amount && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">VAT</span>
                        <span className="text-gray-700 dark:text-gray-300">
                          £{receipt.tax_amount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    
                    {/* Show duplicate warning for suspected duplicates */}
                    {receipt.duplicate_suspect === 1 && receipt.duplicate_dismissed === 0 && (
                      <div className="pt-2 border-t dark:border-gray-700">
                        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mb-2">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Possible duplicate - Review</span>
                        </div>
                        <button
                          onClick={(e) => handleDismissDuplicate(receipt, e)}
                          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >
                          Not a duplicate
                        </button>
                      </div>
                    )}
                    
                    {/* Show deleted date for deleted receipts */}
                    {statusFilter === 'deleted' && receipt.deleted_at && (
                      <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 pt-2 border-t dark:border-gray-700">
                        <Archive className="h-3 w-3" />
                        <span>Deleted {format(new Date(receipt.deleted_at), 'MMM dd, yyyy')}</span>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the receipt from <strong>{receiptToDelete?.vendor || 'Unknown Vendor'}</strong>
              {receiptToDelete?.total_amount && (
                <span> for <strong>£{receiptToDelete.total_amount.toFixed(2)}</strong></span>
              )} to deleted status. You can restore it later by filtering to "Deleted" receipts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}