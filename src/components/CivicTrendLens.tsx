import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { CivicIssue } from '../types.ts';
import {
  TrendingUp,
  Sparkles,
  Calendar,
  Layers,
  PieChart,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Info,
  ShieldCheck,
  Building
} from 'lucide-react';

interface CivicTrendLensProps {
  initialStartDate?: string;
  initialEndDate?: string;
  onSelectIssue: (issue: CivicIssue) => void;
}

interface AiTrendSummary {
  headline: string;
  summary: string;
  keyPatterns: string[];
  vulnerableAreas: string[];
  strategicRecommendations: string[];
}

export const CivicTrendLens: React.FC<CivicTrendLensProps> = ({
  initialStartDate,
  initialEndDate,
  onSelectIssue,
}) => {
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [loading, setLoading] = useState(true);

  // Set default date range to current month or past 30 days
  const defaultDates = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }, []);

  const [startDate, setStartDate] = useState(initialStartDate || defaultDates.start);
  const [endDate, setEndDate] = useState(initialEndDate || defaultDates.end);

  const [aiSummary, setAiSummary] = useState<AiTrendSummary | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Subscribe to all issues to compute trend metrics
  useEffect(() => {
    const path = 'issues';
    setLoading(true);
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const list: CivicIssue[] = [];
          snap.forEach((d) => list.push(d.data() as CivicIssue));
          setIssues(list);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching issues for trend lens:', err);
          setLoading(false);
          handleFirestoreError(err, OperationType.LIST, path);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, []);

  // Filter issues within selected date range
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const issueDate = issue.createdAt ? new Date(issue.createdAt).toISOString().split('T')[0] : '';
      if (startDate && issueDate < startDate) return false;
      if (endDate && issueDate > endDate) return false;
      return true;
    });
  }, [issues, startDate, endDate]);

  // Accurate Calculations from REAL stored documents
  const stats = useMemo(() => {
    const total = filteredIssues.length;
    if (total === 0) {
      return {
        total: 0,
        avgPriority: 0,
        openCount: 0,
        inProgressCount: 0,
        resolvedCount: 0,
        unresolvedCount: 0,
        resolutionRate: 0,
        categoryDist: {} as Record<string, { count: number; pct: number }>,
        severityDist: {} as Record<string, number>,
        mostFrequentCategory: 'None',
        mostFrequentCatPct: 0,
        highestPriorityIssue: null as CivicIssue | null,
        topLocations: [] as string[],
      };
    }

    let sumPriority = 0;
    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let highestPriorityIssue: CivicIssue | null = null;
    let maxPriority = -1;

    const catCounts: Record<string, number> = {};
    const sevCounts: Record<string, number> = {};
    const locCounts: Record<string, number> = {};

    filteredIssues.forEach((issue) => {
      const score = issue.priorityScore || 50;
      sumPriority += score;

      if (issue.status === 'Open') openCount++;
      else if (issue.status === 'In Progress') inProgressCount++;
      else if (issue.status === 'Resolved') resolvedCount++;

      if (score > maxPriority) {
        maxPriority = score;
        highestPriorityIssue = issue;
      }

      catCounts[issue.category] = (catCounts[issue.category] || 0) + 1;
      sevCounts[issue.severity] = (sevCounts[issue.severity] || 0) + 1;

      // Extract general neighborhood/location keyword
      const locKey = issue.location ? issue.location.split(',')[0].trim() : 'Unknown';
      locCounts[locKey] = (locCounts[locKey] || 0) + 1;
    });

    const unresolvedCount = openCount + inProgressCount;
    const resolutionRate = Math.round((resolvedCount / total) * 100);

    // Category distribution with exact percentages
    const categoryDist: Record<string, { count: number; pct: number }> = {};
    let topCat = 'None';
    let topCatCount = 0;

    Object.entries(catCounts).forEach(([cat, count]) => {
      const pct = Math.round((count / total) * 100);
      categoryDist[cat] = { count, pct };
      if (count > topCatCount) {
        topCatCount = count;
        topCat = cat;
      }
    });

    // Top locations
    const topLocations = Object.entries(locCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([loc]) => loc);

    return {
      total,
      avgPriority: Math.round(sumPriority / total),
      openCount,
      inProgressCount,
      resolvedCount,
      unresolvedCount,
      resolutionRate,
      categoryDist,
      severityDist: sevCounts,
      mostFrequentCategory: topCat,
      mostFrequentCatPct: topCatCount > 0 ? Math.round((topCatCount / total) * 100) : 0,
      highestPriorityIssue,
      topLocations,
    };
  }, [filteredIssues]);

  // Request server-side Gemini Trend Summary
  const handleGenerateAiTrend = async () => {
    if (stats.total === 0) return;
    setGeneratingAi(true);
    setAiError(null);

    try {
      const categoryCounts: Record<string, number> = {};
      Object.entries(stats.categoryDist).forEach(([k, v]) => {
        categoryCounts[k] = v.count;
      });

      const res = await fetch('/api/trend-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRange: { from: startDate, to: endDate },
          totalCount: stats.total,
          categoryCounts,
          severityCounts: stats.severityDist,
          statusCounts: {
            open: stats.openCount,
            inProgress: stats.inProgressCount,
            resolved: stats.resolvedCount,
          },
          averagePriority: stats.avgPriority,
          topLocations: stats.topLocations,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate AI trend summary.');
      }

      const data = await res.json();
      setAiSummary(data.summary);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Error creating trend analysis.');
    } finally {
      setGeneratingAi(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 mb-1">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Predictive & Strategic Analysis</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Civic Trend Lens</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Analyze historical recurring problem clusters, resolution rates, and aggregate community trends.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center space-x-2 bg-white border border-zinc-200 p-2 rounded-xl text-xs shadow-xs">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <div className="flex items-center space-x-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-zinc-50 px-2 py-1 rounded border border-zinc-200 outline-none text-zinc-800"
            />
            <span className="text-zinc-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-zinc-50 px-2 py-1 rounded border border-zinc-200 outline-none text-zinc-800"
            />
          </div>
        </div>
      </div>

      {/* Primary Mathematical Insight Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase">Total Reports Analyzed</span>
            <div className="text-3xl font-extrabold text-zinc-900 mt-1">{stats.total}</div>
            <span className="text-xs text-zinc-500 mt-1 block">
              {startDate} to {endDate}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase">Resolution Efficiency</span>
            <div className="text-3xl font-extrabold text-emerald-600 mt-1">{stats.resolutionRate}%</div>
            <span className="text-xs text-zinc-500 mt-1 block">
              {stats.resolvedCount} resolved · {stats.unresolvedCount} pending
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase">Most Frequent Category</span>
            <div className="text-2xl font-bold text-zinc-900 mt-1 truncate">{stats.mostFrequentCategory}</div>
            <span className="text-xs text-zinc-500 mt-1 block">
              Represents {stats.mostFrequentCatPct}% of all reports
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <PieChart className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Category Distribution Breakdown (Factual Calculations) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Category Distribution & Volume</h2>
            <p className="text-xs text-zinc-500">Real-time percentage breakdown computed from stored records</p>
          </div>
          <span className="text-xs font-semibold text-zinc-400">Total {stats.total} Issues</span>
        </div>

        {stats.total === 0 ? (
          <p className="text-xs text-zinc-400 py-6 text-center">No recorded issues in this date window.</p>
        ) : (
          <div className="space-y-3 pt-2">
            {Object.entries(stats.categoryDist).map(([category, { count, pct }]) => (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-800">{category}</span>
                  <span className="text-zinc-500 font-mono">
                    {count} reports <span className="text-zinc-400">({pct}%)</span>
                  </span>
                </div>
                {/* Bar */}
                <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Highest Priority Issue Spotlight */}
      {stats.highestPriorityIssue && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="bg-rose-100 text-rose-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase">
                Highest Priority Hazard In Window
              </span>
              <span className="text-xs text-rose-700 font-bold">
                AI Score: {stats.highestPriorityIssue.priorityScore}/100
              </span>
            </div>
            <h3 className="text-base font-bold text-zinc-900">{stats.highestPriorityIssue.title}</h3>
            <p className="text-xs text-zinc-600">{stats.highestPriorityIssue.summary}</p>
          </div>

          <button
            onClick={() => onSelectIssue(stats.highestPriorityIssue!)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0 flex items-center space-x-1.5 self-start md:self-auto"
          >
            <span>Review Issue Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* AI Trend Summary Generator (Executive Assistant) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Executive AI Civic Trend Summary</h2>
              <p className="text-xs text-zinc-500">
                Gemini aggregates statistical data to formulate actionable governance recommendations
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateAiTrend}
            disabled={generatingAi || stats.total === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center space-x-2 shrink-0 self-start sm:self-auto"
          >
            {generatingAi ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Synthesizing Trends...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate AI Trend Summary</span>
              </>
            )}
          </button>
        </div>

        {aiError && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl">
            {aiError}
          </div>
        )}

        {aiSummary ? (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Executive Insight</span>
              <h3 className="text-lg font-bold text-zinc-900 mt-0.5">{aiSummary.headline}</h3>
              <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed">{aiSummary.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-zinc-700 block mb-2">Recurring Patterns</span>
                <ul className="text-xs text-zinc-600 space-y-1.5 list-disc list-inside">
                  {aiSummary.keyPatterns.map((pat, idx) => (
                    <li key={idx} className="leading-snug">{pat}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-zinc-700 block mb-2">Vulnerable Hotspots</span>
                <ul className="text-xs text-zinc-600 space-y-1.5 list-disc list-inside">
                  {aiSummary.vulnerableAreas.map((area, idx) => (
                    <li key={idx} className="leading-snug">{area}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-zinc-700 block mb-2">Strategic Interventions</span>
                <ul className="text-xs text-zinc-600 space-y-1.5 list-disc list-inside">
                  {aiSummary.strategicRecommendations.map((rec, idx) => (
                    <li key={idx} className="leading-snug">{rec}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2.5 rounded-lg flex items-center space-x-2">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                <strong>AI-generated trend summary:</strong> Formulated solely from factual statistical counts for the period {startDate} to {endDate}.
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-dashed border-zinc-200 rounded-xl p-8 text-center">
            <Sparkles className="w-6 h-6 text-zinc-300 mx-auto mb-2" />
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Click &quot;Generate AI Trend Summary&quot; to invoke server-side Gemini intelligence on the {stats.total} verified reports in this time window.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
