"use client";

import { useEffect, useState } from "react";
import type { Answers, Definition } from "@/server/src/surveys/definition";
import { message, type Identity } from "./client";
import SurveyForm from "./SurveyForm";

type PublicForm = { definition: Definition; identity: Identity; organization: string; completed: boolean };

async function publicRequest<T>(lane: string, path: string, data: object, signal?: AbortSignal) {
  const response = await fetch(`/api/${lane === "c" ? "compassion-public" : "public"}/surveys/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "The survey could not be opened. Try again.");
  return result as T;
}

export default function PublicSurvey() {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [link, setLink] = useState<{ lane: string; token: string } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const match = /^#([cd])\.([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
    if (!match) {
      setError("Open the full link from your survey invitation.");
      return;
    }
    const [, lane, token] = match;
    setLink({ lane, token });
    setError("");
    publicRequest<PublicForm>(lane, "form", { token }, controller.signal).then(setForm, reason => {
      if (!controller.signal.aborted) setError(message(reason));
    });
    return () => controller.abort();
  }, [retry]);
  const submit = async (answers: Answers, submissionKey: string) => {
    if (!link) throw new Error("The survey link is missing.");
    await publicRequest(link.lane, "responses", { token: link.token, answers, submissionKey });
  };
  return <main className="survey-ui survey-public">
    {form ? <SurveyForm {...form} submit={submit} /> : <div className="survey-respondent survey-card survey-stack">
      <p className="survey-eyebrow">Oyama Surveys</p>
      <h1>{error ? "Survey unavailable" : "Opening survey"}</h1>
      {error ? <><p role="alert">{error}</p>{link && <div><button className="survey-btn" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}</>
        : <p role="status">Loading your questionnaire…</p>}
    </div>}
  </main>;
}
