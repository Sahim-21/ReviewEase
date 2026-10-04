"use client";

import { StepHeader } from "@/components/ui/StepHeader";
import { StepNav } from "@/components/ui/StepNav";
import { TagChip } from "@/components/ui/TagChip";
import type { TagPublic } from "@/lib/types";

type TagsProps = {
  tags: TagPublic[];
  selected: string[];
  onToggle: (label: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export function Tags({ tags, selected, onToggle, onBack, onNext }: TagsProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StepHeader title="Any quick tags?" subtitle="Optional. Pick words that match this visit." />
      <div className="mt-4 flex flex-wrap gap-2 overflow-y-auto pb-2">
        {tags.map((tag) => (
          <TagChip
            key={tag.id}
            label={tag.label}
            selected={selected.includes(tag.label)}
            onToggle={onToggle}
          />
        ))}
        {selected
          .filter((label) => !tags.some((tag) => tag.label === label))
          .map((label) => (
            <TagChip key={label} label={label} selected onToggle={onToggle} />
          ))}
      </div>
      <StepNav onBack={onBack} onNext={onNext} nextLabel={selected.length ? "Next" : "Skip"} />
    </div>
  );
}
