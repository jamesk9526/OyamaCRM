"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeartHandshake, ShieldCheck } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import PasswordInput from "@/app/components/auth/PasswordInput";
import { verifyEmailMfa, type LoginMfaChallenge } from "@/app/lib/auth-client";
export default function CompassionLogin() {
  const { signIn, refreshUser, user } = useAuth(); const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [code, setCode] = useState(""); const [challenge, setChallenge] = useState<LoginMfaChallenge | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (challenge) { await verifyEmailMfa(challenge.mfaTicket, code); await refreshUser(); }
      else { const result = await signIn(email, password); if (result.mfaRequired) { setChallenge(result); return; } }
      router.replace("/compassion");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }
  return <div className="care-login"><section className="care-login-story"><HeartHandshake size={40} strokeWidth={1.3} /><div className="care-eyebrow" style={{ color: "#81c7c5", marginTop: 24 }}>COMPASSION CRM</div><h1>More time for the people in your care.</h1><p>A dedicated space for your clients, your schedule, and every step of their care journey.</p><div className="care-actions" style={{ marginTop: 42, fontSize: 11, color: "#abc7ca" }}><ShieldCheck size={17} /> Separate, permissioned client-care access</div></section><section className="care-login-form"><div><div className="care-eyebrow">YOUR CLIENT-CARE WORKSPACE</div><h2>{challenge ? "Verify your sign-in" : "Welcome to Compassion"}</h2><p>{challenge ? `Enter the code sent to ${challenge.destinationHint}.` : "Sign in with your Oyama account to continue."}</p>{user && !challenge && <Link href="/compassion" className="care-button" style={{ marginTop: 20 }}>Continue as {user.firstName}</Link>}<form className="care-form" onSubmit={submit}>{challenge ? <label>Verification code<input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" inputMode="numeric" required autoFocus /></label> : <><label>Email address<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label htmlFor="care-password">Password<PasswordInput id="care-password" value={password} onChange={setPassword} autoComplete="current-password" required /></label></>}{error && <div className="care-error" role="alert">{error}</div>}<button className="care-button" disabled={busy}>{busy ? "Signing in…" : challenge ? "Verify and continue" : "Sign in to Compassion"}</button></form><p className="care-login-foot">Your account requires an active Compassion membership. <Link href="/login/forgot-password" style={{ color: "#087f82" }}>Forgot password?</Link></p><p className="care-login-foot"><Link href="/apps">← Back to Oyama apps</Link></p></div></section></div>;
}
