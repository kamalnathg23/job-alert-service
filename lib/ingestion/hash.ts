import { createHash } from "crypto";

export interface StableJobContent{
    title : string;
    company: string;
    description: string;
    location: string;
    remote: boolean;
    skills: string[];

}

/**
 * Produces a deterministic SHA-256 hash of stable job content.
 * Volatile fields (observedAt, sourceFileDate) are intentionally excluded.
 * Skills array is sorted before hashing so order doesn't matter.
 */

export function computeContentHash(job: StableJobContent): string {
      const normalized = {
    title: job.title.trim().toLowerCase(),
    company: job.company.trim().toLowerCase(),
    description: job.description.trim().toLowerCase(),
    location: job.location.trim().toLowerCase(),
    remote: job.remote,
    skills: [...job.skills].map((s) => s.trim().toLowerCase()).sort(),
  };
//remove the letter, white spaqcing

 return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");

}