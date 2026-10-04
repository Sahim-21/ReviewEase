type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function speechSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as SpeechWindow;
  return typeof w.SpeechRecognition === "function" || typeof w.webkitSpeechRecognition === "function";
}

export function createRecognizer(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as SpeechWindow;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) {
    return null;
  }
  return new Ctor();
}

export function transcriptFromEvent(event: SpeechRecognitionEventLike): { finalText: string; interimText: string } {
  let finalText = "";
  let interimText = "";
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results[i];
    const piece = result[0]?.transcript ?? "";
    if (result.isFinal) {
      finalText += piece;
    } else {
      interimText += piece;
    }
  }
  return { finalText: finalText.trim(), interimText: interimText.trim() };
}
