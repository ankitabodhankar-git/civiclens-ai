import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { CivicIssue } from '../types.ts';
import { getSlaDetails } from '../utils/slaUtils.ts';
import {
  ShieldAlert,
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Search,
  TrendingUp,
  MapPin,
  ChevronRight,
  PieChart,
  ArrowUpRight
} from 'lucide-react';

interface OfficerDashboardProps {
  onSelectIssue: (issue: CivicIssue) => void;
  onNavigateTab: (tab: string) => void;
}

export const OfficerDashboard: React.FC<OfficerDashboardProps> = ({ onSelectIssue, onNavigateTab }) => {
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to all issues
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
          console.error('Error fetching issues for dashboard:', err);
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

  // Compute Dashboard Metrics
  const stats = useMemo(() => {
    const total = issues.length;
    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let highPriorityCount = 0;
    let totalScore = 0;
    const catFreq: Record<string, number> = {};

    issues.forEach((i) => {
      totalScore += i.priorityScore || 50;
      if (i.status === 'Open') openCount++;
      if (i.status === 'In Progress') inProgressCount++;
      if (i.status === 'Resolved') resolvedCount++;
      if (i.severity === 'High' || i.severity === 'Critical') highPriorityCount++;

      catFreq[i.category] = (catFreq[i.category] || 0) + 1;
    });

    const avgScore = total > 0 ? Math.round(totalScore / total) : 0;

    // Recurring categories sorted
    const recurringCategories = Object.entries(catFreq)
      .map(([category, count]) => ({
        category,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      openCount,
      inProgressCount,
      resolvedCount,
      highPriorityCount,
      avgScore,
      recurringCategories,
    };
  }, [issues]);

  // Section 1: Priority Queue (Highest-priority UNRESOLVED issues)
  const priorityQueue = useMemo(() => {
    return issues
      .filter((i) => i.status !== 'Resolved')
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
      .slice(0, 5);
  }, [issues]);

  // FEATURE 2: SLA WATCH Groups
  const [slaFilter, setSlaFilter] = useState<'overdue' | 'at_risk' | 'critical'>('overdue');

  const slaGroups = useMemo(() => {
    const overdue: { issue: CivicIssue; sla: ReturnType<typeof getSlaDetails> }[] = [];
    const atRisk: { issue: CivicIssue; sla: ReturnType<typeof getSlaDetails> }[] = [];
    const criticalUnresolved: { issue: CivicIssue; sla: ReturnType<typeof getSlaDetails> }[] = [];

    issues.forEach((issue) => {
      // Resolved issues never appear as overdue in SLA Watch
      if (issue.status === 'Resolved') return;

      const sla = getSlaDetails(issue);

      if (sla.status === 'Overdue') {
        overdue.push({ issue, sla });
      } else if (sla.status === 'At Risk') {
        atRisk.push({ issue, sla });
      }

      if (issue.severity === 'Critical') {
        criticalUnresolved.push({ issue, sla });
      }
    });

    return { overdue, atRisk, criticalUnresolved };
  }, [issues]);

  // Section 3: Recent Reports
  const recentReports = useMemo(() => {
    return issues.slice(0, 5);
  }, [issues]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-3 py-1 rounded-full text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-300" />
            <span>Civic Officer Governance Console</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">CivicLens AI</h1>
          <p className="text-indigo-200 text-sm max-w-xl">
            AI-powered civic issue intelligence and prioritization platform. Real-time data structuring, historical trend discovery, and municipal response planning.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigateTab('historical')}
            className="px-4 py-2.5 bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2"
          >
            <Search className="w-4 h-4 text-indigo-600" />
            <span>Historical Search</span>
          </button>
          <button
            onClick={() => onNavigateTab('trend-lens')}
            className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl border border-indigo-500/40 shadow-md transition-all flex items-center space-x-2"
          >
            <TrendingUp className="w-4 h-4 text-indigo-300" />
            <span>Civic Trend Lens</span>
          </button>
        </div>
      </div>

      {/* Top 5 Primary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Issues */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Issues</span>
            <Layers className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-3xl font-extrabold text-zinc-900 mt-2">{stats.total}</div>
          <span className="text-[11px] text-zinc-400 mt-1">Logged across all time</span>
        </div>

        {/* Open */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-bold uppercase tracking-wider">Open</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-3xl font-extrabold text-amber-600 mt-2">{stats.openCount}</div>
          <span className="text-[11px] text-zinc-400 mt-1">Awaiting inspection</span>
        </div>

        {/* In Progress */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-xs font-bold uppercase tracking-wider">In Progress</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-3xl font-extrabold text-blue-600 mt-2">{stats.inProgressCount}</div>
          <span className="text-[11px] text-zinc-400 mt-1">Department dispatched</span>
        </div>

        {/* Resolved */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-bold uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-600 mt-2">{stats.resolvedCount}</div>
          <span className="text-[11px] text-zinc-400 mt-1">Closed & verified</span>
        </div>

        {/* High / Critical Priority */}
        <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-xs font-bold uppercase tracking-wider">High / Critical</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-3xl font-extrabold text-rose-600 mt-2">{stats.highPriorityCount}</div>
          <span className="text-[11px] text-rose-700/70 mt-1">Priority score &gt; 60</span>
        </div>
      </div>

      {/* FEATURE 2: CIVIC SLA WATCH SECTION */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Civic SLA Watch</h2>
              <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
                Prototype advisory SLA
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Monitors resolution deadlines based on incident severity (Critical: 12h, High: 24h, Medium: 3 working days, Low: 7 working days).
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setSlaFilter('overdue')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors flex items-center space-x-1.5 ${
                slaFilter === 'overdue'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Overdue ({slaGroups.overdue.length})</span>
            </button>

            <button
              onClick={() => setSlaFilter('at_risk')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors flex items-center space-x-1.5 ${
                slaFilter === 'at_risk'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Approaching SLA ({slaGroups.atRisk.length})</span>
            </button>

            <button
              onClick={() => setSlaFilter('critical')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors flex items-center space-x-1.5 ${
                slaFilter === 'critical'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Critical Unresolved ({slaGroups.criticalUnresolved.length})</span>
            </button>
          </div>
        </div>

        {/* SLA Issue List */}
        {(() => {
          const list =
            slaFilter === 'overdue'
              ? slaGroups.overdue
              : slaFilter === 'at_risk'
              ? slaGroups.atRisk
              : slaGroups.criticalUnresolved;

          if (list.length === 0) {
            return (
              <div className="py-8 text-center text-xs text-zinc-400 bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
                {slaFilter === 'overdue' && 'No overdue issues! All active reports are within advisory SLA targets.'}
                {slaFilter === 'at_risk' && 'No issues currently approaching SLA deadline.'}
                {slaFilter === 'critical' && 'No critical severity issues awaiting resolution.'}
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {list.map(({ issue, sla }) => (
                <div
                  key={issue.issueId}
                  onClick={() => onSelectIssue(issue)}
                  className="bg-zinc-50/70 hover:bg-white border border-zinc-200 hover:border-indigo-300 rounded-xl p-4 transition-all cursor-pointer shadow-2xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            issue.severity === 'Critical'
                              ? 'bg-red-100 text-red-700'
                              : issue.severity === 'High'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {issue.severity}
                        </span>
                        <span className="bg-zinc-200 text-zinc-700 text-[10px] font-medium px-2 py-0.5 rounded">
                          {issue.category}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          sla.status === 'Overdue'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : sla.status === 'At Risk'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {sla.remainingOrOverdueText}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-zinc-900 line-clamp-1">{issue.title}</h3>

                    <div className="flex items-center space-x-1 text-xs text-zinc-500 truncate">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate">{issue.location}</span>
                    </div>
                  </div>

                  <div className="border-t border-zinc-200/60 pt-2 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Created: <strong>{new Date(issue.createdAt).toLocaleDateString()}</strong></span>
                    <span>Target: <strong>{sla.targetAt.toLocaleDateString()} {sla.targetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                    <span className="text-indigo-600 font-semibold hover:underline flex items-center">
                      Review →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Grid: Priority Queue & Recurring Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Section 1: Priority Queue (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Flame className="w-5 h-5 text-rose-500" />
              <h2 className="text-lg font-bold text-zinc-900">Priority Queue</h2>
              <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">
                Unresolved Highest Impact
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('historical')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400">Loading priority queue...</div>
          ) : priorityQueue.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-xs text-zinc-500">
              No pending high-priority issues! All critical items are currently resolved.
            </div>
          ) : (
            <div className="space-y-2.5">
              {priorityQueue.map((issue) => (
                <div
                  key={issue.issueId}
                  onClick={() => onSelectIssue(issue)}
                  className="bg-white hover:bg-slate-50 border border-zinc-200 hover:border-indigo-300 rounded-xl p-4 transition-all cursor-pointer shadow-xs flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold px-2 py-0.5 rounded">
                        {issue.severity}
                      </span>
                      <span className="bg-zinc-100 text-zinc-700 text-[11px] font-medium px-2 py-0.5 rounded">
                        {issue.category}
                      </span>
                      <span className="text-[11px] text-zinc-400">{new Date(issue.createdAt).toLocaleDateString()}</span>
                    </div>

                    <h3 className="text-sm font-bold text-zinc-900 truncate">{issue.title}</h3>

                    <div className="flex items-center space-x-1 text-xs text-zinc-500 truncate">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate">{issue.location}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-zinc-400 block uppercase font-bold">AI Priority</span>
                    <span className="text-lg font-extrabold text-rose-600">{issue.priorityScore}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 5: Recurring Issues Categories (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <PieChart className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-zinc-900">Recurring Categories</h2>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
            <span className="text-xs text-zinc-500 block">Frequency distribution across verified complaints</span>

            {stats.recurringCategories.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">No categories recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {stats.recurringCategories.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-800">{item.category}</span>
                      <span className="text-zinc-500 font-mono">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${item.pct}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Recent Reports Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">Recent Reports</h2>
          <button
            onClick={() => onNavigateTab('historical')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <span>Search Historical Records</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentReports.map((issue) => (
            <div
              key={issue.issueId}
              onClick={() => onSelectIssue(issue)}
              className="bg-white hover:bg-slate-50 border border-zinc-200 hover:border-indigo-300 rounded-xl p-4 transition-all cursor-pointer shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="bg-zinc-100 text-zinc-700 text-xs font-medium px-2 py-0.5 rounded">
                    {issue.category}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      issue.status === 'Resolved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : issue.status === 'In Progress'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {issue.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-zinc-900 line-clamp-1">{issue.title}</h3>
                <p className="text-xs text-zinc-500 line-clamp-2">{issue.summary}</p>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-100 text-xs">
                <span className="text-zinc-400">{new Date(issue.createdAt).toLocaleDateString()}</span>
                <span className="font-bold text-indigo-600 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Score: {issue.priorityScore}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
