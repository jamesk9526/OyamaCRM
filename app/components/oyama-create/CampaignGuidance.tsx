"use client";

const guidance: Record<string, { title: string; instruction: string; next?: string; action?: string }> = {
  content: { title: "Write your message and check each format", instruction: "Add a content piece for each message, such as an appeal or reminder. Write your copy, then open each selected format to check its layout and delivery date.", next: "audience", action: "Next: choose audience" },
  audience: { title: "Choose who receives this campaign", instruction: "Select Edit audience to choose saved CRM lists and your email/postal delivery strategy. Use Manage shared audiences to create a list. Review checks each contact’s eligibility and consent.", next: "review", action: "Next: review campaign" },
  review: { title: "Check the plan, approve, then release", instruction: "Resolve the issues listed below, check every format and recipient count, then confirm your review. Approve frozen release saves the approved revision. Release approved deliveries is a separate action that can start due deliveries." },
  delivery: { title: "Follow delivery after release", instruction: "Check each channel’s status below. Use the available pause or cancel actions for pending work, and read any reported error to investigate a failed delivery. Printed letters still require proof approval and print/mail confirmation." },
  results: { title: "See what happened", instruction: "Review delivery outcomes, responses and linked fundraising results below. Provider acceptance means the provider accepted the message; confirmed delivery is shown separately when available." },
};

export default function CampaignGuidance({ tab, onNavigate }: { tab: string; onNavigate: (tab: string) => void }) {
  const step = guidance[tab];
  if (!step) return null;
  return <section className="oc-task-guide" aria-label="What to do next">
    <div><h2>{step.title}</h2><p>{step.instruction}</p></div>
    {step.next && <button className="oc-button" onClick={() => onNavigate(step.next!)}>{step.action} <span aria-hidden="true">→</span></button>}
  </section>;
}
