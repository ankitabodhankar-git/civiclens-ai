import { CivicIssue } from '../types.ts';

export interface SlaDetails {
  targetAt: Date;
  status: 'On Track' | 'At Risk' | 'Overdue' | 'Resolved';
  remainingOrOverdueText: string;
  resolvedWithinSla?: boolean;
}

/**
 * Calculates prototype advisory SLA targets:
 * - Critical: 12 hours
 * - High: 24 hours
 * - Medium: 72 hours (3 working days)
 * - Low: 168 hours (7 working days)
 */
export function calculateSlaTarget(createdAtIso: string, severity: string, urgency?: string): { targetAt: Date; durationHours: number } {
  const createdDate = new Date(createdAtIso || Date.now());
  let durationHours = 72; // default Medium

  const s = severity?.toLowerCase();
  const u = urgency?.toLowerCase();

  if (s === 'critical' || u === 'critical') {
    durationHours = 12;
  } else if (s === 'high' || u === 'high') {
    durationHours = 24;
  } else if (s === 'medium' || u === 'medium') {
    durationHours = 72;
  } else if (s === 'low' || u === 'low') {
    durationHours = 168;
  }

  const targetAt = new Date(createdDate.getTime() + durationHours * 60 * 60 * 1000);
  return { targetAt, durationHours };
}

/**
 * Evaluates current SLA performance status for a civic issue
 */
export function getSlaDetails(issue: CivicIssue): SlaDetails {
  const { targetAt, durationHours } = calculateSlaTarget(issue.createdAt, issue.severity, issue.urgency);
  const now = new Date();

  // If issue is resolved
  if (issue.status === 'Resolved') {
    const resolvedTime = new Date(issue.resolvedAt || issue.updatedAt || Date.now());
    const within = resolvedTime.getTime() <= targetAt.getTime();
    return {
      targetAt,
      status: 'Resolved',
      resolvedWithinSla: within,
      remainingOrOverdueText: within ? 'Resolved within SLA' : 'Resolved after SLA',
    };
  }

  // If issue is unresolved (Open or In Progress)
  const diffMs = targetAt.getTime() - now.getTime();

  if (diffMs < 0) {
    const overdueHours = Math.abs(Math.round(diffMs / (1000 * 60 * 60)));
    return {
      targetAt,
      status: 'Overdue',
      remainingOrOverdueText: overdueHours < 1 ? '< 1 hour overdue' : `${overdueHours} hour${overdueHours > 1 ? 's' : ''} overdue`,
    };
  }

  const remainingHours = Math.round(diffMs / (1000 * 60 * 60));
  const totalWindowMs = durationHours * 60 * 60 * 1000;
  const fractionRemaining = diffMs / totalWindowMs;

  // At Risk if less than 25% of SLA window is remaining
  const isAtRisk = fractionRemaining <= 0.25;

  return {
    targetAt,
    status: isAtRisk ? 'At Risk' : 'On Track',
    remainingOrOverdueText: remainingHours < 1 ? '< 1 hour remaining' : `${remainingHours} hour${remainingHours > 1 ? 's' : ''} remaining`,
  };
}

/**
 * Identifies possible related or recurring reports based on location tokens,
 * category, and descriptive keyword similarity.
 */
export function findRelatedIssues(
  targetIssue: CivicIssue,
  allIssues: CivicIssue[]
): {
  relatedIssues: CivicIssue[];
  commonCategory?: string;
  commonLocation?: string;
} {
  if (!allIssues || allIssues.length <= 1) {
    return { relatedIssues: [] };
  }

  // Extract meaningful location tokens from target location
  const stopWords = new Set([
    'near', 'road', 'street', 'avenue', 'gate', 'opposite', 'behind',
    'front', 'junction', 'corner', 'sector', 'block', 'ward', 'lane',
    'main', 'central', 'west', 'east', 'north', 'south', 'pune', 'city'
  ]);

  const targetTokens = (targetIssue.location || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 4 && !stopWords.has(tok));

  // Extract key topic words from title
  const titleTokens = (targetIssue.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 4);

  const matched = allIssues.filter((other) => {
    if (other.issueId === targetIssue.issueId) return false;

    // Must be same category or related category
    const sameCategory = other.category === targetIssue.category;

    // Check location overlap
    const otherLoc = (other.location || '').toLowerCase();
    const hasLocationTokenMatch = targetTokens.some((tok) => otherLoc.includes(tok));

    // Check direct location substring match if specific
    const directLocMatch =
      (targetIssue.location && other.location && targetIssue.location.toLowerCase().includes(other.location.toLowerCase())) ||
      (other.location && targetIssue.location && other.location.toLowerCase().includes(targetIssue.location.toLowerCase()));

    // Check topic overlap (e.g. pothole, streetlight, pipeline, garbage, pedestrian)
    const otherTitle = (other.title || '').toLowerCase();
    const hasTitleTokenMatch = titleTokens.some((tok) => otherTitle.includes(tok));

    // Weight criteria: same category + (loc token match OR title token match)
    if (sameCategory && (hasLocationTokenMatch || directLocMatch)) {
      return true;
    }

    if (hasLocationTokenMatch && hasTitleTokenMatch) {
      return true;
    }

    return false;
  });

  return {
    relatedIssues: matched.slice(0, 10),
    commonCategory: targetIssue.category,
    commonLocation: targetIssue.location,
  };
}
