"use client";

import { tapFeedback } from "@/lib/haptic";
import type { Aspect, TagPublic } from "@/lib/types";

const ASPECT_ORDER: Aspect[] = ["food", "service", "ambience", "value"];

type TagsProps = {
  tags: TagPublic[];
  selected: string[];
  onToggle: (label: string) => void;
  onNext: () => void;
  onSkip: () => void;
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

export function Tags({ tags, selected, onToggle, onNext, onSkip }: TagsProps) {
  const grouped = groupByAspect(tags);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-xl font-semibold tracking-tight">What stood out?</h2>
      <p className="mt-1 text-sm text-neutral-600">Pick anything that applies</p>
      <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pb-2">
        {grouped.map(([aspect, aspectTags]: [string, TagPublic[]]) => (
          <section key={aspect}>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{aspect}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {aspectTags.map((tag: TagPublic) => {
                const active = selected.includes(tag.label);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      onToggle(tag.label);
                    }}
                    className={`min-h-[44px] rounded-full border px-4 py-2 text-sm ${
                      active
                        ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                        : "border-black/15 bg-white text-neutral-800"
                    }`}
                    aria-pressed={active}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onNext();
        }}
        className="mt-4 w-full rounded-full bg-[var(--brand)] py-3 text-sm font-semibold text-white"
      >
        Next →
      </button>
      <p className="mt-2 text-center text-xs text-neutral-500">
        You can skip this{" "}
        <button
          type="button"
          className="underline"
          onClick={() => {
            tapFeedback();
            onSkip();
          }}
        >
          skip
        </button>
      </p>
    </div>
  );
}
