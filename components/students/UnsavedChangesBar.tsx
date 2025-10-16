import { Button } from "@/components/ui/button";
import { Save, X } from "lucide-react";

interface UnsavedChangesBarProps {
  onSave: () => void;
  onDiscard: () => void;
  isSaving: boolean;
}

export function UnsavedChangesBar({ onSave, onDiscard, isSaving }: UnsavedChangesBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <p className="font-semibold">You have unsaved changes.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDiscard} disabled={isSaving}>
            <X className="h-4 w-4 mr-2" />
            Discard
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
          </Button>
        </div>
      </div>
    </div>
  );
}