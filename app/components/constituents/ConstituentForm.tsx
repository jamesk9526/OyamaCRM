"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CONSTITUENT_TYPES, DONOR_STATUSES } from "@/app/components/constituents/constituent-utils";

interface ConstituentFormData {
  firstName: string;
  lastName: string;
  prefix: string;
  email: string;
  email2: string;
  phone: string;
  phone2: string;
  mobile: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  type: string;
  donorStatus: string;
  employer: string;
  occupation: string;
  notes: string;
  doNotEmail: boolean;
  doNotCall: boolean;
  doNotMail: boolean;
}

interface Props {
  mode: "create" | "edit";
  initialData?: Partial<ConstituentFormData>;
  constituentId?: string;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const DEFAULTS: ConstituentFormData = {
  firstName: "", lastName: "", prefix: "", email: "", email2: "",
  phone: "", phone2: "", mobile: "", addressLine1: "", addressLine2: "",
  city: "", state: "", zip: "", country: "US", type: "DONOR",
  donorStatus: "NEW", employer: "", occupation: "", notes: "",
  doNotEmail: false, doNotCall: false, doNotMail: false,
};

export default function ConstituentForm({ mode, initialData, constituentId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<ConstituentFormData>({ ...DEFAULTS, ...initialData });
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  function set(field: keyof ConstituentFormData, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const url = mode === "create"
          ? `${API_BASE}/api/constituents`
          : `${API_BASE}/api/constituents/${constituentId}`;

        const res = await fetch(url, {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }

        const saved = await res.json();
        router.push(`/constituents/${saved.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Prefix" optional>
            <select value={form.prefix} onChange={(e) => set("prefix", e.target.value)} className={SELECT_CLS}>
              <option value="">—</option>
              {["Mr.", "Ms.", "Mrs.", "Dr.", "Rev.", "Prof."].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="First Name" required>
            <input required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={INPUT_CLS} placeholder="First name" />
          </Field>
          <Field label="Last Name" required>
            <input required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={INPUT_CLS} placeholder="Last name" />
          </Field>
          <Field label="Constituent Type">
            <select value={form.type} onChange={(e) => set("type", e.target.value)} className={SELECT_CLS}>
              {CONSTITUENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </Field>
          <Field label="Donor Status">
            <select value={form.donorStatus} onChange={(e) => set("donorStatus", e.target.value)} className={SELECT_CLS}>
              {DONOR_STATUSES.map((s) => (
                <option key={s} value={s}>{s === "MAJOR_DONOR" ? "Major Donor" : s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Primary Email" optional>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={INPUT_CLS} placeholder="email@example.com" />
          </Field>
          <Field label="Secondary Email" optional>
            <input type="email" value={form.email2} onChange={(e) => set("email2", e.target.value)} className={INPUT_CLS} placeholder="email@example.com" />
          </Field>
          <Field label="Phone" optional>
            <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={INPUT_CLS} placeholder="(555) 555-5555" />
          </Field>
          <Field label="Mobile" optional>
            <input type="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} className={INPUT_CLS} placeholder="(555) 555-5555" />
          </Field>
        </div>
        {/* Communication prefs */}
        <div className="mt-4 flex flex-wrap gap-6">
          {([["doNotEmail", "Do Not Email"], ["doNotCall", "Do Not Call"], ["doNotMail", "Do Not Mail"]] as const).map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form[field]}
                onChange={(e) => set(field, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {/* Address */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Address</h2>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Address Line 1" optional>
            <input value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} className={INPUT_CLS} placeholder="123 Main St" />
          </Field>
          <Field label="Address Line 2" optional>
            <input value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} className={INPUT_CLS} placeholder="Suite 100" />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <Field label="City" optional>
                <input value={form.city} onChange={(e) => set("city", e.target.value)} className={INPUT_CLS} placeholder="Chicago" />
              </Field>
            </div>
            <Field label="State" optional>
              <select value={form.state} onChange={(e) => set("state", e.target.value)} className={SELECT_CLS}>
                <option value="">—</option>
                {US_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="ZIP" optional>
              <input value={form.zip} onChange={(e) => set("zip", e.target.value)} className={INPUT_CLS} placeholder="60601" maxLength={10} />
            </Field>
          </div>
        </div>
      </section>

      {/* Professional */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Professional Info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Employer" optional>
            <input value={form.employer} onChange={(e) => set("employer", e.target.value)} className={INPUT_CLS} placeholder="Company name" />
          </Field>
          <Field label="Occupation" optional>
            <input value={form.occupation} onChange={(e) => set("occupation", e.target.value)} className={INPUT_CLS} placeholder="Job title" />
          </Field>
        </div>
      </section>

      {/* Notes */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Notes</h2>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={4}
          className={`${INPUT_CLS} resize-none`}
          placeholder="Internal notes about this constituent..."
        />
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving..." : mode === "create" ? "Create Constituent" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// Helpers
const INPUT_CLS = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900 placeholder:text-gray-400";
const SELECT_CLS = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900";

function Field({ label, required, optional, children }: { label: string; required?: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {optional && <span className="text-gray-400 ml-1 font-normal">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
