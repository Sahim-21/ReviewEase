"use client";

// Rendered outside the root layout, so it carries its own inline styles.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#fbeee6",
          color: "#241e1c",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main
          style={{
            margin: "0 auto",
            maxWidth: 480,
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div
            aria-hidden
            style={{
              fontSize: 56,
              width: 112,
              height: 112,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              border: "2px solid #7a3d1f",
              borderRadius: 28,
              boxShadow: "0 6px 0 0 #7a3d1f",
              transform: "rotate(-3deg)",
            }}
          >
            🍳
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>Something went wrong</h1>
          <p style={{ margin: 0, color: "#6b5a53" }}>The app hit an unexpected error. Try again.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 8,
              minHeight: 56,
              padding: "0 28px",
              border: "2px solid #7a3d1f",
              borderRadius: 9999,
              background: "#c45c26",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              boxShadow: "0 6px 0 0 #7a3d1f",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
