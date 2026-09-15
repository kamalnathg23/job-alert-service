"use client";
import { useState } from "react";
import styles from "./page.module.css";

type Tab = "create" | "dashboard";

interface Match {
  alertId: string;
  jobId: string;
  score: number;
  reasons: string[];
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  skills: string[];
  createdAt: string;
}

interface ParsedFilters {
  roles: string[];
  skills: string[];
  locations: string[];
  remotePreference: string;
  excludeTerms: string[];
}

interface Alert {
  id: string;
  rawText: string;
  parsedFilters: ParsedFilters;
  parseFallback: boolean;
  createdAt: string;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("create");

  // Create alert state
  const [userId, setUserId] = useState("user-001");
  const [rawText, setRawText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdAlert, setCreatedAlert] = useState<Alert | null>(null);
  const [createError, setCreateError] = useState("");

  // Dashboard state
  const [matches, setMatches] = useState<Match[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [outboxResult, setOutboxResult] = useState<{sent:number;failed:number;skipped:number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchSkills, setSearchSkills] = useState("python");
  const [searchSource, setSearchSource] = useState("");

  async function createAlert() {
    if (!rawText.trim()) return;
    setCreating(true);
    setCreateError("");
    setCreatedAlert(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, rawText }),
      });
      const data = await res.json();
      if (data.ok) {
        setCreatedAlert(data.alert);
        setRawText("");
      } else {
        setCreateError(data.error ?? "Failed to create alert");
      }
    } catch {
      setCreateError("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function runMatcher() {
    setLoading(true);
    const res = await fetch("/api/alerts/match", { method: "POST" });
    const data = await res.json();
    setMatches(data.matches ?? []);
    setLoading(false);
  }

  async function searchJobs() {
    setLoading(true);
    const res = await fetch(`/api/jobs/search?skills=${searchSkills}`);
    const data = await res.json();
    setJobs(data.jobs ?? []);
    setSearchSource(data.source ?? "");
    setLoading(false);
  }

  async function processOutbox() {
    setLoading(true);
    const res = await fetch("/api/outbox", { method: "POST" });
    const data = await res.json();
    setOutboxResult({ sent: data.sent, failed: data.failed, skipped: data.skipped });
    setLoading(false);
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.logo}>⚡ job alerts</span>
          <nav className={styles.tabs}>
            <button
              className={tab === "create" ? styles.tabActive : styles.tab}
              onClick={() => setTab("create")}
            >
              Create alert
            </button>
            <button
              className={tab === "dashboard" ? styles.tabActive : styles.tab}
              onClick={() => setTab("dashboard")}
            >
              Dashboard
            </button>
          </nav>
        </div>
      </header>

      {tab === "create" && (
        <section className={styles.section}>
          <div className={styles.createCard}>
            <h1 className={styles.heading}>What kind of job are you looking for?</h1>
            <p className={styles.sub}>Describe it in plain English — we'll extract the filters.</p>

            <div className={styles.field}>
              <label className={styles.label}>User ID</label>
              <input
                className={styles.input}
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="user-001"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Describe the role</label>
              <textarea
                className={styles.textarea}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="e.g. Remote Python developer in Bengaluru, no blockchain, fastapi preferred"
                rows={4}
              />
            </div>

            <button
              className={styles.btn}
              onClick={createAlert}
              disabled={creating || !rawText.trim()}
            >
              {creating ? "Parsing…" : "Save alert"}
            </button>

            {createError && <p className={styles.error}>{createError}</p>}

            {createdAlert && (
              <div className={styles.result}>
                <p className={styles.resultTitle}>Alert saved</p>
                <div className={styles.filters}>
                  <Filter label="Roles" values={createdAlert.parsedFilters.roles} />
                  <Filter label="Skills" values={createdAlert.parsedFilters.skills} />
                  <Filter label="Locations" values={createdAlert.parsedFilters.locations} />
                  <Filter label="Remote" values={[createdAlert.parsedFilters.remotePreference]} />
                  {createdAlert.parsedFilters.excludeTerms.length > 0 && (
                    <Filter label="Excluded" values={createdAlert.parsedFilters.excludeTerms} danger />
                  )}
                </div>
                <p className={styles.alertId}>ID: {createdAlert.id}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "dashboard" && (
        <section className={styles.section}>
          <div className={styles.dashGrid}>

            {/* Job Search */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Job search</h2>
              <div className={styles.row}>
                <input
                  className={styles.input}
                  value={searchSkills}
                  onChange={e => setSearchSkills(e.target.value)}
                  placeholder="skills (comma separated)"
                />
                <button className={styles.btnSm} onClick={searchJobs} disabled={loading}>
                  Search
                </button>
              </div>
              {searchSource && (
                <span className={searchSource === "cache" ? styles.badgeGreen : styles.badgeBlue}>
                  source: {searchSource}
                </span>
              )}
              <div className={styles.list}>
                {jobs.map(job => (
                  <div key={job.id} className={styles.jobRow}>
                    <div>
                      <p className={styles.jobTitle}>{job.title}</p>
                      <p className={styles.jobMeta}>{job.company} · {job.location} {job.remote && "· remote"}</p>
                    </div>
                    <div className={styles.skillPills}>
                      {job.skills.map(s => <span key={s} className={styles.pill}>{s}</span>)}
                    </div>
                  </div>
                ))}
                {jobs.length === 0 && <p className={styles.empty}>No results yet</p>}
              </div>
            </div>

            {/* Matcher */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Matches</h2>
              <button className={styles.btnSm} onClick={runMatcher} disabled={loading}>
                Run matcher
              </button>
              <div className={styles.list}>
                {matches.map((m, i) => (
                  <div key={i} className={styles.matchRow}>
                    <div className={styles.matchScore}>{m.score}</div>
                    <div>
                      <p className={styles.matchId}>Alert {m.alertId.slice(0, 8)}…</p>
                      <div className={styles.reasons}>
                        {m.reasons.map((r, j) => <span key={j} className={styles.reason}>{r}</span>)}
                      </div>
                    </div>
                  </div>
                ))}
                {matches.length === 0 && <p className={styles.empty}>Run matcher to see results</p>}
              </div>
            </div>

            {/* Outbox */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Notification outbox</h2>
              <button className={styles.btnSm} onClick={processOutbox} disabled={loading}>
                Process outbox
              </button>
              {outboxResult && (
                <div className={styles.outboxStats}>
                  <Stat label="Sent" value={outboxResult.sent} color="green" />
                  <Stat label="Failed" value={outboxResult.failed} color="red" />
                  <Stat label="Retrying" value={outboxResult.skipped} color="amber" />
                </div>
              )}
              {!outboxResult && <p className={styles.empty}>No runs yet</p>}
            </div>

          </div>
        </section>
      )}
    </main>
  );
}

function Filter({ label, values, danger }: { label: string; values: string[]; danger?: boolean }) {
  if (!values.length) return null;
  return (
    <div className={styles.filterRow}>
      <span className={styles.filterLabel}>{label}</span>
      <div className={styles.pillRow}>
        {values.map(v => (
          <span key={v} className={danger ? styles.pillDanger : styles.pill}>{v}</span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles[`stat_${color}`]}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
