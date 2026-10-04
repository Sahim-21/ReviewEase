"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PrivateFeedbackModal } from "@/components/feedback/PrivateFeedbackModal";
import { Done } from "@/components/steps/Done";
import { Draft } from "@/components/steps/Draft";
import { Dishes } from "@/components/steps/Dishes";
import { FreeText } from "@/components/steps/FreeText";
import { Ratings } from "@/components/steps/Ratings";
import { Tags } from "@/components/steps/Tags";
import { Tone } from "@/components/steps/Tone";
import { Welcome } from "@/components/steps/Welcome";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RestaurantBanner } from "@/components/ui/RestaurantBanner";
import { ApiError, completeSession, createDraft, startSession } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { getDeviceId } from "@/lib/device";
import { googleReviewUrl, SESSION_DRAFT_LIMIT } from "@/lib/google";
import { outputLang, speechLocale } from "@/lib/lang";
import type { Aspect, FlowStep, OutputLang, Ratings as RatingsMap, RestaurantPublic, Tone as ToneId } from "@/lib/types";

const STEPS: FlowStep[] = ["welcome", "dishes", "ratings", "tags", "freetext", "tone", "draft", "done"];
const PROGRESS_STEPS: FlowStep[] = STEPS.filter((item) => item !== "welcome");

type DinerFlowProps = {
  restaurant: RestaurantPublic;
  table?: string;
};

