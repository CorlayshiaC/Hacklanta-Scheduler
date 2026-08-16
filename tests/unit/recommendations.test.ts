import { describe, expect, it } from "vitest";
import { recommendCandidates, windowsOverlap, type CandidateInput } from "@/lib/scheduling/recommendations";

const operationsRoleId = "33333333-3333-4333-8333-333333333333";
const targetShift = {
  id: "44444444-4444-4444-8444-444444444444",
  startsAt: "2026-10-10T14:00:00.000Z",
  endsAt: "2026-10-10T18:00:00.000Z",
};

function candidate(overrides: Partial<CandidateInput> = {}): CandidateInput {
  return {
    profile: {
      id: "11111111-1111-4111-8111-111111111111",
      fullName: "Alex Admin",
      email: "alex@example.com",
      isActive: true,
    },
    coverageRoleIds: [operationsRoleId],
    settings: { maxHours: 12, minimumBreakMinutes: 30 },
    availabilityWindows: [
      {
        profileId: "11111111-1111-4111-8111-111111111111",
        startsAt: "2026-10-10T13:00:00.000Z",
        endsAt: "2026-10-10T20:00:00.000Z",
      },
    ],
    assignments: [],
    ...overrides,
  };
}

describe("candidate recommendations", () => {
  it("treats adjacent windows as non-overlapping and true intersections as overlapping", () => {
    expect(
      windowsOverlap(targetShift, {
        id: "55555555-5555-4555-8555-555555555555",
        startsAt: "2026-10-10T18:00:00.000Z",
        endsAt: "2026-10-10T20:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      windowsOverlap(targetShift, {
        id: "66666666-6666-4666-8666-666666666666",
        startsAt: "2026-10-10T17:59:00.000Z",
        endsAt: "2026-10-10T20:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("rejects inactive, unavailable, role-mismatched, overlapping, max-hour, and break violations", () => {
    const result = recommendCandidates({
      shift: targetShift,
      coverageRoleId: operationsRoleId,
      candidates: [
        candidate({
          profile: {
            id: "11111111-1111-4111-8111-111111111111",
            fullName: "Inactive",
            email: "inactive@example.com",
            isActive: false,
          },
        }),
        candidate({
          profile: {
            id: "22222222-2222-4222-8222-222222222222",
            fullName: "Unavailable",
            email: "unavailable@example.com",
            isActive: true,
          },
          availabilityWindows: [],
        }),
        candidate({
          profile: {
            id: "33333333-3333-4333-8333-333333333333",
            fullName: "Wrong Role",
            email: "wrong@example.com",
            isActive: true,
          },
          coverageRoleIds: [],
        }),
        candidate({
          profile: {
            id: "44444444-4444-4444-8444-444444444444",
            fullName: "Overlap",
            email: "overlap@example.com",
            isActive: true,
          },
          assignments: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              profileId: "44444444-4444-4444-8444-444444444444",
              shiftId: "77777777-7777-4777-8777-777777777777",
              startsAt: "2026-10-10T16:00:00.000Z",
              endsAt: "2026-10-10T19:00:00.000Z",
              status: "draft",
            },
          ],
        }),
        candidate({
          profile: {
            id: "55555555-5555-4555-8555-555555555555",
            fullName: "Maxed",
            email: "maxed@example.com",
            isActive: true,
          },
          settings: { maxHours: 5, minimumBreakMinutes: 0 },
          assignments: [
            {
              id: "88888888-8888-4888-8888-888888888888",
              profileId: "55555555-5555-4555-8555-555555555555",
              shiftId: "88888888-8888-4888-8888-888888888888",
              startsAt: "2026-10-09T12:00:00.000Z",
              endsAt: "2026-10-09T15:00:00.000Z",
              status: "published",
            },
          ],
        }),
        candidate({
          profile: {
            id: "66666666-6666-4666-8666-666666666666",
            fullName: "Too Soon",
            email: "break@example.com",
            isActive: true,
          },
          settings: { maxHours: 12, minimumBreakMinutes: 90 },
          assignments: [
            {
              id: "99999999-9999-4999-8999-999999999999",
              profileId: "66666666-6666-4666-8666-666666666666",
              shiftId: "99999999-9999-4999-8999-999999999999",
              startsAt: "2026-10-10T11:00:00.000Z",
              endsAt: "2026-10-10T13:00:00.000Z",
              status: "draft",
            },
          ],
        }),
      ],
    });

    expect(result.recommendations).toHaveLength(0);
    expect(result.rejections.map((rejection) => rejection.reason)).toEqual([
      "Inactive member.",
      "Not available for the entire shift.",
      "Missing required coverage role.",
      "Overlaps an existing assignment.",
      "Assignment would exceed maximum hours.",
      "Assignment would violate minimum break.",
    ]);
  });

  it("ranks lower assigned hours ahead of otherwise eligible members", () => {
    const rested = candidate({
      profile: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        fullName: "Rested Member",
        email: "rested@example.com",
        isActive: true,
      },
    });
    const busier = candidate({
      profile: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        fullName: "Busier Member",
        email: "busier@example.com",
        isActive: true,
      },
      assignments: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          profileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          shiftId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          startsAt: "2026-10-09T12:00:00.000Z",
          endsAt: "2026-10-09T16:00:00.000Z",
          status: "draft",
        },
      ],
    });

    const result = recommendCandidates({
      shift: targetShift,
      coverageRoleId: operationsRoleId,
      candidates: [busier, rested],
    });

    expect(result.recommendations.map((recommendation) => recommendation.fullName)).toEqual([
      "Rested Member",
      "Busier Member",
    ]);
    expect(result.recommendations[0]?.reasons).toEqual(
      expect.arrayContaining([
        "Available for entire shift",
        "Has required coverage role",
        "0.0 assigned hours",
      ]),
    );
  });
});
