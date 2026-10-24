// Parsed pattern for a project, in the user's preferred terms, cached by text.
import { useMemo } from 'react';
import { findCountIssues, parsePattern, type ParsedPattern, type StepIssue } from '../core/pattern';
import type { Project } from '../core/model';
import { convertTerms, type Terms } from '../core/terms';

export interface PatternView extends ParsedPattern {
  issues: Map<number, StepIssue>;
  /** Display text for a step in the reader's terms. */
  show: (s: string) => string;
  shown: Terms;
}

export function usePattern(p: Project | undefined, terms: Terms): PatternView | null {
  const text = p?.pattern?.text;
  const src = p?.pattern?.terms ?? 'US';
  return useMemo(() => {
    if (!text) return null;
    const parsed = parsePattern(text);
    // Count check runs on the US text (the checker speaks sc/inc/dec).
    const usSteps = src === 'US' ? parsed.steps : parsePattern(convertTerms(text, 'UK', 'US')).steps;
    const issues = new Map(findCountIssues(usSteps).map((i) => [i.i, i] as const));
    const show = (s: string) => convertTerms(s, src, terms);
    return { ...parsed, issues, show, shown: terms };
  }, [text, src, terms]);
}
