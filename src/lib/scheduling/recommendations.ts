import { differenceInHours } from "@/lib/availability/time";

export type CandidateProfile = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
};

export type CandidateSettings = {
  maxHours: number;
  minimumBreakMinutes: number;
};

export type CandidateShift = {
  id: string;
  startsAt: string;
  endsAt: string;
};

export type CandidateAssignment = {
  id: string;
  profileId: string;
  shiftId: string;
  startsAt: string;
  endsAt: string;
  status: "draft" | "published" | "removed";
};

export type CandidateAvailabilityWindow = {
  profileId: string;
  startsAt: string;
  endsAt: string;
};

export type CandidateInput = {
  profile: CandidateProfile;
  coverageRoleIds: string[];
  settings: CandidateSettings | null;
  availabilityWindows: CandidateAvailabilityWindow[];
  assignments: CandidateAssignment[];
};

export type CandidateRecommendation = {
  profileId: string;
  fullName: string;
  email: string;
  coverageRoleId: string | null;
  assignedHours: number;
  remainingHours: number | null;
  breakSincePreviousMinutes: number | null;
  availabilityBufferMinutes: number;
  reasons: string[];
  score: number;
};

export type CandidateRejection = {
  profileId: string;
  fullName: string;
  reason: string;
};

export function windowsOverlap(a: CandidateShift, b: CandidateShift): boolean {
  return new Date(a.startsAt).getTime() < new Date(b.endsAt).getTime()
    && new Date(a.endsAt).getTime() > new Date(b.startsAt).getTime();
}

function hasAvailabilityForEntireShift(input: {
  shift: CandidateShift;
  availabilityWindows: CandidateAvailabilityWindow[];
}) {
  const shiftStart = new Date(input.shift.startsAt).getTime();
  const shiftEnd = new Date(input.shift.endsAt).getTime();

  return input.availabilityWindows.some(
    (window) =>
      new Date(window.startsAt).getTime() <= shiftStart
      && new Date(window.endsAt).getTime() >= shiftEnd,
  );
}

function availabilityBufferMinutes(input: {
  shift: CandidateShift;
  availabilityWindows: CandidateAvailabilityWindow[];
}) {
  const shiftStart = new Date(input.shift.startsAt).getTime();
  const shiftEnd = new Date(input.shift.endsAt).getTime();
  const covering = input.availabilityWindows.filter(
    (window) =>
      new Date(window.startsAt).getTime() <= shiftStart
      && new Date(window.endsAt).getTime() >= shiftEnd,
  );

  if (covering.length === 0) {
    return 0;
  }

  return Math.max(
    ...covering.map((window) => {
      const startBuffer = shiftStart - new Date(window.startsAt).getTime();
      const endBuffer = new Date(window.endsAt).getTime() - shiftEnd;
      return Math.floor((startBuffer + endBuffer) / (1000 * 60));
    }),
  );
}

function assignedHours(assignments: CandidateAssignment[]): number {
  return assignments
    .filter((assignment) => assignment.status === "draft" || assignment.status === "published")
    .reduce((total, assignment) => total + differenceInHours(assignment.startsAt, assignment.endsAt), 0);
}

function breakSincePreviousMinutes(input: {
  shift: CandidateShift;
  assignments: CandidateAssignment[];
}) {
  const shiftStart = new Date(input.shift.startsAt).getTime();
  const previous = input.assignments
    .filter((assignment) => assignment.status === "draft" || assignment.status === "published")
    .filter((assignment) => new Date(assignment.endsAt).getTime() <= shiftStart)
    .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime())[0];

  if (!previous) {
    return null;
  }

  return Math.floor((shiftStart - new Date(previous.endsAt).getTime()) / (1000 * 60));
}

export function recommendCandidates(input: {
  shift: CandidateShift;
  coverageRoleId: string | null;
  candidates: CandidateInput[];
}) {
  const shiftHours = differenceInHours(input.shift.startsAt, input.shift.endsAt);
  const recommendations: CandidateRecommendation[] = [];
  const rejections: CandidateRejection[] = [];

  for (const candidate of input.candidates) {
    const activeAssignments = candidate.assignments.filter(
      (assignment) => assignment.status === "draft" || assignment.status === "published",
    );

    if (!candidate.profile.isActive) {
      rejections.push({ profileId: candidate.profile.id, fullName: candidate.profile.fullName, reason: "Inactive member." });
      continue;
    }

    if (input.coverageRoleId && !candidate.coverageRoleIds.includes(input.coverageRoleId)) {
      rejections.push({ profileId: candidate.profile.id, fullName: candidate.profile.fullName, reason: "Missing required coverage role." });
      continue;
    }

    if (!hasAvailabilityForEntireShift({ shift: input.shift, availabilityWindows: candidate.availabilityWindows })) {
      rejections.push({ profileId: candidate.profile.id, fullName: candidate.profile.fullName, reason: "Not available for the entire shift." });
      continue;
    }

    if (activeAssignments.some((assignment) => windowsOverlap(input.shift, assignment))) {
      rejections.push({ profileId: candidate.profile.id, fullName: candidate.profile.fullName, reason: "Overlaps an existing assignment." });
      continue;
    }

    const currentAssignedHours = assignedHours(activeAssignments);
    const maxHours = candidate.settings?.maxHours ?? null;
    const remainingHours = maxHours === null ? null : maxHours - currentAssignedHours - shiftHours;

    if (remainingHours !== null && remainingHours < 0) {
      rejections.push({ profileId: candidate.profile.id, fullName: candidate.profile.fullName, reason: "Assignment would exceed maximum hours." });
      continue;
    }

    const breakMinutes = breakSincePreviousMinutes({ shift: input.shift, assignments: activeAssignments });
    const minimumBreakMinutes = candidate.settings?.minimumBreakMinutes ?? 0;

    if (breakMinutes !== null && breakMinutes < minimumBreakMinutes) {
      rejections.push({ profileId: candidate.profile.id, fullName: candidate.profile.fullName, reason: "Assignment would violate minimum break." });
      continue;
    }

    const bufferMinutes = availabilityBufferMinutes({
      shift: input.shift,
      availabilityWindows: candidate.availabilityWindows,
    });
    const score =
      currentAssignedHours * -1000
      + (remainingHours ?? 100) * 100
      + (breakMinutes ?? 24 * 60)
      + bufferMinutes / 10;

    recommendations.push({
      profileId: candidate.profile.id,
      fullName: candidate.profile.fullName || candidate.profile.email,
      email: candidate.profile.email,
      coverageRoleId: input.coverageRoleId,
      assignedHours: currentAssignedHours,
      remainingHours,
      breakSincePreviousMinutes: breakMinutes,
      availabilityBufferMinutes: bufferMinutes,
      reasons: [
        "Available for entire shift",
        input.coverageRoleId ? "Has required coverage role" : "Eligible for general coverage",
        `${currentAssignedHours.toFixed(1)} assigned hours`,
        remainingHours === null
          ? "No maximum hours configured"
          : `${remainingHours.toFixed(1)} hours remaining under max`,
        breakMinutes === null ? "No previous assignment" : `${Math.floor(breakMinutes / 60)}h ${breakMinutes % 60}m break since previous shift`,
      ],
      score,
    });
  }

  recommendations.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.fullName.localeCompare(b.fullName) || a.profileId.localeCompare(b.profileId);
  });

  return { recommendations, rejections };
}
