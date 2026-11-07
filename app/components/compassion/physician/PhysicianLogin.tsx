"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import PasswordInput from "@/app/components/auth/PasswordInput";
import { reviewFetch } from "./review-client";
export default function PhysicianLogin() {
  const router = useRouter();
  const [email,setEmail] = useState(""); const [password,setPassword] = useState(""); const [code,setCode] = useState(""); const [recovery,setRecovery] = useState(false);
  const [challenge,setChallenge] = useState<{challenge:string;enroll:boolean;qr?:string;setupKey?:string}|null>(null);
  const [recoveryCodes,setRecoveryCodes] = useState<string[]>([]); const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  async function submit(e:FormEvent) {
    e.preventDefault();setBusy(true);setError("");
    try {
      if (!challenge) {setChallenge(await reviewFetch("/login",{email,password}));setPassword("");}
      else {
        const result = await reviewFetch<{recovery?:boolean;recoveryCodes?:string[]}>("/verify",{challenge:challenge.challenge,...(recovery?{recoveryCode:code}:{code})});
        setCode("");setChallenge(null);
        if(result.recovery){setRecovery(false);setError("Authenticator reset. Sign in again to enroll your new authenticator before reviewing any records.");}
        else if(result.recoveryCodes)setRecoveryCodes(result.recoveryCodes);
        else router.replace("/compassion/physician");
      }
    } catch(e){setError(e instanceof Error?e.message:"Unable to sign in.");}finally{setBusy(false);}
  }
  return <main className="care-review-login"><section><ShieldCheck size={34}/><p className="care-eyebrow">COMPASSION · PHYSICIAN REVIEW</p><h1>Ultrasound review</h1><p>Secure access for your center’s authorized ultrasound reviewers.</p>
    {recoveryCodes.length ? <div className="care-form"><h2>Save your recovery codes</h2><p>Store these once-only codes in a secure place. They allow you to reset a lost authenticator.</p><div className="care-recovery-codes">{recoveryCodes.map(c=><code key={c}>{c}</code>)}</div><button className="care-button" onClick={()=>{setRecoveryCodes([]);router.replace("/compassion/physician");}}>I saved my codes — open review queue</button></div> : <form className="care-form" onSubmit={submit}>
      {challenge ? <><h2>{challenge.enroll?"Set up your authenticator":"Verify your sign-in"}</h2>{challenge.qr&&<><p>Scan this code in your authenticator app, then enter its current six-digit code.</p><Image unoptimized src={challenge.qr} width={200} height={200} alt="Authenticator enrollment QR code"/><details><summary>Enter setup key manually</summary><code className="care-secret-key">{challenge.setupKey}</code></details></>}<label>{recovery?"Recovery code":"Authenticator code"}<input autoFocus required value={code} onChange={e=>setCode(e.target.value)} inputMode={recovery?"text":"numeric"} autoComplete="one-time-code" /></label>{!challenge.enroll&&<button type="button" className="care-text-button" onClick={()=>{setRecovery(!recovery);setCode("");}}>{recovery?"Use authenticator instead":"Lost your authenticator? Use a recovery code"}</button>}</> : <><label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label htmlFor="physician-password">Password</label><PasswordInput id="physician-password" value={password} onChange={setPassword} required autoComplete="current-password"/></>}
      {error&&<p role="alert" className="care-error">{error}</p>}<button className="care-button" disabled={busy}>{busy?"Verifying…":challenge?"Verify and continue":"Sign in"}</button>{challenge&&<button type="button" className="care-button secondary" onClick={()=>{setChallenge(null);setCode("");setRecovery(false);}}>Start again</button>}
    </form>}<p className="care-login-foot">Individual physician accounts are provided by your center administrator. Contact your center for access or recovery help.</p>
  </section></main>;
}
