/**
 * BL-024-F001-3 · Add KOL form dialog for /database header.
 *
 * Fields: platform (select) / handle / display name (required); url +
 * email + follower count (optional, validated client-side & server-side).
 * Submits via the `addKolAction` server action; on success we reset the
 * form, close the dialog, and refresh the page so the new row appears.
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
  FieldError,
  Input,
  Label,
  Select,
} from "@/components/ui";

import { addKolAction, type AddKolInput } from "./actions";

const PLATFORM_OPTIONS = [
  "youtube",
  "tiktok",
  "instagram",
  "twitch",
  "bilibili",
  "x",
  "manual",
] as const;

interface Props {
  triggerLabel: string;
  triggerTitle: string;
  dialogTitle: string;
  platformLabel: string;
  handleLabel: string;
  handlePlaceholder: string;
  displayNameLabel: string;
  urlLabel: string;
  emailLabel: string;
  followerCountLabel: string;
  submitLabel: string;
  submittingLabel: string;
  cancelLabel: string;
  successLabel: string;
  errorLabel: string;
  duplicateLabel: string;
  rateLimitLabel: string;
  invalidUrlLabel: string;
  invalidEmailLabel: string;
}

interface FieldErrors {
  handle?: string;
  displayName?: string;
  url?: string;
  email?: string;
  general?: string;
}

export function AddKolDialog({
  triggerLabel,
  triggerTitle,
  dialogTitle,
  platformLabel,
  handleLabel,
  handlePlaceholder,
  displayNameLabel,
  urlLabel,
  emailLabel,
  followerCountLabel,
  submitLabel,
  submittingLabel,
  cancelLabel,
  successLabel,
  errorLabel,
  duplicateLabel,
  rateLimitLabel,
  invalidUrlLabel,
  invalidEmailLabel,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<typeof PLATFORM_OPTIONS[number]>("youtube");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setPlatform("youtube");
    setHandle("");
    setDisplayName("");
    setUrl("");
    setEmail("");
    setFollowerCount("");
    setErrors({});
    setSuccess(null);
  };

  const handleClose = (next: boolean) => {
    if (isPending) return;
    setOpen(next);
    if (!next) reset();
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});
      setSuccess(null);

      const trimmedHandle = handle.trim();
      const trimmedName = displayName.trim();
      const fieldErrors: FieldErrors = {};
      if (!trimmedHandle) fieldErrors.handle = "required";
      if (!trimmedName) fieldErrors.displayName = "required";
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        return;
      }

      const followerCountNum = followerCount.trim()
        ? Number.parseInt(followerCount.trim(), 10)
        : 0;

      const input: AddKolInput = {
        platform,
        handle: trimmedHandle,
        displayName: trimmedName,
        url: url.trim() || undefined,
        email: email.trim() || undefined,
        followerCount: Number.isFinite(followerCountNum) ? followerCountNum : 0,
      };

      startTransition(async () => {
        const res = await addKolAction(input);
        if (!res.ok) {
          if (res.error === "duplicate") setErrors({ general: duplicateLabel });
          else if (res.error === "rate_limit_exceeded")
            setErrors({ general: rateLimitLabel });
          else if (res.error === "invalid_url")
            setErrors({ url: invalidUrlLabel });
          else if (res.error === "invalid_email")
            setErrors({ email: invalidEmailLabel });
          else setErrors({ general: errorLabel });
          return;
        }
        setSuccess(successLabel);
        router.refresh();
        // Close shortly after success so the toast is visible. We close
        // via setOpen + an explicit reset() rather than handleClose to
        // keep the useCallback deps minimal — the same reset logic runs.
        setTimeout(() => {
          setOpen(false);
          setPlatform("youtube");
          setHandle("");
          setDisplayName("");
          setUrl("");
          setEmail("");
          setFollowerCount("");
          setErrors({});
          setSuccess(null);
        }, 800);
      });
    },
    [
      platform,
      handle,
      displayName,
      url,
      email,
      followerCount,
      duplicateLabel,
      rateLimitLabel,
      invalidUrlLabel,
      invalidEmailLabel,
      errorLabel,
      successLabel,
      router,
    ]
  );

  return (
    <>
      <Button
        variant="primary-gradient"
        title={triggerTitle}
        data-testid="database-add-kol"
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          add
        </span>
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPanel size="md" data-testid="database-add-kol-dialog">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-5 py-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="add-kol-platform">{platformLabel}</Label>
                <Select
                  id="add-kol-platform"
                  value={platform}
                  onChange={(e) =>
                    setPlatform(e.target.value as typeof PLATFORM_OPTIONS[number])
                  }
                  data-testid="add-kol-platform"
                >
                  {PLATFORM_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="add-kol-handle">{handleLabel}</Label>
                <Input
                  id="add-kol-handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder={handlePlaceholder}
                  required
                  data-testid="add-kol-handle"
                />
                {errors.handle ? <FieldError>{errors.handle}</FieldError> : null}
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="add-kol-name">{displayNameLabel}</Label>
                <Input
                  id="add-kol-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  data-testid="add-kol-name"
                />
                {errors.displayName ? (
                  <FieldError>{errors.displayName}</FieldError>
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="add-kol-url">{urlLabel}</Label>
                <Input
                  id="add-kol-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="url"
                  placeholder="https://"
                  data-testid="add-kol-url"
                />
                {errors.url ? <FieldError>{errors.url}</FieldError> : null}
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="add-kol-email">{emailLabel}</Label>
                <Input
                  id="add-kol-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  data-testid="add-kol-email"
                />
                {errors.email ? <FieldError>{errors.email}</FieldError> : null}
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="add-kol-followers">{followerCountLabel}</Label>
                <Input
                  id="add-kol-followers"
                  value={followerCount}
                  onChange={(e) => setFollowerCount(e.target.value)}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  data-testid="add-kol-followers"
                />
              </div>

              {errors.general ? (
                <p
                  role="alert"
                  className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"
                  data-testid="add-kol-error"
                >
                  {errors.general}
                </p>
              ) : null}
              {success ? (
                <p
                  role="status"
                  className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200"
                  data-testid="add-kol-success"
                >
                  {success}
                </p>
              ) : null}

              <DialogFooter className="-mx-5 -mb-4 mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => handleClose(false)}
                  data-testid="add-kol-cancel"
                >
                  {cancelLabel}
                </Button>
                <Button
                  type="submit"
                  variant="primary-gradient"
                  disabled={isPending}
                  data-testid="add-kol-submit"
                >
                  {isPending ? submittingLabel : submitLabel}
                </Button>
              </DialogFooter>
            </form>
          </DialogPanel>
        </DialogPortal>
      </Dialog>
    </>
  );
}
