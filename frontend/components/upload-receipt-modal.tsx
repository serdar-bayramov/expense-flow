'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle, XCircle, FileText, Loader2, Crown } from 'lucide-react';
import { receiptsAPI } from '@/lib/api';
import { toast } from 'sonner';

interface UploadReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
  subscriptionUsage?: any;
  onUpgradeRequired?: () => void;
}

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  error?: string;
}

export function UploadReceiptModal({
  open,
  onOpenChange,
  onUploadComplete,
  subscriptionUsage,
  onUpgradeRequired,
}: UploadReceiptModalProps) {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasLimitError, setHasLimitError] = useState(false);

  const processQueue = async (fileList: File[]) => {
    setIsProcessing(true);
    
    // Initialize all files as pending
    const fileStatuses: FileUploadStatus[] = fileList.map(file => ({
      file,
      status: 'pending',
      progress: 0,
    }));
    setFiles(fileStatuses);

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Not authenticated');
      setIsProcessing(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Process files sequentially
    for (let i = 0; i < fileStatuses.length; i++) {
      const fileStatus = fileStatuses[i];
      
      try {
        // Update to uploading
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploading' } : f
        ));

        // Upload with progress
        await receiptsAPI.upload(token, fileStatus.file, (progress) => {
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, progress, status: progress === 100 ? 'processing' : 'uploading' } : f
          ));
        });

        // Mark as success
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'success', progress: 100 } : f
        ));
        
        successCount++;

      } catch (error: any) {
        console.error(`Upload error for ${fileStatus.file.name}:`, error);
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to upload';
        
        // Check if this is a limit error
        if (errorMessage.includes('limit reached') || errorMessage.includes('Upgrade your plan')) {
          setHasLimitError(true);
        }
        
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error', error: errorMessage } : f
        ));
        
        errorCount++;
      }
    }

    setIsProcessing(false);
    
    // Show results
    if (successCount > 0) {
      if (errorCount > 0) {
        toast.success(`${successCount} of ${fileList.length} receipt(s) uploaded successfully`);
      } else {
        toast.success(`${successCount} receipt(s) uploaded successfully!`);
      }
      
      // Close and refresh after delay
      setTimeout(() => {
        onUploadComplete?.();
        onOpenChange(false);
        setTimeout(() => setFiles([]), 300);
      }, 1500);
    } else {
      toast.error('All uploads failed');
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    // Check subscription limits before uploading
    if (subscriptionUsage && onUpgradeRequired) {
      const { receipts_used, receipts_limit } = subscriptionUsage;
      if (receipts_used >= receipts_limit) {
        toast.error(`Monthly receipt limit reached (${receipts_used}/${receipts_limit}). Please upgrade your plan.`);
        setHasLimitError(true);
        onUpgradeRequired();
        return;
      }
    }

    // Validate file sizes
    const validFiles = acceptedFiles.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    await processQueue(validFiles);
  }, [subscriptionUsage, onUpgradeRequired, onUploadComplete, onOpenChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
    },
    multiple: true, // Allow multiple files
    disabled: isProcessing,
  });

  const handleClose = () => {
    if (!isProcessing) {
      onOpenChange(false);
      setTimeout(() => {
        setFiles([]);
        setHasLimitError(false);
      }, 300);
    }
  };

  const getStatusIcon = (status: FileUploadStatus['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <FileText className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: FileUploadStatus['status']) => {
    switch (status) {
      case 'pending':
        return 'Waiting...';
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing OCR...';
      case 'success':
        return 'Complete';
      case 'error':
        return 'Failed';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="dark:text-white">Upload Receipts</DialogTitle>
        </DialogHeader>

        {files.length === 0 && (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors
              ${isDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-300 mb-4" />
            {isDragActive ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">Drop your receipts here...</p>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Drag & drop receipts here, or click to select
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  JPG, PNG, or PDF (max 10MB each) • Multiple files supported
                </p>
              </>
            )}
          </div>
        )}

        {files.length > 0 && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {files.map((fileStatus, index) => (
              <div
                key={index}
                className="border dark:border-gray-700 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(fileStatus.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate dark:text-white">
                      {fileStatus.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {getStatusText(fileStatus.status)}
                      {fileStatus.error && ` - ${fileStatus.error}`}
                    </p>
                  </div>
                </div>
                
                {(fileStatus.status === 'uploading' || fileStatus.status === 'processing') && (
                  <Progress value={fileStatus.progress} className="h-1" />
                )}
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && !isProcessing && (
          <div className="flex gap-2">
            {hasLimitError && onUpgradeRequired ? (
              <>
                <Button onClick={handleClose} variant="outline" className="flex-1">
                  Close
                </Button>
                <Button onClick={onUpgradeRequired} className="flex-1">
                  <Crown className="mr-2 h-4 w-4" />
                  Upgrade Plan
                </Button>
              </>
            ) : (
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
