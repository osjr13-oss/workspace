"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

/**
 * Reads a product barcode with the camera. iPhone browsers have no built-in
 * barcode reader, so a WebAssembly one is loaded on demand from Selrano's own
 * site (public/zxing), never from a third-party CDN. Typing the number always works too.
 */
export function BarcodeScanner({ onCode, busy }: { onCode: (code: string) => void; busy: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [typed, setTyped] = useState("");
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let cancelled = false;

    (async () => {
      try {
        const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
        prepareZXingModule({
          overrides: {
            locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path)
          }
        });
        const detector = new BarcodeDetector({ formats: [...FORMATS] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setMessage("Point the camera at the barcode.");
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const [found] = await detector.detect(videoRef.current);
            if (found?.rawValue && /^\d{8,14}$/.test(found.rawValue)) {
              setScanning(false);
              onCodeRef.current(found.rawValue);
              return;
            }
          } catch {
            // A frame that cannot be read is normal; try the next one.
          }
          timer = window.setTimeout(tick, 250);
        };
        void tick();
      } catch (error) {
        const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
        setMessage(denied ? "Camera access is off. Allow it in your browser settings, or type the number below." : "The camera is not available here. Type the number below.");
        setScanning(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning]);

  return (
    <div className="space-y-3">
      {scanning ? (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-white/70" />
        </div>
      ) : (
        <button type="button" className="btn-secondary w-full" onClick={() => { setMessage(""); setScanning(true); }} disabled={busy}>
          <ScanLine size={18} />
          Scan with camera
        </button>
      )}
      {scanning ? (
        <button type="button" className="pill-button" onClick={() => setScanning(false)}>Stop camera</button>
      ) : null}
      {message ? <p className="text-sm text-[var(--muted-strong)]">{message}</p> : null}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const code = typed.replace(/\D/g, "");
          if (code.length >= 8) onCode(code);
        }}
      >
        <input
          aria-label="Barcode number"
          inputMode="numeric"
          className="input-premium min-w-0 flex-1 px-5"
          placeholder="Or type the barcode number"
          value={typed}
          onChange={(event) => setTyped(event.target.value.replace(/\D/g, "").slice(0, 14))}
        />
        <button type="submit" className="btn-primary" disabled={busy || typed.length < 8}>Look up</button>
      </form>
    </div>
  );
}
