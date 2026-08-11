"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Heart, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import type { DonationWidgetSettings, SiteEmbedAppearanceSettings } from "@/app/components/settings/site-embeds/site-embed-types";

interface HostedGivingPayload {
  siteName: string;
  organizationName: string;
  publicSiteId: string;
  appearance: SiteEmbedAppearanceSettings;
  form: DonationWidgetSettings;
  currency: string;
  checkoutReady: boolean;
  stripeMode: "sandbox" | "production";
}

interface HostedCheckoutPayload {
  clientSecret: string;
  publishableKey: string;
  sessionId: string;
  returnOrigin: string;
}

type StripeCheckout = { mount: (element: HTMLElement) => void; destroy: () => void };
type StripeFactory = (key: string) => { initEmbeddedCheckout: (input: { clientSecret: string }) => Promise<StripeCheckout> };

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(amount);
}

async function loadStripeFactory(): Promise<StripeFactory> {
  const stripeWindow = window as typeof window & { Stripe?: StripeFactory };
  if (stripeWindow.Stripe) return stripeWindow.Stripe;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3/"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Secure payment fields could not load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Secure payment fields could not load."));
    document.head.appendChild(script);
  });

  if (!stripeWindow.Stripe) throw new Error("Secure payment fields are unavailable.");
  return stripeWindow.Stripe;
}

