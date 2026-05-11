// Reusable topbar feedback trigger button used across CRM modules.

"use client";

interface FeedbackButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * FeedbackButton renders a compact icon button that opens the feedback modal.
 * It is intentionally style-agnostic so shell components can pass module-specific tones.
 */
export function FeedbackButton({ onClick, className = "" }: FeedbackButtonProps) {
  return (
    <button
      type="button"
      title="Send Feedback"
      aria-label="Send feedback"
      onClick={onClick}
      className={className}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 6.5A2.5 2.5 0 0 1 8 4h8a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 16 16h-4.4L7 20v-4H8A2.5 2.5 0 0 1 5.5 13.5v-7Z" />
      </svg>
    </button>
  );
}
