"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
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
        className="mt-3 flex items-center justify-center gap-2 rounded-full border-2 border-dashed border-hairline py-3 text-sm text-muted"
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
    <div className="sticker-flat mt-3 p-3.5">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Tap to speak your notes"}
          onClick={() => {
            tapFeedback();
            if (listening) {
              stop();
            } else {
              start();
            }
          }}
          className="relative flex h-14 w-14 shrink-0 items-center justify-center"
        >
          {listening ? (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-brand/25" />
              <span className="absolute -inset-1 animate-pulse-ring rounded-full bg-brand/15" />
            </>
          ) : null}
          <span
            className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-line shadow-pop-sm transition-transform active:translate-y-1 ${
              listening ? "bg-brand text-on-brand" : "bg-tint-strong text-ink"
            }`}
          >
            <Icon name="mic" size={26} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          {listening ? (
            <>
              <p className="font-display text-base font-bold">Listening… tap to stop</p>
              <div className="mt-1.5 flex h-4 items-end gap-1" aria-hidden>
                {[0.6, 1, 0.45, 0.9, 0.35, 0.75].map((h, i) => (
                  <span
                    key={i}
                    className="w-1 origin-bottom rounded-full bg-brand"
                    style={{ height: `${h * 100}%`, animation: "wave 0.8s ease-in-out infinite", animationDelay: `${i * 90}ms` }}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-base font-bold">Tap to speak</p>
              <p className="text-sm text-muted">Dictate notes in any local tongue</p>
            </>
          )}
        </div>
      </div>
      {hint ? <p className="mt-2 text-center text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
