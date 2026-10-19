"use client";

import { useCallback, useEffect, useState } from "react";

import { clearAuth } from "@/lib/auth";
import { fetchQr, isAuthFailure } from "@/lib/staffApi";

type AdminQrBlockProps = {
  token: string;
  restaurantId: number;
  slug: string;
  restaurantName: string;
  imageClassName: string;
  onAuthFailure: () => void;
};

export function AdminQrBlock({
  token,
  restaurantId,
  slug,
  restaurantName,
  imageClassName,
  onAuthFailure,
}: AdminQrBlockProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrBlob, setQrBlob] = useState<Blob | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  const loadQr = useCallback(
    async (regen: boolean) => {
      setQrLoading(true);
      setQrError(null);
      try {
        const blob = await fetchQr(token, restaurantId, "png", undefined, {
          regen,
          bust: Date.now(),
        });
        setQrUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return URL.createObjectURL(blob);
        });
        setQrBlob(blob);
        return true;
      } catch (err: unknown) {
        if (isAuthFailure(err)) {
          clearAuth();
          onAuthFailure();
          return false;
        }
        setQrError("Could not load QR code. Refresh to try again.");
        return false;
      } finally {
        setQrLoading(false);
      }
    },
    [onAuthFailure, restaurantId, token],
  );

  useEffect(() => {
    void loadQr(false);
  }, [loadQr]);

  useEffect(() => {
    return () => {
      if (qrUrl) {
        URL.revokeObjectURL(qrUrl);
      }
    };
  }, [qrUrl]);

  function downloadQr() {
    if (!qrBlob) {
      return;
    }
    const href = URL.createObjectURL(qrBlob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${slug}-qr.png`;
    link.click();
    URL.revokeObjectURL(href);
  }

  async function confirmRegenerate() {
    setConfirmRegen(false);
    const ok = await loadQr(true);
    showToast(ok ? "QR refreshed" : "Could not regenerate. Try again.");
  }

  return (
    <div>
      {qrLoading ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : qrError || !qrUrl ? (
        <p className="mt-3 text-sm font-medium text-danger">{qrError ?? "Could not load QR code. Refresh to try again."}</p>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`${restaurantName} QR`} className={`mt-4 bg-white object-contain ${imageClassName}`} src={qrUrl} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={downloadQr}
            >
              Download QR
            </button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setConfirmRegen(true)}>
              Regenerate QR
            </button>
          </div>
        </>
      )}

      {confirmRegen ? (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-ink/50 p-4 backdrop-blur-[2px] sm:items-center">
          <div role="dialog" className="sticker w-full max-w-md animate-pop-in p-6">
            <h2 className="font-display text-2xl font-extrabold tracking-tight">Regenerate QR code?</h2>
            <p className="mt-2 text-sm text-muted">
              This will create a new QR image for this restaurant. The old printed QR codes will still work — only
              the image file changes.
            </p>
            <div className="mt-4 flex gap-2">
              <button className="btn btn-secondary btn-sm flex-1" type="button" onClick={() => setConfirmRegen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm flex-[2]"
                type="button"
                onClick={() => void confirmRegenerate()}
              >
                Yes, regenerate
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <p className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 animate-pop-in rounded-full border-2 border-line bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-pop-sm">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
