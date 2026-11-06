"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Locale, locales, t } from "@/lib/i18n";

type Step = "welcome" | "consent" | "camera" | "saree" | "processing" | "result" | "ended";

type Saree = {
  id: string;
  name: string;
  fabric: string | null;
  occasion: string | null;
  priceInr: number | null;
  imageUrl: string | null;
};

type StorePayload = {
  store: {
    id: string;
    name: string;
    slug: string;
    settings: {
      welcomeMessage: string | null;
      privacyNotice: string | null;
      primaryColor: string;
      accentColor: string;
      defaultLocale: string;
    } | null;
  };
  sarees: Saree[];
  creditsAvailable: number;
};

const INACTIVITY_MS = 90_000;

export function KioskApp({ storeSlug }: { storeSlug: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [step, setStep] = useState<Step>("welcome");
  const [data, setData] = useState<StorePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [consentId, setConsentId] = useState<string | null>(null);
  const [personPath, setPersonPath] = useState<string | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [sareeId, setSareeId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [result, setResult] = useState<{
    url: string | null;
    isDemo: boolean;
    label: string | null;
    personUrl: string;
    sareeImageUrl: string;
    sareeName?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef<"user" | "environment">("user");
  const lastActive = useRef(Date.now());

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  const resetSession = useCallback(() => {
    stopCamera();
    setStep("welcome");
    setSessionId(null);
    setConsentId(null);
    setPersonPath(null);
    setPersonPreview(null);
    setSareeId(null);
    setJobId(null);
    setJobStatus(null);
    setResult(null);
    setError(null);
  }, [stopCamera]);

  useEffect(() => {
    fetch(`/api/kiosk/${storeSlug}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load store");
        setData(j);
        if (j.store.settings?.defaultLocale) {
          setLocale(j.store.settings.defaultLocale as Locale);
        }
      })
      .catch((e) => setError(e.message));
  }, [storeSlug]);

  useEffect(() => {
    const bump = () => {
      lastActive.current = Date.now();
    };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    const id = setInterval(() => {
      if (step !== "welcome" && step !== "ended" && Date.now() - lastActive.current > INACTIVITY_MS) {
        stopCamera();
        setStep("ended");
      }
    }, 5000);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      clearInterval(id);
    };
  }, [step, stopCamera]);

  async function acceptConsent() {
    setError(null);
    const res = await fetch(`/api/kiosk/${storeSlug}/consent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || "Consent failed");
      return;
    }
    setSessionId(j.sessionId);
    setConsentId(j.consentId);
    setStep("camera");
  }

  async function startCamera() {
    setError(null);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingRef.current, width: { ideal: 1280 }, height: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `Camera error: ${e.message}. Allow camera access over HTTPS or localhost.`
          : "Camera unavailable",
      );
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob || !sessionId) return;
    const fd = new FormData();
    fd.append("file", blob, "person.jpg");
    fd.append("kind", "person");
    fd.append("sessionId", sessionId);
    const res = await fetch(`/api/kiosk/${storeSlug}/upload`, { method: "POST", body: fd });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || "Upload failed");
      return;
    }
    setPersonPath(j.path);
    setPersonPreview(j.url);
    stopCamera();
  }

  async function startTryOn(selectedSareeId?: string, customSareePath?: string) {
    if (!sessionId || !consentId || !personPath) return;
    setError(null);
    setStep("processing");
    setJobStatus("QUEUED");
    const res = await fetch(`/api/kiosk/${storeSlug}/tryon`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        consentId,
        personImagePath: personPath,
        sareeId: selectedSareeId,
        sareeImagePath: customSareePath,
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || "Try-on failed");
      setStep("saree");
      return;
    }
    setJobId(j.jobId);
    setJobStatus(j.status);
  }

  useEffect(() => {
    if (!jobId || step !== "processing") return;
    let cancelled = false;
    const poll = async () => {
      const res = await fetch(`/api/kiosk/${storeSlug}/tryon/${jobId}`);
      const j = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(j.error || "Status failed");
        return;
      }
      setJobStatus(j.status);
      if (j.status === "SUCCEEDED" && j.result) {
        setResult({
          url: j.result.url,
          isDemo: j.result.isDemo,
          label: j.result.label,
          personUrl: j.personUrl,
          sareeImageUrl: j.sareeImageUrl,
          sareeName: j.saree?.name,
        });
        setStep("result");
      } else if (j.status === "FAILED" || j.status === "CANCELLED") {
        setError(j.errorMessage || "Try-on failed");
        setStep("saree");
      } else {
        setTimeout(poll, 700);
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [jobId, step, storeSlug]);

  const primary = data?.store.settings?.primaryColor ?? "#42105C";
  const filtered =
    data?.sarees.filter((s) => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      return [s.name, s.fabric, s.occasion].some((v) => v?.toLowerCase().includes(q));
    }) ?? [];

  if (error && !data) {
    return (
      <main className="kiosk-shell flex min-h-dvh items-center justify-center p-6">
        <p className="text-lg text-red-800">{error}</p>
      </main>
    );
  }

  return (
    <main className="kiosk-shell min-h-dvh px-4 py-6 md:px-8" style={{ ["--burgundy" as string]: primary }}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <BrandLogo size="sm" href="/" className="mb-2" />
            <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--burgundy)] md:text-4xl">
              {data?.store.name ?? "…"}
            </p>
            <p className="brand-tagline mt-1">Your Saree. Virtually.</p>
          </div>
          <label className="text-sm text-[var(--muted)]">
            {t(locale, "language")}
            <select
              className="ml-2 rounded-lg border border-[rgba(107,30,46,0.2)] bg-white/80 px-2 py-1"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              {locales.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        {error && step !== "processing" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</div>
        )}

        {step === "welcome" && (
          <section className="panel panel-gold animate-fade-up text-center">
            <div className="relative mx-auto mb-6 flex h-44 w-44 items-center justify-center">
              <div className="absolute inset-0 animate-pulse-ring rounded-full bg-[rgba(66,16,92,0.12)]" />
              <div className="absolute inset-3 rounded-full border border-[rgba(217,154,34,0.45)]" />
              <BrandLogo size="sm" href={null} className="relative z-10 px-3" />
            </div>
            <p className="brand-tagline">Try · Explore · Choose</p>
            <p className="mt-4 text-lg text-[var(--muted)]">
              {data?.store.settings?.welcomeMessage || t(locale, "instructions")}
            </p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {data?.store.settings?.privacyNotice || t(locale, "privacy")}
            </p>
            <button className="btn-primary mt-8 w-full max-w-sm" onClick={() => setStep("consent")}>
              {t(locale, "welcomeCta")}
            </button>
          </section>
        )}

        {step === "consent" && (
          <section className="panel animate-fade-up">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--burgundy)]">
              {t(locale, "consentTitle")}
            </h2>
            <ul className="mt-4 space-y-3 text-[var(--ink)]">
              <li>{t(locale, "consentWhy")}</li>
              <li>{t(locale, "consentWhat")}</li>
              <li>{t(locale, "consentProcessing")}</li>
              <li>{t(locale, "consentRetention")}</li>
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button className="btn-primary flex-1" onClick={() => void acceptConsent()}>
                {t(locale, "consentAccept")}
              </button>
              <button className="btn-secondary flex-1" onClick={resetSession}>
                {t(locale, "consentCancel")}
              </button>
            </div>
          </section>
        )}

        {step === "camera" && (
          <section className="panel animate-fade-up">
            <div className="viewfinder-frame relative overflow-hidden rounded-2xl bg-black">
              {!personPreview ? (
                <>
                  <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
                  <div className="pointer-events-none absolute inset-8 rounded-[40%] border-2 border-[var(--gold)]/70" />
                  <span className="pointer-events-none absolute right-3 top-3 h-7 w-7 border-r-[3px] border-t-[3px] border-[var(--gold)]" />
                  <span className="pointer-events-none absolute bottom-3 left-3 h-7 w-7 border-b-[3px] border-l-[3px] border-[var(--gold)]" />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={personPreview} alt="Captured" className="aspect-[3/4] w-full object-cover" />
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {!personPreview && (
                <>
                  <button className="btn-primary" onClick={() => void startCamera()}>
                    {t(locale, "cameraStart")}
                  </button>
                  <button className="btn-primary" onClick={() => void capturePhoto()}>
                    {t(locale, "cameraCapture")}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      facingRef.current = facingRef.current === "user" ? "environment" : "user";
                      void startCamera();
                    }}
                  >
                    Flip camera
                  </button>
                </>
              )}
              {personPreview && (
                <>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setPersonPreview(null);
                      setPersonPath(null);
                      void startCamera();
                    }}
                  >
                    {t(locale, "cameraRetake")}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      stopCamera();
                      setStep("saree");
                    }}
                  >
                    Continue
                  </button>
                </>
              )}
              <button
                className="btn-secondary"
                onClick={() => {
                  stopCamera();
                  resetSession();
                }}
              >
                {t(locale, "cameraCancel")}
              </button>
            </div>
          </section>
        )}

        {step === "saree" && (
          <section className="panel animate-fade-up">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--burgundy)]">
              {t(locale, "selectSaree")}
            </h2>
            <input
              className="mt-4 w-full rounded-xl border border-[rgba(107,30,46,0.15)] bg-white/80 px-4 py-3"
              placeholder="Filter by fabric, occasion, name…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  className={`overflow-hidden rounded-2xl border text-left transition ${
                    sareeId === s.id ? "border-[var(--burgundy)] ring-2 ring-[var(--gold)]" : "border-transparent"
                  }`}
                  onClick={() => {
                    setSareeId(s.id);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.imageUrl ?? ""} alt={s.name} className="aspect-[3/4] w-full object-cover" />
                  <div className="bg-white/80 p-2">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {[s.fabric, s.occasion].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                className="btn-primary flex-1"
                disabled={!sareeId}
                onClick={() => sareeId && void startTryOn(sareeId)}
              >
                Try selected saree
              </button>
              <label className="btn-secondary flex-1 cursor-pointer text-center">
                {t(locale, "photoSaree")}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !sessionId) return;
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("kind", "saree");
                    fd.append("sessionId", sessionId);
                    const res = await fetch(`/api/kiosk/${storeSlug}/upload`, { method: "POST", body: fd });
                    const j = await res.json();
                    if (!res.ok) {
                      setError(j.error || "Upload failed");
                      return;
                    }
                    setSareeId(null);
                    await startTryOn(undefined, j.path);
                  }}
                />
              </label>
            </div>
          </section>
        )}

        {step === "processing" && (
          <section className="panel animate-fade-up text-center">
            <div className="mx-auto h-16 w-16 animate-pulse-ring rounded-full border-4 border-[var(--ai-teal)] border-t-transparent" />
            <p className="mt-6 text-xl">{t(locale, "processing")}</p>
            <p className="mt-2 font-mono text-sm text-[var(--muted)]">
              Status: <span className="ai-accent">{jobStatus}</span>
            </p>
          </section>
        )}

        {step === "result" && result && (
          <section className="panel animate-fade-up">
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--burgundy)]">
              {t(locale, "resultTitle")}
            </h2>
            {result.isDemo && (
              <p className="mt-2 rounded-lg bg-[var(--burgundy)] px-3 py-2 text-sm font-semibold text-[#F7F1E8]">
                {result.label || t(locale, "demoLabel")}
              </p>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.url ?? ""} alt="Try-on result" className="mt-4 w-full rounded-2xl object-cover" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.personUrl} alt="Before" className="rounded-xl object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.sareeImageUrl} alt="Saree" className="rounded-xl object-cover" />
            </div>
            {result.sareeName && (
              <p className="mt-3 text-[var(--muted)]">Saree: {result.sareeName}</p>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                className="btn-primary flex-1"
                onClick={() => {
                  setJobId(null);
                  setResult(null);
                  setStep("saree");
                }}
              >
                {t(locale, "tryAnother")}
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={() => {
                  setPersonPath(null);
                  setPersonPreview(null);
                  setJobId(null);
                  setResult(null);
                  setStep("camera");
                }}
              >
                {t(locale, "cameraRetake")}
              </button>
              <button className="btn-secondary flex-1" onClick={resetSession}>
                {t(locale, "startOver")}
              </button>
            </div>
            {result.url && (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <a className="btn-secondary flex-1" href={result.url} download="tryon-result.jpg">
                  {t(locale, "download")}
                </a>
                <a
                  className="btn-secondary flex-1"
                  href={`https://wa.me/?text=${encodeURIComponent("My saree try-on preview from the store kiosk")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Share on WhatsApp
                </a>
              </div>
            )}
          </section>
        )}

        {step === "ended" && (
          <section className="panel animate-fade-up text-center">
            <p className="text-xl">{t(locale, "endSession")}</p>
            <button className="btn-primary mt-6" onClick={resetSession}>
              Return to welcome
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
