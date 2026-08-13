import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function CategoryProgressResetDialog({
  categoryLabel,
  error,
  isOpen,
  isResetting,
  onCancel,
  onConfirm,
}: {
  categoryLabel: string;
  error: string | null;
  isOpen: boolean;
  isResetting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {categoryLabel} ilerlemesi sıfırlansın mı?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Bu kategorinin bütün modlarına ait devam eden ve tamamlanan
            oturumlar ile kelime sonuçları kalıcı olarak silinecek. Bu işlem
            geri alınamaz.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p className="type-helper text-error" role="alert">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <Button
            disabled={isResetting}
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Vazgeç
          </Button>
          <Button
            disabled={isResetting}
            type="button"
            variant="destructive"
            onClick={onConfirm}
          >
            {isResetting ? "Sıfırlanıyor..." : "Sıfırla"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
