import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: () => void;
  loading?: boolean;
  confirmLabel?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Delete this entry?",
  description = "This entry will be permanently deleted and cannot be recovered.",
  onConfirm,
  loading,
  confirmLabel,
}: ConfirmDialogProps) {
  const [typedText, setTypedText] = useState("");

  const isDeleteAction =
    !confirmLabel ||
    confirmLabel.toLowerCase().includes("delete") ||
    title.toLowerCase().includes("delete") ||
    title.toLowerCase().includes("remove");

  useEffect(() => {
    if (!open) {
      setTypedText("");
    }
  }, [open]);

  const isValid = !isDeleteAction || typedText.trim().toLowerCase() === "delete";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {isDeleteAction && (
          <div className="space-y-1.5 py-1">
            <p className="text-xs font-medium text-muted-foreground">
              Please type <span className="font-mono font-bold text-destructive">delete</span> to confirm deletion:
            </p>
            <Input
              value={typedText}
              onChange={e => setTypedText(e.target.value)}
              placeholder="type 'delete' here"
              className="h-9 text-sm"
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={e => {
              if (!isValid) {
                e.preventDefault();
                return;
              }
              onConfirm();
            }}
            disabled={loading || !isValid}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : confirmLabel ?? "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
