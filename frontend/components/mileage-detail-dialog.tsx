'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MileageClaim } from '@/lib/api';
import { format } from 'date-fns';
import { Car, Bike as Motorbike, Bike, MapPin, Calendar, PoundSterling, ArrowRight, Clock, Pencil, Trash2 } from 'lucide-react';

interface MileageDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: MileageClaim | null;
  onEdit: (claim: MileageClaim) => void;
  onDelete: (claim: MileageClaim) => void;
}

export default function MileageDetailDialog({ 
  open, 
  onOpenChange, 
  claim, 
  onEdit, 
  onDelete 
}: MileageDetailDialogProps) {
  if (!claim) return null;

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'car': return <Car className="h-5 w-5" />;
      case 'motorcycle': return <Motorbike className="h-5 w-5" />;
      case 'bicycle': return <Bike className="h-5 w-5" />;
      default: return <Car className="h-5 w-5" />;
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

  const getVehicleName = (type: string) => {
    switch (type) {
      case 'car': return 'Car';
      case 'motorcycle': return 'Motorcycle';
      case 'bicycle': return 'Bicycle';
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[37.5rem]">
        <DialogHeader>
          <DialogTitle>Mileage Claim Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Vehicle Type Badge */}
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${getVehicleColor(claim.vehicle_type)}`}>
              <div className="text-white">
                {getVehicleIcon(claim.vehicle_type)}
              </div>
            </div>
            <div>
              <div className="font-medium text-lg">{getVehicleName(claim.vehicle_type)}</div>
              <div className="text-sm text-muted-foreground">
                {(claim.hmrc_rate * 100).toFixed(0)}p per mile
              </div>
            </div>
            {claim.is_round_trip && (
              <Badge variant="secondary" className="ml-auto">Round Trip</Badge>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Date</span>
            </div>
            <div className="font-medium">
              {format(new Date(claim.date), 'EEEE, MMMM d, yyyy')}
            </div>
          </div>

          {/* Route */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Journey</span>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Start</div>
                  <div className="font-medium">{claim.start_location}</div>
                  {claim.start_lat && claim.start_lng && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {claim.start_lat.toFixed(6)}, {claim.start_lng.toFixed(6)}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3 pl-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  {claim.distance_miles.toFixed(1)} miles
                  {claim.is_round_trip && ' (each way)'}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-red-500 mt-2" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Destination</div>
                  <div className="font-medium">{claim.end_location}</div>
                  {claim.end_lat && claim.end_lng && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {claim.end_lat.toFixed(6)}, {claim.end_lng.toFixed(6)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Business Purpose */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground font-medium">Business Purpose</div>
            <div className="bg-muted/50 p-4 rounded-lg">
              {claim.business_purpose}
            </div>
          </div>

          {/* Claim Calculation */}
          <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PoundSterling className="h-4 w-4" />
              <span>Claim Calculation</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Distance:</span>
                <span className="font-medium">
                  {claim.distance_miles.toFixed(1)} miles
                  {claim.is_round_trip && ' (total)'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">HMRC Rate:</span>
                <span className="font-medium">{(claim.hmrc_rate * 100).toFixed(0)}p/mile</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-green-200 dark:border-green-800">
                <span className="font-medium">Total Claim:</span>
                <span className="text-2xl font-bold text-green-600">
                  £{claim.claim_amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>Created</span>
              </div>
              <span>{format(new Date(claim.created_at), 'PPp')}</span>
            </div>
            {claim.updated_at !== claim.created_at && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>Last Updated</span>
                </div>
                <span>{format(new Date(claim.updated_at), 'PPp')}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onEdit(claim);
              }}
              className="flex-1"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onDelete(claim);
              }}
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
