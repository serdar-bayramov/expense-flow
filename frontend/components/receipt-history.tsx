'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Edit, 
  CheckCircle, 
  Upload, 
  UserCircle, 
  FileText, 
  AlertCircle,
  Trash2,
  Download,
  Sparkles
} from 'lucide-react';
import { receiptsAPI, AuditEvent } from '@/lib/api';
import { formatDistanceToNow, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface ReceiptHistoryProps {
  receiptId: number;
}

export function ReceiptHistory({ receiptId }: ReceiptHistoryProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const history = await receiptsAPI.getHistory(token, receiptId);
        setEvents(history.events);
      } catch (err: any) {
        console.error('Failed to fetch history:', err);
        setError('Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [receiptId]);

  const getEventIcon = (eventType: string, actor: string) => {
    switch (eventType) {
      case 'created':
        return actor === 'user' ? (
          <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        );
      case 'field_updated':
        return <Edit className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'status_changed':
        return <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
      case 'ocr_completed':
        return <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <UserCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'created':
        return 'bg-blue-100 dark:bg-blue-900/30';
      case 'field_updated':
        return 'bg-orange-100 dark:bg-orange-900/30';
      case 'approved':
        return 'bg-green-100 dark:bg-green-900/30';
      case 'status_changed':
        return 'bg-gray-100 dark:bg-gray-700';
      case 'ocr_completed':
        return 'bg-indigo-100 dark:bg-indigo-900/30';
      case 'deleted':
        return 'bg-red-100 dark:bg-red-900/30';
      default:
        return 'bg-gray-100 dark:bg-gray-700';
    }
  };

  const getEventDescription = (event: AuditEvent) => {
    switch (event.event_type) {
      case 'created':
        return event.actor === 'user' 
          ? 'Receipt uploaded manually'
          : 'Receipt received via email';
      case 'status_changed':
        return `Status changed to ${event.new_value}`;
      case 'field_updated':
        return `${formatFieldName(event.field_name)} updated`;
      case 'approved':
        return 'Receipt approved';
      case 'ocr_completed':
        return 'OCR processing completed';
      case 'deleted':
        return 'Receipt deleted';
      default:
        return event.event_type;
    }
  };

  const formatFieldName = (fieldName: string | null) => {
    if (!fieldName) return '';
    
    // Convert snake_case to Title Case
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatValue = (value: string | null, fieldName: string | null) => {
    if (!value) return null;
    
    // Format date fields to remove timestamp
    if (fieldName === 'date' || value.match(/^\d{4}-\d{2}-\d{2}/)) {
      const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        return dateMatch[1];
      }
    }
    
    return value;
  };

  const formatExtractedValue = (key: string, value: any): string => {
    // Handle array of objects (like items)
    if (Array.isArray(value)) {
      if (value.length === 0) return 'None';
      
      // Check if array contains objects
      if (typeof value[0] === 'object' && value[0] !== null) {
        return `${value.length} items detected`;
      }
      
      return value.join(', ');
    }
    
    // Handle dates - remove timestamp
    if (key === 'date' && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) return dateMatch[1];
    }
    
    return String(value);
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Event', 'Actor', 'Field', 'Old Value', 'New Value'];
    const rows = events.map(event => [
      format(new Date(event.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      event.event_type,
      event.actor,
      event.field_name || '',
      event.old_value || '',
      event.new_value || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${receiptId}-history.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="dark:text-white">History</CardTitle>
          <CardDescription className="dark:text-gray-400">
            Complete audit trail of changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="dark:text-white">History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="dark:text-white">History</CardTitle>
          <CardDescription className="dark:text-gray-400">
            Complete audit trail of changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No history available for this receipt
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="dark:text-white">History</CardTitle>
            <CardDescription className="dark:text-gray-400">
              Complete audit trail of {events.length} events
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {events.map((event, idx) => (
            <div key={event.id} className="flex gap-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className={`p-2 rounded-full ${getEventColor(event.event_type)}`}>
                  {getEventIcon(event.event_type, event.actor)}
                </div>
                {idx < events.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-2" style={{ minHeight: '24px' }} />
                )}
              </div>

              {/* Event details */}
              <div className="flex-1 pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {getEventDescription(event)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      {' · '}
                      {format(new Date(event.timestamp), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {event.actor}
                  </div>
                </div>

                {/* Field changes */}
                {event.field_name && (event.old_value || event.new_value) && (
                  <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {formatFieldName(event.field_name)}
                    </p>
                    <div className="flex items-center gap-3 text-sm">
                      {event.old_value && (
                        <span className="text-red-600 dark:text-red-400 line-through">
                          {formatValue(event.old_value, event.field_name)}
                        </span>
                      )}
                      {event.old_value && event.new_value && (
                        <span className="text-gray-400">→</span>
                      )}
                      {event.new_value && (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {formatValue(event.new_value, event.field_name)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* OCR extracted fields */}
                {event.event_type === 'ocr_completed' && event.extra_data?.extracted_fields && (
                  <div className="mt-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-2">
                      Extracted Fields
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(event.extra_data.extracted_fields).map(([key, value]) => (
                        <div key={key}>
                          <span className="text-gray-500 dark:text-gray-400">{formatFieldName(key)}:</span>{' '}
                          <span className="text-gray-900 dark:text-white font-medium">
                            {formatExtractedValue(key, value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
