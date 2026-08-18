"use client";

import { useState } from "react";
import type { FormEvent } from "react";
// STUB(agent-1): replace with the real primitives once components/ui publishes it.
import { FilterPillSelect, PillButton, TextInput } from "@/components/settings/_stub-primitives";

export type OrgSettingsValues = {
  orgName: string;
  defaultShiftBufferMinutes: number;
  semesterStartsOn: string | null;
  semesterEndsOn: string | null;
  publicNameDisplay: "full_name" | "first_name" | "initials";
};

type OrganizationFormProps = {
  initialValues: OrgSettingsValues;
  onSave: (formData: FormData) => Promise<void>;
};

export function OrganizationForm({ initialValues, onSave }: OrganizationFormProps) {
  const [values, setValues] = useState(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSaving(true);

    const formData = new FormData();
    formData.set("orgName", values.orgName);
    formData.set("defaultShiftBufferMinutes", String(values.defaultShiftBufferMinutes));
    formData.set("semesterStartsOn", values.semesterStartsOn ?? "");
    formData.set("semesterEndsOn", values.semesterEndsOn ?? "");
    formData.set("publicNameDisplay", values.publicNameDisplay);

    try {
      await onSave(formData);
      setSaved(true);
    } catch {
      setError("Could not save organization settings. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]" htmlFor="org-name">
          Organization name
        </label>
        <TextInput
          id="org-name"
          maxLength={120}
          onChange={(event) => setValues((v) => ({ ...v, orgName: event.target.value }))}
          type="text"
          value={values.orgName}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]" htmlFor="org-shift-buffer">
          Default shift buffer in minutes
        </label>
        <TextInput
          id="org-shift-buffer"
          min={0}
          onChange={(event) =>
            setValues((v) => ({ ...v, defaultShiftBufferMinutes: Number(event.target.value) }))
          }
          type="number"
          value={values.defaultShiftBufferMinutes}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]" htmlFor="org-semester-start">
            Semester start
          </label>
          <TextInput
            id="org-semester-start"
            onChange={(event) => setValues((v) => ({ ...v, semesterStartsOn: event.target.value || null }))}
            type="date"
            value={values.semesterStartsOn ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]" htmlFor="org-semester-end">
            Semester end
          </label>
          <TextInput
            id="org-semester-end"
            onChange={(event) => setValues((v) => ({ ...v, semesterEndsOn: event.target.value || null }))}
            type="date"
            value={values.semesterEndsOn ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]">Public page name display</span>
        <FilterPillSelect
          className="w-fit"
          id="org-public-name-display"
          label="Show"
          onChange={(event) =>
            setValues((v) => ({
              ...v,
              publicNameDisplay: event.target.value as OrgSettingsValues["publicNameDisplay"],
            }))
          }
          value={values.publicNameDisplay}
        >
          <option value="full_name">Full name</option>
          <option value="first_name">First name</option>
          <option value="initials">Initials</option>
        </FilterPillSelect>
        <p className="mt-1 text-xs text-[#5E5E5E]">
          Controls how assignee names appear on public schedule pages (/s/[token]).
        </p>
      </div>

      {error ? <p className="text-sm text-[#FF9F2E]">{error}</p> : null}
      {saved && !error ? <p className="text-sm text-[#A78BFA]">Saved.</p> : null}

      <div>
        <PillButton disabled={isSaving} type="submit" variant="primary">
          {isSaving ? "Saving..." : "Save changes"}
        </PillButton>
      </div>
    </form>
  );
}
