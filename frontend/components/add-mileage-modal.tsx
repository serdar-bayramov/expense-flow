'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { mileageAPI, CreateMileageClaimData } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Car, Bike as Motorbike, Bike, Loader2, MapPin } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

interface AddMileageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Format UK postcode (e.g., "b295ug" -> "B29 5UG")
const formatPostcode = (postcode: string): string => {
  const cleaned = postcode.replace(/\s+/g, '').toUpperCase();
  
  // UK postcode patterns (simplified)
  const patterns = [
    /^([A-Z]{1,2}\d{1,2})(\d[A-Z]{2})$/,  // e.g., B29 5UG, SW1A 1AA
    /^([A-Z]{1,2}\d[A-Z])(\d[A-Z]{2})$/,  // e.g., W1A 0AX
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
  }
  
  return postcode; // Return original if not a valid postcode
};

// Capitalize city/location names (e.g., "liverpool" -> "Liverpool")
const capitalizeLocation = (location: string): string => {
  return location
    .split(/\s+/)
    .map(word => {
      // Keep small words lowercase in the middle (of, the, etc.)
      if (word.length <= 2 && /^[a-z]+$/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

// Format location: try postcode first, then capitalize as city name
const formatLocation = (location: string): string => {
  const trimmed = location.trim();
  if (!trimmed) return trimmed;
  
  // Check if it looks like a postcode (no commas, mostly alphanumeric)
  if (!/[,]/.test(trimmed) && /^[A-Za-z0-9\s]+$/.test(trimmed)) {
    const formatted = formatPostcode(trimmed);
    if (formatted !== trimmed) {
      return formatted; // It was a valid postcode
    }
  }
  
  // Otherwise, capitalize as a location name
  return capitalizeLocation(trimmed);
};

export default function AddMileageModal({ open, onOpenChange, onSuccess }: AddMileageModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  
  const [formData, setFormData] = useState<CreateMileageClaimData>({
    date: new Date().toISOString().split('T')[0],
    start_location: '',
    end_location: '',
    vehicle_type: 'car',
    business_purpose: '',
    is_round_trip: false,
  });

  const [distancePreview, setDistancePreview] = useState<{
    miles: number;
    amount: number;
    rate: number;
    duration: string;
  } | null>(null);

  const handleCalculateDistance = async () => {
    if (!formData.start_location || !formData.end_location) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please enter both start and end locations'
      });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setCalculatingDistance(true);
      const result = await mileageAPI.calculateDistance(
        token,
        formData.start_location,
        formData.end_location,
        formData.vehicle_type
      );

      // Calculate estimated claim (this is approximate - backend will do final calculation)
      let miles = result.distance_miles;
      if (formData.is_round_trip) {
        miles *= 2;
      }

      // Simple rate estimation (backend handles threshold logic)
      const rate = formData.vehicle_type === 'car' ? 0.45 : 
                   formData.vehicle_type === 'motorcycle' ? 0.24 : 0.20;
      const amount = miles * rate;

      setDistancePreview({
        miles,
        amount,
        rate,
        duration: result.duration_text
      });

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to calculate distance'
      });
    } finally {
      setCalculatingDistance(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.start_location || !formData.end_location || !formData.business_purpose) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all required fields'
      });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoading(true);
      await mileageAPI.create(token, formData);
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        start_location: '',
        end_location: '',
        vehicle_type: 'car',
        business_purpose: '',
        is_round_trip: false,
      });
      setDistancePreview(null);
      
      onSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to create mileage claim'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-137.5 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Mileage Claim</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          {/* Vehicle Type */}
          <div className="space-y-2">
            <Label>Vehicle Type</Label>
            <RadioGroup
              value={formData.vehicle_type}
              onValueChange={(value: any) => {
                setFormData({ ...formData, vehicle_type: value });
                setDistancePreview(null); // Reset preview when vehicle changes
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="car" id="car" />
                <Label htmlFor="car" className="flex items-center gap-2 cursor-pointer">
                  <Car className="h-4 w-4" />
                  Car (45p/mile)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="motorcycle" id="motorcycle" />
                <Label htmlFor="motorcycle" className="flex items-center gap-2 cursor-pointer">
                  <Motorbike className="h-4 w-4" />
                  Motorcycle (24p)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bicycle" id="bicycle" />
                <Label htmlFor="bicycle" className="flex items-center gap-2 cursor-pointer">
                  <Bike className="h-4 w-4" />
                  Bicycle (20p)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Start Location */}
          <div className="space-y-2">
            <Label htmlFor="start">Start Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="start"
                placeholder="e.g., London, SW1A 1AA"
                value={formData.start_location}
                onChange={(e) => {
                  setFormData({ ...formData, start_location: e.target.value });
                  setDistancePreview(null);
                }}
                onBlur={(e) => {
                  const formatted = formatLocation(e.target.value);
                  if (formatted !== e.target.value) {
                    setFormData({ ...formData, start_location: formatted });
                  }
                }}
                className="pl-9"
                required
              />
            </div>
          </div>

          {/* End Location */}
          <div className="space-y-2">
            <Label htmlFor="end">End Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="end"
                placeholder="e.g., Manchester, M1 1AE"
                value={formData.end_location}
                onChange={(e) => {
                  setFormData({ ...formData, end_location: e.target.value });
                  setDistancePreview(null);
                }}
                onBlur={(e) => {
                  const formatted = formatLocation(e.target.value);
                  if (formatted !== e.target.value) {
                    setFormData({ ...formData, end_location: formatted });
                  }
                }}
                className="pl-9"
                required
              />
            </div>
          </div>

          {/* Round Trip */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="roundtrip"
              checked={formData.is_round_trip}
              onCheckedChange={(checked) => {
                setFormData({ ...formData, is_round_trip: checked as boolean });
                setDistancePreview(null);
              }}
            />
            <Label htmlFor="roundtrip" className="cursor-pointer">
              Round trip (doubles the distance)
            </Label>
          </div>

          {/* Calculate Distance Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleCalculateDistance}
            disabled={calculatingDistance || !formData.start_location || !formData.end_location}
            className="w-full"
          >
            {calculatingDistance ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calculating...
              </>
            ) : (
              'Calculate Distance & Preview Claim'
            )}
          </Button>

          {/* Distance Preview */}
          {distancePreview && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Distance:</span>
                <span className="font-medium">{distancePreview.miles.toFixed(1)} miles</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">{distancePreview.duration}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rate:</span>
                <span className="font-medium">{(distancePreview.rate * 100).toFixed(0)}p/mile</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-green-200 dark:border-green-800">
                <span className="font-medium">Estimated Claim:</span>
                <span className="font-bold text-green-600">£{distancePreview.amount.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                * Final amount may vary based on your annual mileage
              </p>
            </div>
          )}

          {/* Business Purpose */}
          <div className="space-y-2">
            <Label htmlFor="purpose">Business Purpose</Label>
            <Textarea
              id="purpose"
              placeholder="e.g., Client meeting, site visit, business conference..."
              value={formData.business_purpose}
              onChange={(e) => setFormData({ ...formData, business_purpose: e.target.value })}
              rows={3}
              required
            />
            <p className="text-xs text-muted-foreground">
              Required for HMRC compliance
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading || !distancePreview}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Claim'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
