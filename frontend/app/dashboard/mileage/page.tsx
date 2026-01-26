'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Car, MapPin, Calendar, PoundSterling, Plus, ArrowRight, Bike, Bike as Motorbike, Trash2, TrendingUp, Download, Pencil, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { mileageAPI, journeyTemplatesAPI, authAPI, MileageClaim, MileageStats, JourneyTemplate, API_URL } from '@/lib/api';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import AddMileageModal from '@/components/add-mileage-modal';
import EditMileageModal from '@/components/edit-mileage-modal';
import ManageTemplatesDialog from '@/components/manage-templates-dialog';
import { UpgradePlanDialog } from '@/components/upgrade-plan-dialog';
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

type VehicleFilter = 'all' | 'car' | 'motorcycle' | 'bicycle';

export default function MileagePage() {
  const { toast } = useToast();
  const [claims, setClaims] = useState<MileageClaim[]>([]);
  const [stats, setStats] = useState<MileageStats | null>(null);
  const [templates, setTemplates] = useState<JourneyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [claimToEdit, setClaimToEdit] = useState<MileageClaim | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [claimToDelete, setClaimToDelete] = useState<MileageClaim | null>(null);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [subscriptionUsage, setSubscriptionUsage] = useState<any>(null);
  
  // Filters
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const claimsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoading(true);
      const params: any = {};
      if (vehicleFilter !== 'all') params.vehicle_type = vehicleFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      
      const [claimsData, statsData, templatesData, userData, usageResponse] = await Promise.all([
        mileageAPI.list(token, params),
        mileageAPI.getStats(token),
        journeyTemplatesAPI.list(token),
        authAPI.me(token),
        fetch(`${API_URL}/api/v1/users/me/subscription`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.json())
      ]);
      setClaims(claimsData);
      setStats(statsData);
      setTemplates(templatesData);
      setUser(userData);
      setSubscriptionUsage(usageResponse);
    } catch (error) {
      console.error('Failed to fetch mileage data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load mileage claims'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddClaim = async () => {
    await fetchData();
    setAddModalOpen(false);
    toast({
      title: 'Success',
      description: 'Mileage claim added successfully'
    });
  };

  const handleEditClick = (claim: MileageClaim) => {
    setClaimToEdit(claim);
    setEditModalOpen(true);
  };

  const handleEditSuccess = async () => {
    await fetchData();
    setEditModalOpen(false);
    setClaimToEdit(null);
    toast({
      title: 'Success',
      description: 'Mileage claim updated successfully'
    });
  };

  const handleDeleteClick = (claim: MileageClaim) => {
    setClaimToDelete(claim);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!claimToDelete) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await mileageAPI.delete(token, claimToDelete.id);
      setClaims(claims.filter(c => c.id !== claimToDelete.id));
      toast({
        title: 'Deleted',
        description: 'Mileage claim deleted successfully'
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete mileage claim'
      });
    } finally {
      setDeleteDialogOpen(false);
      setClaimToDelete(null);
    }
  };

  const exportMileage = () => {
    if (filteredClaims.length === 0) {
      toast({
        title: 'No mileage claims to export',
        description: 'Try adjusting your filters.',
        variant: 'destructive',
      });
      return;
    }

    // Create CSV content
    const headers = ['Date', 'Start Location', 'End Location', 'Distance (miles)', 'Vehicle Type', 'Purpose', 'Amount (£)'];
    const rows = filteredClaims.map(claim => [
      format(new Date(claim.date), 'yyyy-MM-dd'),
      claim.start_location,
      claim.end_location,
      claim.distance_miles?.toFixed(1) || '0.0',
      claim.vehicle_type,
      claim.business_purpose || '',
      claim.claim_amount?.toFixed(2) || '0.00'
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
    link.download = `mileage-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Mileage exported',
      description: `${filteredClaims.length} claim(s) exported successfully.`,
    });
  };

  // Filter claims
  const filteredClaims = claims.filter(claim => {
    const matchesVehicle = vehicleFilter === 'all' || claim.vehicle_type === vehicleFilter;
    const matchesSearch = searchQuery === '' || 
      claim.start_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.end_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.business_purpose.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesVehicle && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredClaims.length / claimsPerPage);
  const startIndex = (currentPage - 1) * claimsPerPage;
  const endIndex = startIndex + claimsPerPage;
  const paginatedClaims = filteredClaims.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [vehicleFilter, searchQuery, fromDate, toDate]);

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'car': return <Car className="h-4 w-4" />;
      case 'motorcycle': return <Motorbike className="h-4 w-4" />;
      case 'bicycle': return <Bike className="h-4 w-4" />;
      default: return <Car className="h-4 w-4" />;
    }
  };

  const getVehicleColor = (type: string) => {
    switch (type) {
      case 'car': return 'bg-blue-500';
      case 'motorcycle': return 'bg-orange-500';
      case 'bicycle': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Mileage Claims</h1>
          <p className="text-sm text-muted-foreground">Track your business mileage and HMRC claims</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportMileage} variant="outline" className="flex-1 sm:flex-initial">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export Mileage</span>
          </Button>
          <Button onClick={() => setAddModalOpen(true)} className="flex-1 sm:flex-initial">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Mileage</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_claims || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Miles</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_miles.toFixed(1) || '0.0'}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claimed</CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats?.total_amount.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground mt-1">HMRC rates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tax Year Miles</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.current_tax_year_miles.toFixed(0) || '0'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats && stats.current_tax_year_miles < 10000 ? (
                <span className="text-green-600">At 45p/mile</span>
              ) : (
                <span className="text-orange-600">At 25p/mile</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search and Vehicle Type Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search locations or purpose..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={vehicleFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setVehicleFilter('all')}
                  size="sm"
                  className="flex-1 sm:flex-initial"
                >
                  All
                </Button>
                <Button
                  variant={vehicleFilter === 'car' ? 'default' : 'outline'}
                  onClick={() => setVehicleFilter('car')}
                  size="sm"
                  className="flex-1 sm:flex-initial"
                >
                  <Car className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Car</span>
                </Button>
                <Button
                  variant={vehicleFilter === 'motorcycle' ? 'default' : 'outline'}
                  onClick={() => setVehicleFilter('motorcycle')}
                  size="sm"
                  className="flex-1 sm:flex-initial"
                >
                  <Motorbike className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Bike</span>
                </Button>
                <Button
                  variant={vehicleFilter === 'bicycle' ? 'default' : 'outline'}
                  onClick={() => setVehicleFilter('bicycle')}
                  size="sm"
                  className="flex-1 sm:flex-initial"
                >
                  <Bike className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Bicycle</span>
                </Button>
              </div>
            </div>

            {/* Date Range Row */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="from-date" className="text-sm text-muted-foreground">From Date</Label>
                  <Input
                    id="from-date"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="to-date" className="text-sm text-muted-foreground">To Date</Label>
                  <Input
                    id="to-date"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={fetchData} variant="default" size="sm" className="flex-1 sm:flex-initial">
                  Apply Filters
                </Button>
                {(fromDate || toDate) && (
                  <Button 
                    onClick={() => {
                      setFromDate('');
                      setToDate('');
                      // Will trigger useEffect to refetch
                      setTimeout(fetchData, 0);
                    }} 
                    variant="outline" 
                    size="sm"
                    className="flex-1 sm:flex-initial"
                  >
                    Clear Dates
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claims List */}
      <div className="space-y-4">
        {filteredClaims.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Car className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {searchQuery || vehicleFilter !== 'all' 
                  ? 'No mileage claims match your filters'
                  : 'No mileage claims yet'}
              </p>
              {!searchQuery && vehicleFilter === 'all' && (
                <Button onClick={() => setAddModalOpen(true)} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Claim
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {paginatedClaims.map((claim) => (
              <Card 
                key={claim.id} 
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 space-y-2 w-full">
                      {/* Header with date and vehicle */}
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${getVehicleColor(claim.vehicle_type)}`}>
                          <div className="text-white">
                            {getVehicleIcon(claim.vehicle_type)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium">
                                {format(new Date(claim.date), 'PPP')}
                              </span>
                              {claim.is_round_trip && (
                                <Badge variant="secondary" className="ml-2">Round Trip</Badge>
                              )}
                            </div>
                            {/* Route */}
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm truncate">{claim.start_location}</span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm truncate">{claim.end_location}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-wrap items-center gap-2 text-sm pl-0 sm:pl-12">
                        <span className="text-muted-foreground">{claim.distance_miles.toFixed(1)} mi</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{(claim.hmrc_rate * 100).toFixed(0)}p/mi</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-bold text-green-600">£{claim.claim_amount.toFixed(2)}</span>
                      </div>

                      {/* Business purpose */}
                      <div className="pl-0 sm:pl-12 text-sm text-muted-foreground">
                        {claim.business_purpose}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 self-start">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(claim);
                        }}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(claim);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
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

      {/* Add Mileage Modal */}
      <AddMileageModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={handleAddClaim}
        templates={templates}
        onManageTemplates={() => setTemplatesDialogOpen(true)}
        subscriptionUsage={subscriptionUsage}
        onUpgradeRequired={() => {
          setAddModalOpen(false);
          setUpgradeDialogOpen(true);
        }}
      />

      {/* Upgrade Plan Dialog */}
      <UpgradePlanDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        currentPlan={(user?.subscription_plan || 'free') as 'free' | 'professional' | 'pro_plus'}
        onPlanUpdated={fetchData}
      />

      {/* Edit Mileage Modal */}
      <EditMileageModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={handleEditSuccess}
        claim={claimToEdit}
      />

      {/* Manage Templates Dialog */}
      <ManageTemplatesDialog
        open={templatesDialogOpen}
        onOpenChange={setTemplatesDialogOpen}
        templates={templates}
        onUpdate={fetchData}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mileage Claim</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this mileage claim? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
