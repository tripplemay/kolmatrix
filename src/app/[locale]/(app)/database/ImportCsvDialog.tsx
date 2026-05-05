/**
 * BL-024-F001-2 · Import CSV dialog for /database header.
 *
 * Single client component: trigger button + base-ui Dialog. Uses native
 * fetch + FormData to POST to `/api/database/import-csv`. While the
 * upload is in flight the trigger button shows a busy state and the
 * cancel button is disabled. On success the page is `router.refresh()`d
 * so the new rows show up in the table.
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui";
import {
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
} from "@/components/ui";

interface ImportError {
  row: number;
  message: string;
}

interface ImportSuccess {
  ok: true;
  importedCount: number;
  skippedCount: number;
  errors: ImportError[];
}

interface ImportFailure {
  ok: false;
  error: string;
  retryAfter?: number;
}

type ImportResponse = ImportSuccess | ImportFailure;

interface Props {
  triggerLabel: string;
  triggerTitle: string;
  dialogTitle: string;
  dialogBody: string;
  uploadLabel: string;
  uploadingLabel: string;
  cancelLabel: string;
  successTemplate: string;
  errorLabel: string;
  rateLimitLabel: string;
  fileTooLargeLabel: string;
  rowErrorTemplate: string;
}

export function ImportCsvDialog({
  triggerLabel,
  triggerTitle,
  dialogTitle,
  dialogBody,
  uploadLabel,
  uploadingLabel,
  cancelLabel,
  successTemplate,
  errorLabel,
  rateLimitLabel,
  fileTooLargeLabel,
  rowErrorTemplate,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    if (isPending) return;
    setOpen(next);
    if (!next) reset();
  };

  const handleSubmit = useCallback(() => {
    if (!file) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      let res: Response;
      try {
        res = await fetch("/api/database/import-csv", {
          method: "POST",
          body: fd,
        });
      } catch {
        setError(errorLabel);
        return;
      }
      let body: ImportResponse;
      try {
        body = (await res.json()) as ImportResponse;
      } catch {
        setError(errorLabel);
        return;
      }
      if (!body.ok) {
        if (body.error === "rate_limit_exceeded") {
          setError(rateLimitLabel);
        } else if (body.error === "file_too_large" || body.error === "too_many_rows") {
          setError(fileTooLargeLabel);
        } else {
          setError(errorLabel);
        }
        return;
      }
      setResult(body);
      router.refresh();
    });
  }, [file, errorLabel, rateLimitLabel, fileTooLargeLabel, router]);

  return (
    <>
      <Button
        variant="ghost"
        title={triggerTitle}
        className="border-purple/40 text-purple"
        data-testid="database-import"
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          publish
        </span>
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPanel size="md" data-testid="database-import-dialog">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 px-5 py-4 text-sm text-on-surface-variant">
              <p>{dialogBody}</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                disabled={isPending}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-on-surface/15 bg-surface-low/40 p-2 text-sm text-on-surface file:mr-3 file:rounded-md file:border-0 file:bg-cyan/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cyan"
                data-testid="database-import-file"
              />

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"
                  data-testid="database-import-error"
                >
                  {error}
                </p>
              ) : null}

              {result ? (
                <div
                  role="status"
                  className="flex flex-col gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"
                  data-testid="database-import-result"
                >
                  <p>
                    {successTemplate
                      .replace("{imported}", String(result.importedCount))
                      .replace("{skipped}", String(result.skippedCount))}
                  </p>
                  {result.errors.length > 0 ? (
                    <ul className="list-disc pl-4">
                      {result.errors.map((e, i) => (
                        <li key={`${e.row}-${i}`}>
                          {rowErrorTemplate
                            .replace("{row}", String(e.row))
                            .replace("{message}", e.message)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                disabled={isPending}
                onClick={() => handleClose(false)}
                data-testid="database-import-cancel"
              >
                {cancelLabel}
              </Button>
              <Button
                variant="primary-gradient"
                disabled={!file || isPending}
                onClick={handleSubmit}
                data-testid="database-import-submit"
              >
                {isPending ? uploadingLabel : uploadLabel}
              </Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPortal>
      </Dialog>
    </>
  );
}
