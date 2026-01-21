'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Car, MapPin, Calendar, PoundSterling, Plus, ArrowRight, Bike, Bike as Motorbike, Trash2, TrendingUp } from 'lucide-react';
import { mileageAPI, MileageClaim, MileageStats } from '@/lib/api';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import AddMileageModal from '@/components/add-mileage-modal';
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
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [claimToDelete, setClaimToDelete] = useState<MileageClaim | null>(null);
  
  // Filters
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoading(true);
      const [claimsData, statsData] = await Promise.all([
        mileageAPI.list(token),
        mileageAPI.getStats(token)
      ]);
      setClaims(claimsData);
      setStats(statsData);
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

  // Filter claims
  const filteredClaims = claims.filter(claim => {
    const matchesVehicle = vehicleFilter === 'all' || claim.vehicle_type === vehicleFilter;
    const matchesSearch = searchQuery === '' || 
      claim.start_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.end_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.business_purpose.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesVehicle && matchesSearch;
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mileage Claims</h1>
          <p className="text-muted-foreground">Track your business mileage and HMRC claims</p>
        </div>
        <Button onClick={() => setAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Mileage
        </Button>
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
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search locations or purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={vehicleFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setVehicleFilter('all')}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={vehicleFilter === 'car' ? 'default' : 'outline'}
                onClick={() => setVehicleFilter('car')}
                size="sm"
              >
                <Car className="mr-2 h-4 w-4" />
                Car
              </Button>
              <Button
                variant={vehicleFilter === 'motorcycle' ? 'default' : 'outline'}
                onClick={() => setVehicleFilter('motorcycle')}
                size="sm"
              >
                <Motorbike className="mr-2 h-4 w-4" />
                Bike
              </Button>
              <Button
                variant={vehicleFilter === 'bicycle' ? 'default' : 'outline'}
                onClick={() => setVehicleFilter('bicycle')}
                size="sm"
              >
                <Bike className="mr-2 h-4 w-4" />
                Bicycle
              </Button>
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
          filteredClaims.map((claim) => (
            <Card key={claim.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    {/* Header with date and vehicle */}
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getVehicleColor(claim.vehicle_type)}`}>
                        <div className="text-white">
                          {getVehicleIcon(claim.vehicle_type)}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {format(new Date(claim.date), 'PPP')}
                          </span>
                          {claim.is_round_trip && (
                            <Badge variant="secondary" className="ml-2">Round Trip</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-2 pl-12">
                      <div className="flex items-center gap-2 flex-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{claim.start_location}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{claim.end_location}</span>
                      </div>
                    </div>

                    {/* Business purpose */}
                    <div className="pl-12 text-sm text-muted-foreground">
                      {claim.business_purpose}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 pl-12 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Distance:</span>
                        <span className="font-medium">{claim.distance_miles.toFixed(1)} miles</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rate:</span>
                        <span className="font-medium">{(claim.hmrc_rate * 100).toFixed(0)}p/mile</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-600">£{claim.claim_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(claim)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Mileage Modal */}
      <AddMileageModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={handleAddClaim}
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
