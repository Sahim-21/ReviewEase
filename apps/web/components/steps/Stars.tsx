"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { StarRating } from "@/components/ui/StarRating";
import { StepFooter } from "@/components/ui/StepFooter";
import { tapFeedback } from "@/lib/haptic";
import { ASPECTS, starMood } from "@/lib/stars";
import type { Aspect, Ratings } from "@/lib/types";

type StarsProps = {
  stars: number | null;
  details: Ratings;
  onStars: (value: number) => void;
  onDetail: (aspect: Aspect, value: number) => void;
  onBack: () => void;
  onNext: () => void;
};

export function Stars({ stars, details, onStars, onDetail, onBack, onNext }: StarsProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const value = stars ?? 0;
  const mood = starMood(stars);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="mb-4 text-center">
        <h2 className="font-display text-[2.1rem] font-extrabold leading-tight tracking-tight">How was it?</h2>
        <p className="mt-1 text-base text-muted">Tap the stars. 5 is amazing.</p>
      </section>

      <div className="sticker relative flex flex-col items-center gap-4 overflow-hidden px-4 py-6">
        <span className="blob -right-10 -top-10 h-40 w-40" aria-hidden />
        <span className="blob -bottom-10 -left-10 h-32 w-32" aria-hidden />

        <motion.div
          key={value}
          className="relative text-7xl leading-none"
          initial={reduce ? false : { scale: 0.5, rotate: -14 }}
          animate={reduce ? undefined : { scale: 1, rotate: [0, -8, 8, -4, 0] }}
          transition={{
            scale: { type: "spring", stiffness: 300, damping: 12 },
            rotate: { duration: 0.6, ease: "easeInOut" },
          }}
          aria-hidden
        >
          {mood.emoji}
        </motion.div>

        <p
          className={`relative rounded-full border-2 px-5 py-2 font-display text-lg font-bold transition-colors ${
            stars ? "border-line bg-brand text-on-brand shadow-pop-sm" : "border-hairline bg-white text-muted"
          }`}
          aria-live="polite"
        >
          {mood.caption}
        </p>

        <div className="relative">
          <StarRating value={value} onChange={onStars} label="Overall rating" />
        </div>
        <p className="relative text-sm font-medium text-muted">Tap any star to change your rating anytime.</p>
      </div>

      <div className="sticker-flat mt-5 p-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="star-details"
          onClick={() => {
            tapFeedback();
            setOpen((current) => !current);
          }}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-line bg-pine text-lg text-white">
              ✨
            </span>
            <span>
              <span className="block font-display text-lg font-bold leading-tight">Rate the details</span>
              <span className="block text-sm text-muted">Optional · 4 areas of dining</span>
            </span>
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-tint"
          >
            <Icon name="chevronDown" size={22} />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id="star-details"
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-3 pt-4">
                <p className="flex items-start gap-2 rounded-2xl bg-tint p-3 text-sm text-muted">
                  <Icon name="info" size={18} className="mt-0.5 shrink-0 text-brand" />
                  <span>
                    {stars
                      ? `If you skip one, your overall ${stars} star${stars > 1 ? "s are" : " is"} used for it.`
                      : "Rate overall first — anything you skip here follows it."}
                  </span>
                </p>
                {ASPECTS.map(({ id, label, emoji }) => (
                  <div
                    key={id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-hairline bg-white p-3"
                  >
                    <span className="flex items-center gap-2 font-display text-base font-bold">
                      <span className="text-2xl" aria-hidden>
                        {emoji}
                      </span>
                      {label}
                    </span>
                    <StarRating
                      size="sm"
                      label={`${label} rating`}
                      value={details[id] ?? 0}
                      onChange={(next) => onDetail(id, next)}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="h-6" />
      <StepFooter onBack={onBack} onNext={onNext} nextDisabled={stars === null} />
    </div>
  );
}
