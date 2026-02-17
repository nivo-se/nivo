import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

interface SaveListDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, isPublic: boolean) => void;
  companyCount: number;
}

export function SaveListDialog({ open, onClose, onSave, companyCount }: SaveListDialogProps) {
  const [name, setName] = useState('');
  const [privacy, setPrivacy] = useState<'private' | 'public'>('private');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), privacy === 'public');
      setName('');
      setPrivacy('private');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as List</DialogTitle>
          <DialogDescription>
            Create a new list with {companyCount} selected {companyCount === 1 ? 'company' : 'companies'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="list-name">List Name</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 Manufacturing Targets"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Privacy</Label>
            <RadioGroup value={privacy} onValueChange={(value) => setPrivacy(value as 'private' | 'public')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="private" />
                <Label htmlFor="private" className="font-normal cursor-pointer">
                  Private (only you can see this list)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" />
                <Label htmlFor="public" className="font-normal cursor-pointer">
                  Shareable (team members can view)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
            ✓ Filters will be saved with this list so you can reload and modify them later
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Create List</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
