"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { PrivateFeedbackModal } from "@/components/feedback/PrivateFeedbackModal";
import { Done } from "@/components/steps/Done";
import { Draft } from "@/components/steps/Draft";
import { Meal } from "@/components/steps/Meal";
import { Notes } from "@/components/steps/Notes";
import { RestaurantBanner } from "@/components/ui/RestaurantBanner";
import { ApiError, completeSession, createDraft, startSession } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { getDeviceId } from "@/lib/device";
import { googleReviewUrl } from "@/lib/google";
import { outputLang } from "@/lib/lang";
import { ratingsFromSentiment, type Sentiment } from "@/lib/sentiment";
import type { FlowStep, RestaurantPublic, Tone as ToneId } from "@/lib/types";

type DinerFlowProps = {
  restaurant: RestaurantPublic;
  table?: string;
};

const slide = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function DinerFlow({ restaurant, table }: DinerFlowProps) {
  const [step, setStep] = useState<FlowStep>("meal");
  const [items, setItems] = useState<string[]>([]);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [rawText, setRawText] = useState("");
  const [tone, setTone] = useState<ToneId>("casual");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const draftMetaRef = useRef<{ provider: string; grounding_ok: boolean } | null>(null);
  const lang = outputLang(restaurant.default_lang);

  const brand = restaurant.brand_color || "#C45C26";

  useEffect(() => {
    let cancelled = false;
    startSession({ slug: restaurant.slug, deviceId: getDeviceId(), table })
      .then((session) => {
        if (!cancelled) {
          setSessionId(session.id);
          setToken(session.token);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDraftError("Could not start. You can still tap through.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [restaurant.slug, table]);

  const toggleItem = useCallback((name: string) => {
    setItems((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }, []);

  const requestDraft = useCallback(
    async (mode: "write" | "retry") => {
      if (sessionId === null || token === null || !sentiment) {
        setDraftError("Wait a moment and try again.");
        return;
      }
      setDraftLoading(true);
      setRetrying(mode === "retry");
      setDraftError(null);
      try {
        const result = await createDraft(sessionId, token, {
          items,
          ratings: ratingsFromSentiment(sentiment),
          tags: [],
          raw_text: rawText,
          tone,
          lang,
        });
        setDraft(result.text);
        draftMetaRef.current = { provider: result.provider, grounding_ok: result.grounding_ok };
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Could not write your review.";
        setDraftError(message);
      } finally {
        setDraftLoading(false);
        setRetrying(false);
      }
    },
    [items, lang, rawText, sentiment, sessionId, token, tone],
  );

  useEffect(() => {
    if (step !== "review" || sessionId === null || token === null || !sentiment) {
      return;
    }
    void requestDraft("write");
    // Fetch once when the diner reaches the review screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, sessionId, token]);

  const logComplete = async (copied: boolean, clickedGoogle: boolean) => {
    if (sessionId === null || token === null || !draft.trim()) {
      return;
    }
    try {
      await completeSession(sessionId, token, {
        final_text: draft.trim(),
        copied,
        clicked_google: clickedGoogle,
      });
    } catch {
      /* still hand off to Google */
    }
  };

  const openGoogle = () => {
    const url = googleReviewUrl(restaurant.google_place_id);
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.href = url;
    }
  };

  const copyAndOpen = async () => {
    setCopying(true);
    const copied = await copyText(draft);
    await logComplete(copied, true);
    openGoogle();
    setCopying(false);
    setStep("thanks");
  };

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-6 pt-5"
      style={{ ["--brand" as string]: brand, background: `color-mix(in srgb, ${brand} 10%, white)` }}
    >
      {step !== "thanks" ? (
        <RestaurantBanner name={restaurant.name} logoUrl={restaurant.logo_url} table={table} />
      ) : null}
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="flex min-h-0 flex-1 flex-col"
            initial={slide.initial}
            animate={slide.animate}
            exit={slide.exit}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {step === "meal" ? (
              <Meal
                dishes={restaurant.menu}
                selected={items}
                sentiment={sentiment}
                onToggleDish={toggleItem}
                onSentiment={setSentiment}
                onNext={() => setStep("notes")}
              />
            ) : null}
            {step === "notes" ? (
              <Notes
                value={rawText}
                tone={tone}
                onChange={setRawText}
                onTone={setTone}
                onNext={() => setStep("review")}
              />
            ) : null}
            {step === "review" ? (
              <Draft
                text={draft}
                loading={draftLoading}
                retrying={retrying}
                error={draftError}
                copying={copying}
                onChange={setDraft}
                onTryAgain={() => void requestDraft("retry")}
                onCopyAndOpen={() => void copyAndOpen()}
                onPrivateFeedback={() => setFeedbackOpen(true)}
              />
            ) : null}
            {step === "thanks" ? (
              <Done restaurantName={restaurant.name} dishes={items} sentiment={sentiment} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
      {feedbackOpen ? (
        <PrivateFeedbackModal
          slug={restaurant.slug}
          sessionId={sessionId}
          token={token}
          onClose={() => setFeedbackOpen(false)}
          onSent={() => {
            setFeedbackOpen(false);
            setStep("thanks");
          }}
        />
      ) : null}
    </div>
  );
}
