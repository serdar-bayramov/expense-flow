'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { xeroAPI, type XeroStatus } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink, 
  Zap,
  Clock,
  Building2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
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

interface XeroConnectionCardProps {
  token: string;
  userPlan: 'free' | 'professional' | 'pro_plus';
}

export function XeroConnectionCard({ token, userPlan }: XeroConnectionCardProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTogglingAutoSync, setIsTogglingAutoSync] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [bankAccountName, setBankAccountName] = useState<string | null>(null);

  // Check if user has Professional or Pro Plus plan
  const hasXeroAccess = userPlan === 'professional' || userPlan === 'pro_plus';

  // Fetch Xero status on mount and when URL changes (after OAuth callback)
  useEffect(() => {
    fetchStatus();

    // Check if we just returned from Xero OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const xeroSuccess = urlParams.get('xero_success');
    const xeroError = urlParams.get('xero_error');
    const orgName = urlParams.get('org_name');

    if (xeroSuccess === 'true' && orgName) {
      toast({
        title: '✅ Xero Connected!',
        description: `Successfully connected to ${decodeURIComponent(orgName)}`,
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh status
      fetchStatus();
    } else if (xeroError) {
      const message = urlParams.get('message') || 'Failed to connect to Xero';
      toast({
        title: '❌ Connection Failed',
        description: decodeURIComponent(message),
        variant: 'destructive',
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchStatus = async () => {
    if (!hasXeroAccess) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await xeroAPI.getStatus(token);
      setStatus(data);
      
      // If connected, also fetch bank accounts
      if (data.connected) {
        fetchBankAccounts();
      }
    } catch (error) {
      console.error('Failed to fetch Xero status:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Xero status',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const data = await xeroAPI.getBankAccounts(token);
      // Just show which bank account will be used (usually the first one)
      if (data.bank_accounts.length > 0) {
        const account = data.bank_accounts[0];
        setBankAccountName(account.name);
      }
    } catch (error) {
      console.error('Failed to fetch bank accounts:', error);
    }
  };

  const handleConnect = async () => {
    try {
      // Call API to get authorization URL (backend stores state in database)
      const { authorization_url } = await xeroAPI.getConnectUrl(token);
      // Redirect browser to Xero authorization page
      window.location.href = authorization_url;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start Xero connection',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await xeroAPI.disconnect(token);
      setStatus({
        connected: false,
        org_name: null,
        tenant_id: null,
        connected_at: null,
        auto_sync: false,
        token_expires_at: null,
      });
      toast({
        title: 'Disconnected',
        description: 'Successfully disconnected from Xero',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect from Xero',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
      setShowDisconnectDialog(false);
    }
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    setIsTogglingAutoSync(true);
    try {
      await xeroAPI.toggleAutoSync(token, enabled);
      setStatus(prev => prev ? { ...prev, auto_sync: enabled } : null);
      toast({
        title: enabled ? 'Auto-sync Enabled' : 'Auto-sync Disabled',
        description: enabled 
          ? 'Receipts will automatically sync to Xero after processing'
          : 'You\'ll need to manually sync each receipt',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update auto-sync setting',
        variant: 'destructive',
      });
    } finally {
      setIsTogglingAutoSync(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  // Upgrade prompt for Free tier users
  if (!hasXeroAccess) {
    return (
      <Card className="border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-gray-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ExternalLink className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="dark:text-white">Xero Integration</CardTitle>
              <CardDescription className="dark:text-gray-400">
                Automatically sync receipts to Xero
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upgrade to Professional or Pro Plus to unlock Xero integration:
            </p>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <span>Auto-sync completed receipts to Xero</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <span>Create bank transactions with receipt images</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <span>Save 2-3 hours per month on bookkeeping</span>
              </li>
            </ul>
          </div>

          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
            onClick={() => window.location.href = '/dashboard/settings'}
          >
            Upgrade to Professional
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-xs text-center text-gray-500 dark:text-gray-500">
            Professional: £10/month • Pro Plus: £17/month
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="dark:text-white">Xero Integration</CardTitle>
          <CardDescription className="dark:text-gray-400">
            Loading connection status...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not connected state
  if (!status?.connected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <ExternalLink className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <CardTitle className="dark:text-white">Xero Integration</CardTitle>
              <CardDescription className="dark:text-gray-400">
                Connect your Xero account to automatically sync expenses
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-white">Auto-sync completed receipts</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Receipts automatically appear in Xero after OCR</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-white">Attach images to transactions</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Receipt images stored with bank transactions</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-white">Save 2-3 hours per month</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">No more manual data entry in Xero</p>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleConnect}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Connect to Xero
          </Button>

          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">Secure:</strong> We use OAuth 2.0 for secure authentication. 
              Your Xero credentials are never stored on our servers.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connected state
  return (
    <>
      <Card className="border-green-200 dark:border-green-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="dark:text-white">Connected to Xero</CardTitle>
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                    Active
                  </Badge>
                </div>
                <CardDescription className="dark:text-gray-400">
                  Your expenses are syncing to Xero
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Organization Info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Building2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {status.org_name || 'Unknown Organization'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Connected {formatDate(status.connected_at)}
              </p>
            </div>
          </div>

          {/* Bank Account Info (Read-only) */}
          {bankAccountName && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Syncing to:</strong> {bankAccountName}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Need to change? Disconnect and reconnect to Xero
              </p>
            </div>
          )}

          {/* Auto-sync Toggle */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="auto-sync" className="text-sm font-medium cursor-pointer">
                Auto-sync receipts
              </Label>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {status.auto_sync 
                  ? 'Receipts automatically sync after OCR completes'
                  : 'You\'ll need to manually sync each receipt'
                }
              </p>
            </div>
            <Switch
              id="auto-sync"
              checked={status.auto_sync}
              onCheckedChange={handleToggleAutoSync}
              disabled={isTogglingAutoSync}
            />
          </div>

          {/* Info Message */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-900 dark:text-blue-200">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              <strong>Note:</strong> Only completed receipts (with processed OCR data) can be synced to Xero.
            </p>
          </div>

          {/* Disconnect Button */}
          <Button
            variant="outline"
            onClick={() => setShowDisconnectDialog(true)}
            className="w-full border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Disconnect from Xero
          </Button>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect from Xero?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your Xero connection and stop automatic syncing. 
              Your receipts in ExpenseFlow and transactions in Xero will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
