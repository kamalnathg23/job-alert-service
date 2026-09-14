import { Alert, Job } from "@prisma/client";
import { normalize, normalizeArr, containsWholeWord } from "./normalize";

export interface MatchResult {
  matched: boolean;
  score: number;
  reasons: string[];
}

/**
 * Deterministic matcher — NO AI in this function.
 * Takes one alert and one job, returns a match result.
 */
export function matchJobToAlert(alert: Alert, job: Job): MatchResult {
  const reasons: string[] = [];
  let score = 0;

  const jobText = normalize(
    `${job.title} ${job.company} ${job.description}`
  );

    // ── 1. Exclude terms check ─────────────────────────────────────────────
  const normalizedExcludes = normalizeArr(alert.excludeTerms);
  for (const term of normalizedExcludes) {
    if (containsWholeWord(jobText, term)) {
      return { matched: false, score: 0, reasons: [`excluded: "${term}"`] };
    }
  }


  // ── 2. Role matching ───────────────────────────────────────────────────
  const normalizedRoles = normalizeArr(alert.roles);
  if (normalizedRoles.length > 0) {
    const matchedRoles = normalizedRoles.filter((role) =>
      containsWholeWord(jobText, role)
    );
    if (matchedRoles.length === 0) {
      return { matched: false, score: 0, reasons: ["no role match"] };
    }
    score += matchedRoles.length * 10;
    reasons.push(`roles matched: ${matchedRoles.join(", ")}`);
  }

    // ── 3. Skills matching ─────────────────────────────────────────────────
  const normalizedAlertSkills = normalizeArr(alert.skills);
  const normalizedJobSkills = normalizeArr(job.skills);

  if (normalizedAlertSkills.length > 0) {
    const matchedSkills = normalizedAlertSkills.filter(
      (skill) =>
        normalizedJobSkills.includes(skill) ||
        containsWholeWord(jobText, skill)
    );
    if (matchedSkills.length === 0) {
      return { matched: false, score: 0, reasons: ["no skill match"] };
    }
    score += matchedSkills.length * 5;
    reasons.push(`skills matched: ${matchedSkills.join(", ")}`);
  }

  // ── 4. Location matching ───────────────────────────────────────────────
  const normalizedLocations = normalizeArr(alert.locations);
  const normalizedJobLocation = normalize(job.location);

  if (normalizedLocations.length > 0) {
    const remoteOk =
      alert.remotePreference !== "not_allowed" && job.remote === true;

    const locationMatch = normalizedLocations.some(
      (loc) =>
        normalizedJobLocation.includes(loc) ||
        loc.includes(normalizedJobLocation)
    );

    if (!remoteOk && !locationMatch) {
      return { matched: false, score: 0, reasons: ["location mismatch"] };
    }

    if (remoteOk) {
      score += 5;
      reasons.push("remote allowed");
    }
    if (locationMatch) {
      score += 10;
      reasons.push(`location matched: ${normalizedJobLocation}`);
    }
  }

   // ── 5. Remote preference ───────────────────────────────────────────────
  if (alert.remotePreference === "required" && job.remote === false) {
    return {
      matched: false,
      score: 0,
      reasons: ["remote required but job is not remote"],
    };
  } 
    // ── Passed all checks ──────────────────────────────────────────────────
  return {
    matched: true,
    score,
    reasons,
  };
}