const slide = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export function DinerFlow({ restaurant, table }: DinerFlowProps) {
  const [step, setStep] = useState<FlowStep>("welcome");
  const [items, setItems] = useState<string[]>([]);
  const [ratings, setRatings] = useState<RatingsMap>({});
  const [tags, setTags] = useState<string[]>([]);
  const [rawText, setRawText] = useState("");
  const [tone, setTone] = useState<ToneId>("casual");
  const [lang, setLang] = useState<OutputLang>(() => outputLang(restaurant.default_lang));
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(SESSION_DRAFT_LIMIT);
  const [copying, setCopying] = useState(false);
  const [showGoogleFallback, setShowGoogleFallback] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const progressIndex = PROGRESS_STEPS.indexOf(step);
  const brand = restaurant.brand_color || "#C45C26";
  const micLocale = useMemo(() => speechLocale(restaurant.default_lang), [restaurant.default_lang]);

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
          setDraftError("Could not start a session. You can still tap through.");
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

  const addCustomDish = useCallback((name: string) => {
    const cleaned = name.trim();
    if (!cleaned) {
      return;
    }
    setItems((current) => {
      const match = current.find((item) => item.toLowerCase() === cleaned.toLowerCase());
      if (match) {
        return current;
      }
      return [...current, cleaned];
    });
  }, []);

  const addCustomService = useCallback((label: string) => {
    const cleaned = label.trim();
    if (!cleaned) {
      return;
    }
    setTags((current) => {
      const match = current.find((item) => item.toLowerCase() === cleaned.toLowerCase());
      if (match) {
        return current;
      }
      return [...current, cleaned];
    });
  }, []);

  const toggleTag = useCallback((label: string) => {
    setTags((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  }, []);

  const setRating = useCallback((aspect: Aspect, value: number) => {
    setRatings((current) => ({ ...current, [aspect]: value }));
  }, []);

  const go = (next: FlowStep) => setStep(next);

  const requestDraft = useCallback(async () => {
    if (sessionId === null || token === null) {
      setDraftError("Session is not ready yet. Wait a moment and try again.");
      return;
    }
    if (remaining <= 0) {
      setDraftError("No regenerations left for this visit.");
      return;
    }
    setDraftLoading(true);
    setDraftError(null);
    try {
      const filled = Object.fromEntries(
        Object.entries(ratings).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
      );
      const result = await createDraft(sessionId, token, {
        items,
        ratings: filled,
        tags,
        raw_text: rawText,
        tone,
        lang,
      });
      setDraft(result.text);
      setRemaining((count) => Math.max(0, count - 1));
    } catch (err) {
      if (err instanceof ApiError && (err.code === "RATE_LIMIT_SESSION" || err.code === "RATE_LIMIT_DEVICE")) {
        setRemaining(0);
        setDraftError(err.message);
      } else {
        const message = err instanceof ApiError ? err.message : "Could not phrase a draft.";
        setDraftError(message);
      }
    } finally {
      setDraftLoading(false);
    }
  }, [items, lang, ratings, rawText, remaining, sessionId, tags, token, tone]);

  useEffect(() => {
    if (step !== "draft" || sessionId === null || token === null) {
      return;
    }
    void requestDraft();
    // Fetch when the diner reaches this step (and the session exists).
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
    setShowGoogleFallback(true);
    const copied = await copyText(draft);
    await logComplete(copied, true);
    openGoogle();
    setCopying(false);
  };

  const openGoogleFallback = async () => {
    await logComplete(true, true);
    openGoogle();
  };

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-6 pt-5"
      style={{ ["--brand" as string]: brand, background: `color-mix(in srgb, ${brand} 10%, white)` }}
    >
      <RestaurantBanner name={restaurant.name} logoUrl={restaurant.logo_url} table={table} />
      {progressIndex >= 0 ? (
        <div className="mt-3">
          <ProgressBar step={progressIndex + 1} total={PROGRESS_STEPS.length} />
        </div>
      ) : null}
      <p className="mt-4 text-[11px] text-neutral-500">
        No login. We only use what you tap or type.{" "}
        <button type="button" onClick={() => setFeedbackOpen(true)} className="underline decoration-dotted">
          Send private feedback anytime
        </button>
      </p>
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
            {step === "welcome" ? (
              <Welcome restaurantName={restaurant.name} onNext={() => go("dishes")} />
            ) : null}
            {step === "dishes" ? (
              <Dishes
                items={restaurant.menu}
                selected={items}
                customTags={tags.filter((label) => !restaurant.tags.some((tag) => tag.label === label))}
                onToggle={toggleItem}
                onAddCustomDish={addCustomDish}
                onAddCustomService={addCustomService}
                onRemoveCustomService={toggleTag}
                onBack={() => go("welcome")}
                onNext={() => go("ratings")}
              />
            ) : null}
            {step === "ratings" ? (
              <Ratings
                ratings={ratings}
                onChange={setRating}
                onBack={() => go("dishes")}
                onNext={() => go("tags")}
              />
            ) : null}
            {step === "tags" ? (
              <Tags
                tags={restaurant.tags}
                selected={tags}
                onToggle={toggleTag}
                onBack={() => go("ratings")}
                onNext={() => go("freetext")}
              />
            ) : null}
            {step === "freetext" ? (
              <FreeText
                value={rawText}
                onChange={setRawText}
                speechLocale={micLocale}
                onBack={() => go("tags")}
                onNext={() => go("tone")}
              />
            ) : null}
            {step === "tone" ? (
              <Tone
                value={tone}
                onChange={setTone}
                lang={lang}
                onLangChange={setLang}
                onBack={() => go("freetext")}
                onNext={() => go("draft")}
              />
            ) : null}
            {step === "draft" ? (
              <Draft
                text={draft}
                loading={draftLoading}
                error={draftError}
                remaining={remaining}
                copying={copying}
                showGoogleFallback={showGoogleFallback}
                onChange={setDraft}
                onRegenerate={() => void requestDraft()}
                onCopyAndOpen={() => void copyAndOpen()}
                onOpenGoogle={() => void openGoogleFallback()}
                onPrivateFeedback={() => setFeedbackOpen(true)}
                onJourney={() => go("done")}
                onBack={() => go("tone")}
              />
            ) : null}
            {step === "done" ? (
              <Done
                restaurantName={restaurant.name}
                dishes={items}
                ratings={ratings}
                onPrivateFeedback={() => setFeedbackOpen(true)}
              />
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
        />
      ) : null}
    </div>
  );
}
