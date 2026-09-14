import { z } from "zod";

export const ParsedAlertSchema = z.object({
  roles: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  remotePreference: z
    .enum(["required", "allowed", "not_allowed"])
    .default("allowed"),
  excludeTerms: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
  parseFallback: z.boolean().default(false),
});

export type ParsedAlert = z.infer<typeof ParsedAlertSchema>;

function fakeParser(rawText: string): ParsedAlert {
  const text = rawText.toLowerCase();
  const roles: string[] = [];
  const skills: string[] = [];
  const locations: string[] = [];
  let remotePreference: "required" | "allowed" | "not_allowed" = "allowed";

  const roleKeywords = [
    "frontend", "backend", "fullstack", "full stack", "full-stack",
    "devops", "data engineer", "data scientist", "ml engineer",
    "python developer", "java developer", "react developer",
    "node developer", "software engineer", "software developer",
  ];
  for (const role of roleKeywords) {
    if (text.includes(role)) roles.push(role);
  }

  const skillKeywords = [
    "python", "javascript", "typescript", "react", "next.js",
    "node", "java", "go", "rust", "fastapi", "django",
    "postgres", "postgresql", "mysql", "mongodb", "redis",
    "docker", "kubernetes", "aws", "gcp", "azure",
  ];
  for (const skill of skillKeywords) {
    if (text.includes(skill)) skills.push(skill);
  }

  const locationKeywords = [
    "bengaluru", "bangalore", "mumbai", "delhi", "hyderabad",
    "chennai", "pune", "remote", "new york", "london", "singapore",
  ];
  for (const loc of locationKeywords) {
    if (text.includes(loc)) locations.push(loc);
  }

  if (text.includes("only remote") || text.includes("fully remote") || text.includes("remote only")) {
    remotePreference = "required";
  } else if (text.includes("no remote") || text.includes("onsite only") || text.includes("in office")) {
    remotePreference = "not_allowed";
  } else if (text.includes("remote")) {
    remotePreference = "allowed";
  }

  const excludeTerms: string[] = [];
  const excludePatterns = [
    /no\s+(\w+)/g,
    /without\s+(\w+)/g,
    /exclude\s+(\w+)/g,
    /not\s+(\w+)/g,
  ];
  for (const pattern of excludePatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      if (match[1]) excludeTerms.push(match[1]);
    }
  }

  return {
    roles,
    skills,
    locations,
    remotePreference,
    excludeTerms,
    unknowns: [],
    parseFallback: false,
  };
}

export async function parseAlertText(rawText: string): Promise<ParsedAlert> {
  const provider = process.env.LLM_PROVIDER ?? "fake";

  if (provider === "fake") {
    const raw = fakeParser(rawText);
    return ParsedAlertSchema.parse(raw);
  }

  throw new Error(`LLM provider "${provider}" not implemented yet`);
}