import type { CSSProperties } from "react";
export type ChromeIconName = "commands" | "apps" | "search" | "notifications" | "assistant" | "research" | "help" | "chevron" | "gift" | "person" | "document" | "chart" | "mail" | "upload" | "check";
const paths: Record<ChromeIconName, string[]> = {
 gift: ["M4 9h16v4H4zM6 13v8h12v-8M12 9v12", "M12 9H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"],
 person: ["M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 21v-2a7 7 0 0 1 14 0v2"],
 document: ["M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"],
 chart: ["M4 3v17h17M8 16v-5M13 16V7M18 16v-8"],
 mail: ["M3 5h18v14H3zM3 6l9 7 9-7"],
 upload: ["M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"],
 check: ["M9 11l3 3 8-9M20 12v8H4V4h10"],
 commands: ["M4 5h16M4 12h16M4 19h16", "M8 3v4M16 10v4M10 17v4"],
 apps: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
 search: ["M16.5 10.5a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z", "m15 15 5 5"],
 notifications: ["M5.5 16.5h13l-1.5-2V10a5 5 0 0 0-10 0v4.5l-1.5 2Z", "M10 20h4M12 3v2"],
 assistant: ["m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z", "M19 3v4M17 5h4"],
 research: ["M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z", "M3 20a7 7 0 0 1 10-6M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-1 2 3 3"],
 help: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", "M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .7-1.7 1.2-1.7 2.7M12 17h.01"],
 chevron: ["m7 14 5-5 5 5"],
};
/** Original, consistently drawn 24px line icons for application chrome. */
export default function ChromeIcon({name, className = "h-5 w-5", style}: {name: ChromeIconName; className?: string; style?: CSSProperties}) {
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">{paths[name].map((d,i)=><path key={i} d={d}/>)}</svg>;
}