/** Responsive, semantic public HTML giving form backed by verified Stripe checkout. */
export default function HostedGivingPage({ token }: { token: string }) {
  const [payload, setPayload] = useState<HostedGivingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [giftType, setGiftType] = useState<"one-time" | "monthly">("one-time");
  const [designation, setDesignation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const checkoutMountRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<StripeCheckout | null>(null);
  const returnOriginRef = useRef("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/site-embeds/public/donation-page?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { data?: HostedGivingPayload; error?: { message?: string } };
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "This giving page is unavailable.");
        if (!active) return;
        setPayload(body.data);
        const firstAmount = body.data.form.suggestedAmounts[0] ?? null;
        setSelectedAmount(firstAmount);
        setGiftType(body.data.form.defaultGiftType === "monthly" && body.data.form.enableMonthlyGiving ? "monthly" : "one-time");
        setDesignation(body.data.form.defaultDesignation || body.data.form.allowedDesignations[0] || "General Fund");
      })
      .catch((error) => active && setLoadError(error instanceof Error ? error.message : "This giving page is unavailable."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    function handleReturn(event: MessageEvent) {
      if (event.data?.oyama_stripe_return !== true) return;
      if (returnOriginRef.current && event.origin !== returnOriginRef.current) return;
      const redirectUrl = typeof event.data?.redirectUrl === "string" ? event.data.redirectUrl : "";
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }
      setCompleted(true);
      setCheckoutActive(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.addEventListener("message", handleReturn);
    return () => {
      window.removeEventListener("message", handleReturn);
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
    };
  }, []);

  const accent = useMemo(() => {
    const candidate = payload?.form.accentColor || payload?.appearance.accentColor || "#2563eb";
    return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : "#2563eb";
  }, [payload]);
  const amount = customAmount ? Number(customAmount) : selectedAmount;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload || !amount || !Number.isFinite(amount)) return;
    const minimum = payload.form.minimumAmountCents / 100;
    const maximum = payload.form.maximumAmountCents / 100;
    if (amount < minimum || amount > maximum) {
      setFormError(`Gift amount must be between ${money(minimum, payload.currency)} and ${money(maximum, payload.currency)}.`);
      return;
    }

    const fields = new FormData(event.currentTarget);
    setSubmitting(true);
    setFormError("");
    try {
      const response = await fetch("/api/site-embeds/public/donation-checkout-embedded", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          surface: "hosted",
          amount,
          giftType,
          designation,
          name: `${String(fields.get("firstName") ?? "").trim()} ${String(fields.get("lastName") ?? "").trim()}`.trim(),
          email: String(fields.get("email") ?? "").trim(),
          phone: String(fields.get("phone") ?? "").trim(),
          requestId: window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        }),
      });
      const body = await response.json().catch(() => ({})) as { data?: HostedCheckoutPayload; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Secure checkout could not be started.");

      setCheckoutActive(true);
      returnOriginRef.current = body.data.returnOrigin;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!checkoutMountRef.current) throw new Error("Payment form mount is unavailable.");
      const stripe = await loadStripeFactory();
      checkoutRef.current = await stripe(body.data.publishableKey).initEmbeddedCheckout({ clientSecret: body.data.clientSecret });
      checkoutRef.current.mount(checkoutMountRef.current);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
      setCheckoutActive(false);
      setFormError(error instanceof Error ? error.message : payload.form.failureMessage);
    } finally {
      setSubmitting(false);
    }
  }

  function returnToForm() {
    checkoutRef.current?.destroy();
    checkoutRef.current = null;
    setCheckoutActive(false);
    setFormError("");
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="size-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" aria-label="Loading giving page" /></main>;
  if (loadError || !payload) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center"><Heart className="mx-auto size-9 text-slate-400" /><h1 className="mt-4 text-xl font-semibold text-slate-950">Giving page unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-600">{loadError || "This page may be unpublished or its link may have changed."}</p></section></main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10" style={{ backgroundColor: payload.appearance.themeMode === "soft" ? payload.appearance.backgroundColor : undefined }}>
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="flex flex-col justify-between gap-10 bg-slate-950 p-6 text-white sm:p-9 lg:min-h-[680px]">
          <div>
            <div className="inline-flex size-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}33`, color: accent }}><Heart className="size-6" fill="currentColor" /></div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{payload.form.hostedPageEyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{payload.form.headline}</h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-300 sm:text-base">{payload.form.supportingCopy}</p>
          </div>
          <div className="space-y-4 border-t border-white/15 pt-6 text-sm text-slate-300">
            <p className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0" style={{ color: accent }} /><span>Payment details are encrypted and handled securely by Stripe.</span></p>
            <p>{payload.form.hostedPageFooter}</p>
            <p className="text-xs text-slate-400">Hosted by OyamaCRM for {payload.organizationName || payload.siteName}</p>
          </div>
        </aside>

        <section className="min-w-0 p-5 sm:p-8 lg:p-10">
          {payload.stripeMode === "sandbox" ? <div className="mb-5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Test mode — no live payment will be charged.</div> : null}
          {completed ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center text-center" role="status">
              <CheckCircle2 className="size-14" style={{ color: accent }} />
              <h2 className="mt-5 text-2xl font-semibold text-slate-950">Thank you for your gift</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{payload.form.successMessage}</p>
            </div>
          ) : checkoutActive ? (
            <div>
              <button type="button" onClick={returnToForm} className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw className="size-4" />Change gift details</button>
              <h2 className="text-xl font-semibold text-slate-950">Complete your secure payment</h2>
              <p className="mt-1 text-sm text-slate-600">Your gift is recorded in the CRM only after Stripe verifies payment.</p>
              <div ref={checkoutMountRef} className="mt-5 min-h-[420px]" aria-live="polite" />
            </div>
          ) : (
            <form onSubmit={submit} noValidate={false}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-xl font-semibold text-slate-950">Your gift</h2><p className="mt-1 text-sm text-slate-600">Choose an amount and tell us who you are.</p></div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"><LockKeyhole className="size-3.5" />Secure form</span>
              </div>

              <fieldset className="mt-7"><legend className="text-sm font-semibold text-slate-900">Gift amount</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{payload.form.suggestedAmounts.slice(0, 8).map((preset) => { const active = !customAmount && selectedAmount === preset; return <button key={preset} type="button" aria-pressed={active} onClick={() => { setSelectedAmount(preset); setCustomAmount(""); }} className={`min-h-11 rounded-md border px-3 text-sm font-semibold transition ${active ? "text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`} style={active ? { backgroundColor: accent, borderColor: accent } : undefined}>{money(preset, payload.currency)}</button>; })}{payload.form.allowCustomAmount ? <button type="button" aria-pressed={Boolean(customAmount)} onClick={() => { setSelectedAmount(null); setCustomAmount((current) => current || ""); }} className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${selectedAmount === null ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}>{payload.form.customAmountLabel}</button> : null}</div></fieldset>
              {payload.form.allowCustomAmount && selectedAmount === null ? <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor="custom-gift-amount">Custom amount<input id="custom-gift-amount" name="customAmount" type="number" inputMode="decimal" min={payload.form.minimumAmountCents / 100} max={payload.form.maximumAmountCents / 100} step="0.01" required className="mt-1.5 min-h-11 w-full rounded-md border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} /></label> : null}

              {payload.form.enableMonthlyGiving ? <fieldset className="mt-6"><legend className="text-sm font-semibold text-slate-900">Giving schedule</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{(["one-time", "monthly"] as const).map((value) => <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm font-semibold ${giftType === value ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-300 text-slate-700"}`}><input type="radio" name="giftType" value={value} checked={giftType === value} onChange={() => setGiftType(value)} className="size-4" />{value === "monthly" ? "Monthly gift" : "One-time gift"}</label>)}</div></fieldset> : null}

              {payload.form.allowedDesignations.length > 0 ? <label className="mt-6 block text-sm font-semibold text-slate-800" htmlFor="gift-designation">Gift designation<select id="gift-designation" name="designation" value={designation} onChange={(event) => setDesignation(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">{payload.form.allowedDesignations.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> : null}

              <fieldset className="mt-6"><legend className="text-sm font-semibold text-slate-900">Donor information</legend><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700" htmlFor="donor-first-name">First name<input id="donor-first-name" name="firstName" autoComplete="given-name" required={payload.form.requireDonorName} maxLength={80} className="mt-1.5 min-h-11 w-full rounded-md border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label><label className="text-sm font-medium text-slate-700" htmlFor="donor-last-name">Last name<input id="donor-last-name" name="lastName" autoComplete="family-name" required={payload.form.requireDonorName} maxLength={80} className="mt-1.5 min-h-11 w-full rounded-md border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2" htmlFor="donor-email">Email address<input id="donor-email" name="email" type="email" autoComplete="email" required maxLength={254} className="mt-1.5 min-h-11 w-full rounded-md border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>{payload.form.collectPhone ? <label className="text-sm font-medium text-slate-700 sm:col-span-2" htmlFor="donor-phone">Phone <span className="font-normal text-slate-500">(optional)</span><input id="donor-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} className="mt-1.5 min-h-11 w-full rounded-md border border-slate-300 px-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label> : null}</div></fieldset>

              {formError ? <p className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{formError}</p> : null}
              {!payload.checkoutReady ? <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">Online giving is temporarily unavailable. Please contact the organization for assistance.</p> : null}
              <button type="submit" disabled={submitting || !payload.checkoutReady || !amount} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-5 text-base font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: accent }}><LockKeyhole className="size-4" />{submitting ? "Preparing secure checkout…" : payload.form.buttonLabel}</button>
              <p className="mt-3 text-center text-xs leading-5 text-slate-500">{payload.form.trustLine} You will review payment details before submitting.</p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
