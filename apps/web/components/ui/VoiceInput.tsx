"use client";

import { useEffect, useRef, useState } from "react";

import { tapFeedback } from "@/lib/haptic";
import { createRecognizer, speechSupported, transcriptFromEvent } from "@/lib/speech";

type VoiceInputProps = {
  locale: string;
  onTranscript: (text: string) => void;
};

export function VoiceInput({ locale, onTranscript }: VoiceInputProps) {
  const [supported] = useState(() => speechSupported());
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const recRef = useRef<ReturnType<typeof createRecognizer>>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title="Voice input is not supported in this browser"
        className="mt-3 flex items-center justify-center gap-2 rounded-full border border-dashed border-black/20 py-3 text-sm text-neutral-500"
      >
        <span aria-hidden>🎤</span>
        Voice isn’t available here — type your notes instead
      </button>
    );
  }

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  const start = () => {
    recRef.current?.abort();
    const rec = createRecognizer();
    if (!rec) {
      setHint("Voice isn’t available here — type your notes instead");
      return;
    }
    rec.lang = locale;
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (event) => {
      const { finalText } = transcriptFromEvent(event);
      if (finalText) {
        onTranscriptRef.current(finalText);
      }
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed") {
        setHint("Microphone permission was denied. Type your notes instead.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setHint("Couldn’t hear that. Try again, or type your notes.");
      }
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      setHint(null);
    } catch {
      setHint("Couldn’t start the microphone. Type your notes instead.");
      setListening(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-pressed={listening}
        onClick={() => {
          tapFeedback();
          if (listening) {
            stop();
          } else {
            start();
          }
        }}
        className={`flex w-full items-center justify-center gap-2 rounded-full border py-3 text-sm font-medium ${
          listening
            ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_14%,white)]"
            : "border-black/15 bg-white"
        }`}
      >
        <span aria-hidden>🎤</span>
        {listening ? "Listening… tap to stop" : "Speak notes"}
      </button>
      {hint ? <p className="mt-2 text-center text-xs text-neutral-600">{hint}</p> : null}
    </div>
  );
}
