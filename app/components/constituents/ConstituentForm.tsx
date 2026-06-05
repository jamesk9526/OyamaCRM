"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CONSTITUENT_TYPES, DONOR_STATUSES, isOrganizationConstituent } from "@/app/components/constituents/constituent-utils";
import { apiFetch } from "@/app/lib/auth-client";

type ConstituentGroupOption = {
  id: string;
  name: string;
  groupType: "CHURCH" | "BUSINESS" | "ORGANIZATION";
  primaryConstituentId?: string | null;
  _count?: { members: number };
};

type GroupMembershipDraft = {
  groupId: string;
  relationshipLabel: string;
  isPrimary: boolean;
};

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
  displayName: string;
  organizationName: string;
  contactFirstName: string;
  contactLastName: string;
  contactTitle: string;
  entityKind: "PERSON" | "ORGANIZATION";
  organizationCategory: "CHURCH" | "BUSINESS" | "ORGANIZATION";
  groupMemberships: GroupMembershipDraft[];
}

interface Props {
  mode: "create" | "edit";
  initialData?: Partial<ConstituentFormData> & {
    groupMemberships?: Array<{
      relationshipLabel?: string | null;
      isPrimary?: boolean;
      group?: {
        id: string;
      };
    }>;
  };
  constituentId?: string;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const DEFAULTS: ConstituentFormData = {
  firstName: "",
  lastName: "",
  prefix: "",
  email: "",
  email2: "",
  phone: "",
  phone2: "",
  mobile: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
  type: "DONOR",
  donorStatus: "NEW",
  employer: "",
  occupation: "",
  notes: "",
  doNotEmail: false,
  doNotCall: false,
  doNotMail: false,
  displayName: "",
  organizationName: "",
  contactFirstName: "",
  contactLastName: "",
  contactTitle: "",
  entityKind: "PERSON",
  organizationCategory: "ORGANIZATION",
  groupMemberships: [],
};

function normalizeGroupMemberships(
  memberships?: Props["initialData"]["groupMemberships"],
): GroupMembershipDraft[] {
  if (!Array.isArray(memberships)) return [];
  return memberships
    .map((membership) => ({
      groupId: membership.group?.id ?? "",
      relationshipLabel: membership.relationshipLabel ?? "",
      isPrimary: membership.isPrimary === true,
    }))
    .filter((membership) => Boolean(membership.groupId));
}

function normalizeInitialData(initialData?: Props["initialData"]): ConstituentFormData {
  if (!initialData) return { ...DEFAULTS };
  const isOrg = isOrganizationConstituent(initialData);
  return {
    ...DEFAULTS,
    ...initialData,
    firstName: typeof initialData.firstName === "string" ? initialData.firstName : "",
    lastName: typeof initialData.lastName === "string" ? initialData.lastName : "",
    prefix: typeof initialData.prefix === "string" ? initialData.prefix : "",
    email: typeof initialData.email === "string" ? initialData.email : "",
    email2: typeof initialData.email2 === "string" ? initialData.email2 : "",
    phone: typeof initialData.phone === "string" ? initialData.phone : "",
    phone2: typeof initialData.phone2 === "string" ? initialData.phone2 : "",
    mobile: typeof initialData.mobile === "string" ? initialData.mobile : "",
    addressLine1: typeof initialData.addressLine1 === "string" ? initialData.addressLine1 : "",
    addressLine2: typeof initialData.addressLine2 === "string" ? initialData.addressLine2 : "",
    city: typeof initialData.city === "string" ? initialData.city : "",
    state: typeof initialData.state === "string" ? initialData.state : "",
    zip: typeof initialData.zip === "string" ? initialData.zip : "",
    country: typeof initialData.country === "string" ? initialData.country : "US",
    type: typeof initialData.type === "string" ? initialData.type : (isOrg ? "ORGANIZATION" : "DONOR"),
    donorStatus: typeof initialData.donorStatus === "string" ? initialData.donorStatus : "NEW",
    employer: typeof initialData.employer === "string" ? initialData.employer : "",
    occupation: typeof initialData.occupation === "string" ? initialData.occupation : "",
    notes: typeof initialData.notes === "string" ? initialData.notes : "",
    doNotEmail: initialData.doNotEmail === true,
    doNotCall: initialData.doNotCall === true,
    doNotMail: initialData.doNotMail === true,
    displayName: typeof initialData.displayName === "string" ? initialData.displayName : "",
    organizationName: typeof initialData.organizationName === "string" ? initialData.organizationName : "",
    contactFirstName: typeof initialData.contactFirstName === "string" ? initialData.contactFirstName : "",
    contactLastName: typeof initialData.contactLastName === "string" ? initialData.contactLastName : "",
    contactTitle: typeof initialData.contactTitle === "string" ? initialData.contactTitle : "",
    entityKind: isOrg ? "ORGANIZATION" : "PERSON",
    organizationCategory:
      initialData.organizationCategory === "CHURCH" || initialData.organizationCategory === "BUSINESS"
        ? initialData.organizationCategory
        : "ORGANIZATION",
    groupMemberships: normalizeGroupMemberships(initialData.groupMemberships),
  };
}

export default function ConstituentForm({ mode, initialData, constituentId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<ConstituentFormData>(() => normalizeInitialData(initialData));
  const [error, setError] = useState<string | null>(null);
  const [groupOptions, setGroupOptions] = useState<ConstituentGroupOption[]>([]);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupCreateName, setGroupCreateName] = useState("");
  const [groupCreateType, setGroupCreateType] = useState<ConstituentGroupOption["groupType"]>("ORGANIZATION");
  const [groupCreateError, setGroupCreateError] = useState<string | null>(null);
  const [groupCreatePending, setGroupCreatePending] = useState(false);

  const isOrganizationRecord = form.entityKind === "ORGANIZATION";

  useEffect(() => {
    setForm(normalizeInitialData(initialData));
  }, [initialData]);

  useEffect(() => {
    let cancelled = false;
    async function loadGroups() {
      setGroupLoading(true);
      try {
        const groups = await apiFetch<ConstituentGroupOption[]>("/api/constituents/groups");
        if (!cancelled) setGroupOptions(Array.isArray(groups) ? groups : []);
      } catch {
        if (!cancelled) setGroupOptions([]);
      } finally {
        if (!cancelled) setGroupLoading(false);
      }
    }
    void loadGroups();
    return () => {
      cancelled = true;
    };
  }, []);

  function set(field: keyof ConstituentFormData, value: string | boolean | GroupMembershipDraft[]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setMembership(index: number, patch: Partial<GroupMembershipDraft>) {
    set("groupMemberships", form.groupMemberships.map((membership, currentIndex) => (
      currentIndex === index ? { ...membership, ...patch } : membership
    )));
  }

  function addMembership(groupId?: string) {
    set("groupMemberships", [
      ...form.groupMemberships,
      { groupId: groupId ?? "", relationshipLabel: "", isPrimary: false },
    ]);
  }

  function removeMembership(index: number) {
    set("groupMemberships", form.groupMemberships.filter((_, currentIndex) => currentIndex !== index));
  }

  async function handleCreateGroup() {
    if (!groupCreateName.trim()) {
      setGroupCreateError("Group name is required.");
      return;
    }
    setGroupCreatePending(true);
    setGroupCreateError(null);
    try {
      const created = await apiFetch<ConstituentGroupOption>("/api/constituents/groups", {
        method: "POST",
        body: JSON.stringify({
          name: groupCreateName.trim(),
          groupType: groupCreateType,
          primaryConstituentId: mode === "edit" ? constituentId : undefined,
        }),
      });
      setGroupOptions((current) => {
        const next = [...current.filter((group) => group.id !== created.id), created];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      addMembership(created.id);
      setGroupCreateName("");
      setGroupCreateType("ORGANIZATION");
    } catch (err) {
      setGroupCreateError(err instanceof Error ? err.message : "Failed to create group.");
    } finally {
      setGroupCreatePending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedMemberships = form.groupMemberships
      .filter((membership) => membership.groupId.trim())
      .map((membership) => ({
        groupId: membership.groupId,
        relationshipLabel: membership.relationshipLabel.trim(),
        isPrimary: membership.isPrimary,
      }));

    const payload = isOrganizationRecord
      ? {
          ...form,
          firstName: "",
          lastName: form.organizationName.trim(),
          displayName: form.organizationName.trim(),
          organizationName: form.organizationName.trim(),
          entityKind: "ORGANIZATION" as const,
          organizationCategory: form.organizationCategory,
          type: form.type === "FOUNDATION" || form.type === "SPONSOR" ? form.type : "ORGANIZATION",
          groupMemberships: normalizedMemberships,
        }
      : {
          ...form,
          displayName: form.displayName.trim() || undefined,
          organizationName: form.organizationName.trim() || undefined,
          entityKind: "PERSON" as const,
          groupMemberships: normalizedMemberships,
        };

    if (isOrganizationRecord && !payload.organizationName) {
      setError("Organization name is required.");
      return;
    }

    if (!isOrganizationRecord && (!form.firstName.trim() || !form.lastName.trim())) {
      setError("First and last name are required for person records.");
      return;
    }

    startTransition(async () => {
      try {
        const path = mode === "create" ? "/api/constituents" : `/api/constituents/${constituentId}`;
        const saved = await apiFetch<{ id: string }>(path, {
          method: mode === "create" ? "POST" : "PUT",
          body: JSON.stringify(payload),
        });
        router.push(`/constituents/${saved.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Identity</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Record Kind">
            <select
              value={form.entityKind}
              onChange={(e) => set("entityKind", e.target.value === "ORGANIZATION" ? "ORGANIZATION" : "PERSON")}
              className={SELECT_CLS}
            >
              <option value="PERSON">Person</option>
              <option value="ORGANIZATION">Organization</option>
            </select>
          </Field>
          <Field label="Constituent Type">
            <select value={form.type} onChange={(e) => set("type", e.target.value)} className={SELECT_CLS}>
              {CONSTITUENT_TYPES.map((type) => (
                <option key={type} value={type}>{type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </Field>
          <Field label="Donor Status">
            <select value={form.donorStatus} onChange={(e) => set("donorStatus", e.target.value)} className={SELECT_CLS}>
              {DONOR_STATUSES.map((status) => (
                <option key={status} value={status}>{status === "MAJOR_DONOR" ? "Major Donor" : status.charAt(0) + status.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </Field>
        </div>

        {isOrganizationRecord ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Organization Name" required>
              <input
                value={form.organizationName}
                onChange={(e) => set("organizationName", e.target.value)}
                className={INPUT_CLS}
                placeholder="Grace Fellowship Church"
              />
            </Field>
            <Field label="Organization Kind">
              <select
                value={form.organizationCategory}
                onChange={(e) => set("organizationCategory", (e.target.value as ConstituentFormData["organizationCategory"]) || "ORGANIZATION")}
                className={SELECT_CLS}
              >
                <option value="ORGANIZATION">Organization</option>
                <option value="CHURCH">Church</option>
                <option value="BUSINESS">Business</option>
              </select>
            </Field>
            <Field label="Contact Title" optional>
              <input
                value={form.contactTitle}
                onChange={(e) => set("contactTitle", e.target.value)}
                className={INPUT_CLS}
                placeholder="Pastor, Office Manager, Owner"
              />
            </Field>
            <Field label="Primary Contact First Name" optional>
              <input
                value={form.contactFirstName}
                onChange={(e) => set("contactFirstName", e.target.value)}
                className={INPUT_CLS}
                placeholder="Rachel"
              />
            </Field>
            <Field label="Primary Contact Last Name" optional>
              <input
                value={form.contactLastName}
                onChange={(e) => set("contactLastName", e.target.value)}
                className={INPUT_CLS}
                placeholder="Moore"
              />
            </Field>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Prefix" optional>
              <select value={form.prefix} onChange={(e) => set("prefix", e.target.value)} className={SELECT_CLS}>
                <option value="">—</option>
                {["Mr.", "Ms.", "Mrs.", "Dr.", "Rev.", "Prof."].map((prefix) => <option key={prefix}>{prefix}</option>)}
              </select>
            </Field>
            <Field label="First Name" required>
              <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={INPUT_CLS} placeholder="First name" />
            </Field>
            <Field label="Last Name" required>
              <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={INPUT_CLS} placeholder="Last name" />
            </Field>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Contact Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="mt-4 flex flex-wrap gap-6">
          {([["doNotEmail", "Do Not Email"], ["doNotCall", "Do Not Call"], ["doNotMail", "Do Not Mail"]] as const).map(([field, label]) => (
            <label key={field} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
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

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Constituent Groups</h2>
            <p className="mt-1 text-xs text-gray-500">Link this record to churches, businesses, or organization groups for shared tracking.</p>
          </div>
          <button
            type="button"
            onClick={() => addMembership()}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Add Link
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {form.groupMemberships.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              No church or organization links yet.
            </div>
          ) : form.groupMemberships.map((membership, index) => (
            <div key={`${membership.groupId || "new"}-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_90px]">
              <Field label="Group">
                <select
                  value={membership.groupId}
                  onChange={(e) => setMembership(index, { groupId: e.target.value })}
                  className={SELECT_CLS}
                >
                  <option value="">{groupLoading ? "Loading groups..." : "Select a group"}</option>
                  {groupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.groupType.toLowerCase()})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Relationship" optional>
                <input
                  value={membership.relationshipLabel}
                  onChange={(e) => setMembership(index, { relationshipLabel: e.target.value })}
                  className={INPUT_CLS}
                  placeholder="Member, staff, contact"
                />
              </Field>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 lg:mt-6">
                <input
                  type="checkbox"
                  checked={membership.isPrimary}
                  onChange={(e) => setMembership(index, { isPrimary: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Primary
              </label>
              <button
                type="button"
                onClick={() => removeMembership(index)}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 lg:mt-6"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <h3 className="text-sm font-semibold text-emerald-950">Create New Group</h3>
          <p className="mt-1 text-xs text-emerald-900/80">Use this when the church or organization does not exist yet.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Group Name">
              <input value={groupCreateName} onChange={(e) => setGroupCreateName(e.target.value)} className={INPUT_CLS} placeholder="Grace Fellowship Church" />
            </Field>
            <Field label="Group Type">
              <select value={groupCreateType} onChange={(e) => setGroupCreateType((e.target.value as ConstituentGroupOption["groupType"]) || "ORGANIZATION")} className={SELECT_CLS}>
                <option value="ORGANIZATION">Organization</option>
                <option value="CHURCH">Church</option>
                <option value="BUSINESS">Business</option>
              </select>
            </Field>
            <div className="sm:pt-6">
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={groupCreatePending}
                className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {groupCreatePending ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
          {groupCreateError ? <p className="mt-2 text-sm text-red-700">{groupCreateError}</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Address</h2>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Address Line 1" optional>
            <input value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} className={INPUT_CLS} placeholder="123 Main St" />
          </Field>
          <Field label="Address Line 2" optional>
            <input value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} className={INPUT_CLS} placeholder="Suite 100" />
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="City" optional>
                <input value={form.city} onChange={(e) => set("city", e.target.value)} className={INPUT_CLS} placeholder="Chicago" />
              </Field>
            </div>
            <Field label="State" optional>
              <select value={form.state} onChange={(e) => set("state", e.target.value)} className={SELECT_CLS}>
                <option value="">—</option>
                {US_STATES.map((state) => <option key={state}>{state}</option>)}
              </select>
            </Field>
            <Field label="ZIP" optional>
              <input value={form.zip} onChange={(e) => set("zip", e.target.value)} className={INPUT_CLS} placeholder="60601" maxLength={10} />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Professional Info</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Employer" optional>
            <input value={form.employer} onChange={(e) => set("employer", e.target.value)} className={INPUT_CLS} placeholder="Company name" />
          </Field>
          <Field label="Occupation" optional>
            <input value={form.occupation} onChange={(e) => set("occupation", e.target.value)} className={INPUT_CLS} placeholder="Job title" />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Notes</h2>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={4}
          className={`${INPUT_CLS} resize-none`}
          placeholder="Internal notes about this constituent..."
        />
      </section>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? "Saving..." : mode === "create" ? "Create Constituent" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

const INPUT_CLS = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500";
const SELECT_CLS = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500";

function Field({ label, required, optional, children }: { label: string; required?: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        {optional ? <span className="ml-1 font-normal text-gray-400">(optional)</span> : null}
      </label>
      {children}
    </div>
  );
}
