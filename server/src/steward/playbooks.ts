/** Reviewed, model-free workflows. Only explicit help/navigation requests match. */
export const STEWARD_PLAYBOOKS = [
  { id: "constituents", title: "Find a constituent", terms: ["constituent", "contacts", "donor record"], path: "/constituents", steps: "Search by name, email, or phone. Review matching records before creating a duplicate. Open the profile to review history and contact preferences." },
  { id: "donations", title: "Record a gift", terms: ["donation", "record a gift", "add a gift"], path: "/donations", steps: "Choose Record gift. Verify the constituent, amount, designation, date, and payment status. Review the form before saving; this answer has not recorded a gift." },
  { id: "campaigns", title: "Review campaigns", terms: ["campaigns", "fundraising campaign"], path: "/campaigns", steps: "Open a campaign to review its details and giving context. Confirm dates and filters before comparing results." },
  { id: "tasks", title: "Create a follow-up task", terms: ["task", "follow-up task"], path: "/tasks", steps: "Choose New Task. Set the constituent, owner, due date, and priority. Review before saving. No task has been created by this answer." },
  { id: "reports", title: "Open reports", terms: ["reports", "export a report"], path: "/reports", steps: "Choose a report, set its date range and filters, and review the included records before exporting. Exported information remains subject to your organization's access rules." },
  { id: "email", title: "Prepare an email", terms: ["email campaign", "send email", "email builder"], path: "/oyama-email", steps: "Prepare the audience and content in the email workspace. Check preferences and suppressions, preview and test the message, then review recipients before sending. Nothing has been sent." },
  { id: "letters", title: "Prepare letters", terms: ["letters", "print queue", "print a letter"], path: "/oyama-letters", steps: "Choose a template and intended recipients. Review merge fields, contact restrictions, and print output before moving the letters through the available review and print steps." },
  { id: "paths", title: "Build a Steward Path", terms: ["steward path", "stewardship workflow"], path: "/steward-paths", steps: "Create or open a draft. Set one first-root trigger, add steps, and configure branch conditions and a fallback lane. Resolve validation issues and test before activation. No path has been activated." },
  { id: "events", title: "Open events", terms: ["events", "event workspace"], path: "/events", steps: "Select the intended event before working with guests, registration, seating, or check-in. Confirm event scope before saving changes." },
  { id: "settings", title: "Organization settings", terms: ["organization settings", "organisation settings"], path: "/settings", steps: "Review the relevant organization settings. Changes may affect all staff; use an authorized administrator and validate the result." },
  { id: "fiscal", title: "Understand fiscal periods", terms: ["fiscal year", "fiscal period", "reporting period"], path: "/", steps: "Use Period in the top bar and verify the dates against organization fiscal settings. Period metrics follow the selected period; lifetime totals and stored relationship status retain their own meaning. An unavailable metric is not zero." },
  { id: "tables", title: "Use spreadsheet controls", terms: ["spreadsheet", "table controls", "resize columns", "copy cells"], path: "/constituents", steps: "Click a cell background. Use arrow keys to move, Shift + arrows to select a range, and Ctrl/Cmd + C to copy tab-separated values. Drag a header's right edge to resize. Enter/F2 focuses a cell action; Escape clears the range. Editing still uses record forms." },
  { id: "commands", title: "Use page commands", terms: ["command dock", "command pill", "page commands"], path: "/", steps: "Hover over or click/tap the bottom pill. Keyboard users can Tab to it and press Enter. Available actions follow the current page and selection. Escape collapses the dock." },
  { id: "permissions", title: "Check permissions", terms: ["permissions", "missing access", "missing module"], path: "/help", steps: "Check your workspace, role, enabled features, and required selection. Ask an administrator to review access. A suggested link never grants permission or bypasses server checks." },
  { id: "bridge", title: "Check the local AI bridge", terms: ["ai bridge", "local model", "ollama", "bridge offline"], path: "/settings", steps: "Open Oyama Bridge and verify the runtime is running, the selected model is installed, and the CRM endpoint and pairing credentials match. Run the AI settings connection test. Reviewed playbooks do not need Ollama; open-ended drafting and analysis do." },
  { id: "help", title: "Find product help", terms: ["help center", "help centre", "user guide"], path: "/help", steps: "Search the help workspace for the feature or workflow. Follow the relevant guide and check your permissions if controls are unavailable." },
] as const;

export function resolveStewardPlaybook(query: string, mode: string, moduleKey: string) {
  if (!["ask", "help", "action"].includes(mode) || moduleKey !== "donor") return null;
  const q = query.toLowerCase().replace(/[?.!]+$/g, "").replace(/\s+/g, " ").trim();
  if (["who are you", "what is your name", "hello", "hi steward", "what can you do"].includes(q)) {
    return { id: "identity", reply: "I’m Steward, your CRM colleague for clear answers and thoughtful follow-through. I can explain workflows, review current permissioned CRM evidence, and prepare drafts for your approval. If I cannot verify something, I’ll say what is missing. Opening a workspace or proposing an action does not change a record." };
  }
  // Do not hijack a compound request, draft, analytics request, or record-specific instruction.
  if (q.length > 180 || /\b(and|then|analyze|analyse|compare|draft|write|delete|send now)\b/.test(q)) return null;
  const prefix = /^(?:how (?:do i|to)|where (?:is|are|can i find)|help (?:me )?(?:with|use)|show me|open|go to|explain)\s+/;
  if (!prefix.test(q)) return null;
  const subject = q.replace(prefix, "").replace(/\b(the|a|an)\s+/g, "");
  const match = STEWARD_PLAYBOOKS.filter(item => item.terms.some(raw => { const term = raw.replace(/\b(the|a|an)\s+/g, ""); return [term, `use ${term}`, `find ${term}`, `create ${term}`, `record ${term}`, `add ${term}`, `manage ${term}`].includes(subject); }));
  if (match.length !== 1) return null;
  const item = match[0];
  return { id: item.id, reply: `### ${item.title}\n\n${item.steps}\n\n[Open workspace](${item.path})\n\nAvailable controls depend on your role and configuration.` };
}
