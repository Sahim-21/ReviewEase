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
        <p className="mt-3 text-sm text-neutral-500">Loading…</p>
      ) : qrError || !qrUrl ? (
        <p className="mt-3 text-sm text-red-700">{qrError ?? "Could not load QR code. Refresh to try again."}</p>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`${restaurantName} QR`} className={`mt-4 bg-white object-contain ${imageClassName}`} src={qrUrl} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-full bg-foreground px-4 py-2 text-sm text-background"
              type="button"
              onClick={downloadQr}
            >
              Download QR
            </button>
            <button className="rounded-full border px-4 py-2 text-sm" type="button" onClick={() => setConfirmRegen(true)}>
              Regenerate QR
            </button>
          </div>
        </>
      )}

      {confirmRegen ? (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div role="dialog" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Regenerate QR code?</h2>
            <p className="mt-2 text-sm text-neutral-600">
              This will create a new QR image for this restaurant. The old printed QR codes will still work — only
              the image file changes.
            </p>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-full border py-2 text-sm" type="button" onClick={() => setConfirmRegen(false)}>
                Cancel
              </button>
              <button
                className="flex-[2] rounded-full bg-foreground py-2 text-sm text-background"
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
        <p className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
