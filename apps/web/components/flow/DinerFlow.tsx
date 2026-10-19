"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { PrivateFeedbackModal } from "@/components/feedback/PrivateFeedbackModal";
import { Done } from "@/components/steps/Done";
import { Draft } from "@/components/steps/Draft";
import { Meal } from "@/components/steps/Meal";
import { Notes } from "@/components/steps/Notes";
import { Stars } from "@/components/steps/Stars";
import { Tags } from "@/components/steps/Tags";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RestaurantBanner } from "@/components/ui/RestaurantBanner";
import { ApiError, completeSession, createDraft, startSession } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { getDeviceId } from "@/lib/device";
import { googleReviewUrl } from "@/lib/google";
import { brandVars } from "@/lib/color";
import { outputLang, speechLocale } from "@/lib/lang";
import { ratingsFromStars } from "@/lib/stars";
import type { Aspect, FlowStep, Ratings, RestaurantPublic, Tone as ToneId } from "@/lib/types";

type DinerFlowProps = {
  restaurant: RestaurantPublic;
  table?: string;
};

const STEP_ORDER: FlowStep[] = ["meal", "stars", "tags", "notes", "review", "thanks"];
const PROGRESS_LABELS = ["Meal", "Stars", "Tags", "Notes"];
const PROGRESS_STEP: Partial<Record<FlowStep, number>> = { meal: 1, stars: 2, tags: 3, notes: 4 };

export function DinerFlow({ restaurant, table }: DinerFlowProps) {
  const [step, setStep] = useState<FlowStep>("meal");
  const [items, setItems] = useState<string[]>([]);
  const [stars, setStars] = useState<number | null>(null);
  const [details, setDetails] = useState<Ratings>({});
  const [tags, setTags] = useState<string[]>([]);
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
  const prevStepRef = useRef<FlowStep>("meal");
  const reduceMotion = useReducedMotion();
  const lang = outputLang(restaurant.default_lang);

  // Slide forward from the right, backward from the left.
  const direction = STEP_ORDER.indexOf(step) >= STEP_ORDER.indexOf(prevStepRef.current) ? 1 : -1;
  useEffect(() => {
    prevStepRef.current = step;
  }, [step]);

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

  const toggleTag = useCallback((label: string) => {
    setTags((current) =>
      current.includes(label) ? current.filter((item: string) => item !== label) : [...current, label],
    );
  }, []);

  const goAfterMeal = (custom: string) => {
    const extra = custom.trim().slice(0, 60);
    const menuNames = new Set(restaurant.menu.map((item: { name: string }) => item.name));
    setItems((current: string[]) => {
      const selectedMenu = current.filter((name: string) => menuNames.has(name));
      if (!extra || selectedMenu.includes(extra)) {
        return selectedMenu;
      }
      return [...selectedMenu, extra];
    });
    setStep("stars");
  };

  const afterStars = () => setStep(restaurant.tags.length ? "tags" : "notes");
  const backFromNotes = () => setStep(restaurant.tags.length ? "tags" : "stars");

  const setDetail = useCallback((aspect: Aspect, value: number) => {
    setDetails((current) => ({ ...current, [aspect]: value }));
  }, []);

  const requestDraft = useCallback(
    async (mode: "write" | "retry") => {
      if (sessionId === null || token === null || stars === null) {
        setDraftError("Wait a moment and try again.");
        return;
      }
      setDraftLoading(true);
      setRetrying(mode === "retry");
      setDraftError(null);
      try {
        const result = await createDraft(sessionId, token, {
          items,
          ratings: ratingsFromStars(stars, details),
          overall_rating: stars,
          tags,
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
    [details, items, lang, rawText, stars, sessionId, tags, token, tone],
  );

  useEffect(() => {
    if (step !== "review" || sessionId === null || token === null || stars === null) {
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

  const progress = PROGRESS_STEP[step];
  const slideX = reduceMotion ? 0 : 36;

  return (
    <div
      className="relative min-h-dvh overflow-x-clip bg-paper"
      style={brandVars(restaurant.brand_color)}
    >
      <span className="blob -left-20 top-40 h-56 w-56" aria-hidden />
      <span className="blob -right-16 top-[28rem] h-44 w-44" aria-hidden />
      <div className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col px-4 pb-4 pt-5">
        {step !== "thanks" ? (
          <>
            <RestaurantBanner
              name={restaurant.name}
              logoUrl={restaurant.logo_url}
              table={table}
              stepLabel={progress ? `Step ${progress} of ${PROGRESS_LABELS.length}` : undefined}
            />
            {progress ? (
              <div className="mt-4">
                <ProgressBar step={progress} labels={PROGRESS_LABELS} />
              </div>
            ) : null}
          </>
        ) : null}
        {draftError && step === "meal" ? (
          <p role="alert" className="mt-3 rounded-2xl border-2 border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {draftError}
          </p>
        ) : null}
        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0, x: slideX * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -slideX * direction }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {step === "meal" ? (
                <Meal
                  dishes={restaurant.menu}
                  selected={items}
                  custom={items.find((name: string) => !restaurant.menu.some((item: { name: string }) => item.name === name)) ?? ""}
                  onToggleDish={toggleItem}
                  onNext={goAfterMeal}
                />
              ) : null}
              {step === "stars" ? (
                <Stars
                  stars={stars}
                  details={details}
                  onStars={setStars}
                  onDetail={setDetail}
                  onBack={() => setStep("meal")}
                  onNext={afterStars}
                />
              ) : null}
              {step === "tags" ? (
                <Tags
                  tags={restaurant.tags}
                  selected={tags}
                  onToggle={toggleTag}
                  onBack={() => setStep("stars")}
                  onNext={() => setStep("notes")}
                  onSkip={() => {
                    setTags([]);
                    setStep("notes");
                  }}
                  onClear={() => setTags([])}
                />
              ) : null}
              {step === "notes" ? (
                <Notes
                  value={rawText}
                  tone={tone}
                  speechLocale={speechLocale(restaurant.default_lang)}
                  onChange={setRawText}
                  onTone={setTone}
                  onBack={backFromNotes}
                  onNext={() => setStep("review")}
                />
              ) : null}
              {step === "review" ? (
                <Draft
                  text={draft}
                  stars={stars}
                  dishes={items}
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
                <Done restaurantName={restaurant.name} dishes={items} stars={stars} />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {feedbackOpen ? (
        <PrivateFeedbackModal
          slug={restaurant.slug}
          sessionId={sessionId}
          token={token}
          rating={stars}
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
