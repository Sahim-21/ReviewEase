"use client";

import { motion } from "framer-motion";

import { StepFooter } from "@/components/ui/StepFooter";
import { tapFeedback } from "@/lib/haptic";
import type { Aspect, TagPublic } from "@/lib/types";

const ASPECT_ORDER: Aspect[] = ["food", "service", "ambience", "value"];

const ASPECT_META: Record<string, { title: string; emoji: string; tilt: string }> = {
  food: { title: "Food", emoji: "🍽️", tilt: "-rotate-[0.5deg]" },
  service: { title: "Service", emoji: "🙋", tilt: "rotate-[0.7deg]" },
  ambience: { title: "Ambience", emoji: "🪔", tilt: "-rotate-[0.6deg]" },
  value: { title: "Value", emoji: "💸", tilt: "rotate-[0.4deg]" },
};

type TagsProps = {
  tags: TagPublic[];
  selected: string[];
  onToggle: (label: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onClear: () => void;
};

function groupByAspect(tags: TagPublic[]): [string, TagPublic[]][] {
  const groups = new Map<string, TagPublic[]>();
  for (const tag of tags) {
    const list = groups.get(tag.aspect) ?? [];
    list.push(tag);
    groups.set(tag.aspect, list);
  }
  const ordered: [string, TagPublic[]][] = [];
  for (const aspect of ASPECT_ORDER) {
    const list = groups.get(aspect);
    if (list && list.length > 0) {
      ordered.push([aspect, list]);
      groups.delete(aspect);
    }
  }
  groups.forEach((list: TagPublic[], aspect: string) => {
    if (list.length > 0) {
      ordered.push([aspect, list]);
    }
  });
  return ordered;
}

function aspectMeta(aspect: string) {
  return (
    ASPECT_META[aspect] ?? {
      title: aspect.charAt(0).toUpperCase() + aspect.slice(1),
      emoji: "🏷️",
      tilt: "",
    }
  );
}

export function Tags({ tags, selected, onToggle, onBack, onNext, onSkip, onClear }: TagsProps) {
  const grouped = groupByAspect(tags);
  const count = selected.length;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="mb-4">
        <h2 className="font-display text-[1.9rem] font-extrabold leading-tight tracking-tight">
          Pick what stood out
        </h2>
        <p className="mt-1 text-base text-muted">Optional – tap any that fit.</p>
      </section>

      <div className="flex flex-col gap-4">
        {grouped.map(([aspect, aspectTags]: [string, TagPublic[]], groupIndex) => {
          const meta = aspectMeta(aspect);
          return (
            <motion.section
              key={aspect}
              className={`sticker p-4 ${meta.tilt}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24, delay: groupIndex * 0.06 }}
            >
              <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-tint text-base" aria-hidden>
                  {meta.emoji}
                </span>
                {meta.title}
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {aspectTags.map((tag: TagPublic) => {
                  const active = selected.includes(tag.label);
                  return (
                    <motion.button
                      key={tag.id}
                      type="button"
                      className="chip"
                      aria-pressed={active}
                      whileTap={{ scale: 0.94 }}
                      animate={{ scale: active ? [1, 1.1, 1.03] : 1 }}
                      transition={{ duration: 0.3 }}
                      onClick={() => {
                        tapFeedback();
                        onToggle(tag.label);
                      }}
                    >
                      {tag.label}
                    </motion.button>
                  );
                })}
              </div>
            </motion.section>
          );
        })}
      </div>

      <div className="sticker-flat mt-5 flex items-center justify-between gap-3 p-3.5">
        <p className="font-display text-sm font-bold" aria-live="polite">
          {count === 0 ? "No tags selected" : count === 1 ? "1 tag selected" : `${count} tags selected`}
        </p>
        <button
          type="button"
          className="rounded-full bg-tint px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          disabled={count === 0}
          onClick={() => {
            tapFeedback();
            onClear();
          }}
        >
          Reset
        </button>
      </div>

      <div className="h-6" />
      <StepFooter
        onBack={onBack}
        onNext={onNext}
        below={
          <button
            type="button"
            className="link-quiet"
            onClick={() => {
              tapFeedback();
              onSkip();
            }}
          >
            Skip this step →
          </button>
        }
      />
    </div>
  );
}
