// Saved jobs on the phone (src/core/jobs.ts holds the rules). One provider; every change is written straight away.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { addCalc, createJob, deleteJob, JOBS_KEY, newId, parseJobs, removeCalc, renameJob, type Job, type SavedCalc } from '../core/jobs.ts';
import type { ToolId } from '../core/tools.ts';

type Ctx = {
  jobs: Job[];
  loaded: boolean;
  create: (name: string) => Job;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  save: (jobId: string, c: { tool: ToolId; title: string; summary: string; inputs: Record<string, string> }) => void;
  removeCalc: (jobId: string, calcId: string) => void;
  findCalc: (calcId: string) => SavedCalc | undefined;
};

const JobsContext = createContext<Ctx | null>(null);

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(JOBS_KEY)
      .then((raw) => setJobs(parseJobs(raw)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  const commit = useCallback((fn: (j: Job[]) => Job[]) => {
    setJobs((prev) => {
      const next = fn(prev);
      AsyncStorage.setItem(JOBS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const value = useMemo<Ctx>(
    () => ({
      jobs,
      loaded,
      create: (name) => {
        const made = createJob(jobs, name, Date.now());
        commit(() => made.jobs);
        return made.job;
      },
      rename: (id, name) => commit((j) => renameJob(j, id, name)),
      remove: (id) => commit((j) => deleteJob(j, id)),
      save: (jobId, c) => commit((j) => addCalc(j, jobId, { id: newId(Date.now()), savedAt: Date.now(), ...c })),
      removeCalc: (jobId, calcId) => commit((j) => removeCalc(j, jobId, calcId)),
      findCalc: (calcId) => {
        for (const j of jobs) for (const c of j.calcs) if (c.id === calcId) return c;
        return undefined;
      },
    }),
    [jobs, loaded, commit],
  );
  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs(): Ctx {
  const c = useContext(JobsContext);
  if (!c) throw new Error('useJobs outside JobsProvider');
  return c;
}
