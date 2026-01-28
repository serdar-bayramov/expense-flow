'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { journeyTemplatesAPI, JourneyTemplate, CreateJourneyTemplateData } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Car, Bike as Motorbike, Bike, Plus, Trash2, Pencil, Loader2, MapPin, X } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

interface ManageTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: JourneyTemplate[];
  onUpdate: () => void;
}

export default function ManageTemplatesDialog({ open, onOpenChange, templates, onUpdate }: ManageTemplatesDialogProps) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  
  const [formData, setFormData] = useState<CreateJourneyTemplateData>({
    name: '',
    start_location: '',
    end_location: '',
    vehicle_type: 'car',
    business_purpose: '',
    is_round_trip: false,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      start_location: '',
      end_location: '',
      vehicle_type: 'car',
      business_purpose: '',
      is_round_trip: false,
    });
    setEditingId(null);
    setCreating(false);
  };

  const handleEdit = (template: JourneyTemplate) => {
    setFormData({
      name: template.name,
      start_location: template.start_location,
      end_location: template.end_location,
      vehicle_type: template.vehicle_type,
      business_purpose: template.business_purpose,
      is_round_trip: template.is_round_trip,
    });
    setEditingId(template.id);
    setCreating(false);
  };

  const handleSave = async () => {
    const token = await getToken();
    if (!token) return;

    if (!formData.name || !formData.start_location || !formData.end_location || !formData.business_purpose) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all required fields'
      });
      return;
    }

    try {
      setLoading(true);
      if (editingId) {
        await journeyTemplatesAPI.update(token, editingId, formData);
        toast({
          title: 'Updated',
          description: 'Template updated successfully'
        });
      } else {
        await journeyTemplatesAPI.create(token, formData);
        toast({
          title: 'Created',
          description: 'Template created successfully'
        });
      }
      resetForm();
      onUpdate();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to save template'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setTemplateToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    
    const token = await getToken();
    if (!token) return;

    try {
      await journeyTemplatesAPI.delete(token, templateToDelete.id);
      toast({
        title: 'Deleted',
        description: 'Template deleted successfully'
      });
      onUpdate();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete template'
      });
    } finally {
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'car': return <Car className="h-3 w-3" />;
      case 'motorcycle': return <Motorbike className="h-3 w-3" />;
      case 'bicycle': return <Bike className="h-3 w-3" />;
      default: return <Car className="h-3 w-3" />;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Journey Templates</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Form (Create or Edit) */}
          {(creating || editingId) && (
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{editingId ? 'Edit Template' : 'New Template'}</h3>
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Template Name */}
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name *</Label>
                  <Input
                    id="template-name"
                    placeholder="e.g., Home to Office"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Vehicle Type */}
                <div className="space-y-2">
                  <Label>Vehicle Type</Label>
                  <RadioGroup
                    value={formData.vehicle_type}
                    onValueChange={(value: any) => setFormData({ ...formData, vehicle_type: value })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="car" id="tmpl-car" />
                      <Label htmlFor="tmpl-car" className="cursor-pointer">Car</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="motorcycle" id="tmpl-motorcycle" />
                      <Label htmlFor="tmpl-motorcycle" className="cursor-pointer">Motorcycle</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="bicycle" id="tmpl-bicycle" />
                      <Label htmlFor="tmpl-bicycle" className="cursor-pointer">Bicycle</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Locations */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tmpl-start">Start Location *</Label>
                    <Input
                      id="tmpl-start"
                      placeholder="London"
                      value={formData.start_location}
                      onChange={(e) => setFormData({ ...formData, start_location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tmpl-end">End Location *</Label>
                    <Input
                      id="tmpl-end"
                      placeholder="Manchester"
                      value={formData.end_location}
                      onChange={(e) => setFormData({ ...formData, end_location: e.target.value })}
                    />
                  </div>
                </div>

                {/* Round Trip */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tmpl-roundtrip"
                    checked={formData.is_round_trip}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_round_trip: checked as boolean })}
                  />
                  <Label htmlFor="tmpl-roundtrip" className="cursor-pointer">Round trip by default</Label>
                </div>

                {/* Business Purpose */}
                <div className="space-y-2">
                  <Label htmlFor="tmpl-purpose">Business Purpose *</Label>
                  <Textarea
                    id="tmpl-purpose"
                    placeholder="e.g., Daily commute to office"
                    value={formData.business_purpose}
                    onChange={(e) => setFormData({ ...formData, business_purpose: e.target.value })}
                    rows={2}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      editingId ? 'Update Template' : 'Create Template'
                    )}
                  </Button>
                  <Button variant="outline" onClick={resetForm} disabled={loading}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Create Button */}
          {!creating && !editingId && (
            <Button onClick={() => setCreating(true)} variant="outline" className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Create New Template
            </Button>
          )}

          {/* Templates List */}
          <div className="space-y-3">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No templates yet</p>
                <p className="text-sm mt-1">Create templates for your common journeys</p>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 border rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded ${getVehicleColor(template.vehicle_type)}`}>
                          <div className="text-white">
                            {getVehicleIcon(template.vehicle_type)}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          {template.is_round_trip && (
                            <Badge variant="secondary" className="mt-1">Round Trip</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground pl-11">
                        <MapPin className="h-3 w-3" />
                        <span>{template.start_location} → {template.end_location}</span>
                      </div>
                      <div className="text-sm text-muted-foreground pl-11">
                        {template.business_purpose}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template.id, template.name)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the template "{templateToDelete?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
