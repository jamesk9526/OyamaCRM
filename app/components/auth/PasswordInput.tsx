"use client";

import { useState } from "react";

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Password input with a keyboard-accessible visibility control. */
export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder = "••••••••",
  minLength,
  required = false,
  disabled = false,
  className = "",
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full border border-[#8a8886] bg-white px-3.5 py-3 pr-20 text-sm text-slate-900 outline-none transition focus:border-[#0f6cbd] focus:ring-2 focus:ring-[#c7e0f4] placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-[#0f548c] hover:text-[#0f6cbd] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f6cbd]"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
