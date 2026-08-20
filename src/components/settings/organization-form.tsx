"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { PillButton } from "@/components/ui/neu-button";
import { NeuInput as TextInput } from "@/components/ui/neu-input";
import { NeuSelect } from "@/components/ui/neu-select";

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

const FIELD_LABEL = "text-[11px] text-text-secondary";

const PUBLIC_NAME_DISPLAY_OPTIONS = [
  { label: "Full name", value: "full_name" },
  { label: "First name", value: "first_name" },
  { label: "Initials", value: "initials" },
];

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
        <label className={FIELD_LABEL} htmlFor="org-name">
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
        <label className={FIELD_LABEL} htmlFor="org-shift-buffer">
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
          <label className={FIELD_LABEL} htmlFor="org-semester-start">
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
          <label className={FIELD_LABEL} htmlFor="org-semester-end">
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
        <span className={FIELD_LABEL}>Public page name display</span>
        <NeuSelect
          className="w-fit"
          onValueChange={(value) =>
            setValues((v) => ({
              ...v,
              publicNameDisplay: value as OrgSettingsValues["publicNameDisplay"],
            }))
          }
          options={PUBLIC_NAME_DISPLAY_OPTIONS}
          value={values.publicNameDisplay}
        />
        <p className="mt-1 text-xs text-text-secondary">
          Controls how assignee names appear on public schedule pages (/s/[token]).
        </p>
      </div>

      {error ? <p className="text-[13px] text-accent-warn">{error}</p> : null}
      {saved && !error ? <p className="text-[13px] text-accent-primary-glow">Saved.</p> : null}

      <div>
        <PillButton disabled={isSaving} type="submit" variant="primary">
          {isSaving ? "Saving..." : "Save changes"}
        </PillButton>
      </div>
    </form>
  );
}
