"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";

export default function SurveyShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  if (loading || !user) return <div className="survey-ui survey-public" role="status">Opening Surveys…</div>;
  return <div className="survey-ui survey-shell" data-oyama-internal="true">
    <a className="sr-only focus:not-sr-only" href="#survey-main">Skip to content</a>
    {user.role === "compassion_user" ? <header className="survey-card survey-heading">
      <Link href="/surveys?audience=CLIENT" className="survey-link">Oyama Surveys</Link>
      <nav className="survey-row" aria-label="Workspace">
        <Link href="/compassion" className="survey-btn">Compassion CRM</Link>
        <button className="survey-btn" onClick={() => void signOut()}>Sign out</button>
      </nav>
    </header> : <TopBar />}
    <div className="survey-shell-body">
      <aside className="survey-rail">
        <nav aria-label="Surveys navigation"><Link href="/surveys" aria-label="Survey library"><ClipboardList size={17} aria-hidden /><span>Survey library</span></Link></nav>
      </aside>
      <main id="survey-main" className="survey-main" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
