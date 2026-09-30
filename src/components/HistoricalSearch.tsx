import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { CivicIssue, HistoricalFilterState, IssueCategory } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { getSlaDetails } from '../utils/slaUtils.ts';
import {
  Search,
  Calendar,
  Filter,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
  MapPin,
  ChevronRight,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Flame,
  FileSpreadsheet,
  Download
} from 'lucide-react';

const CATEGORIES: IssueCategory[] = [
  'Infrastructure',
  'Sanitation',
  'Transportation',
  'Environment',
  'Public Safety',
  'Public Health',
  'Education',
  'Other',
];

interface HistoricalSearchProps {
  onSelectIssue: (issue: CivicIssue) => void;
  onOpenTrendLensWithDates?: (startDate: string, endDate: string) => void;
}

export const HistoricalSearch: React.FC<HistoricalSearchProps> = ({ onSelectIssue, onOpenTrendLensWithDates }) => {
  const { isOfficer, isAdmin } = useAuth();
  const [allIssues, setAllIssues] = useState<CivicIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState<HistoricalFilterState>({
    startDate: '',
    endDate: '',
    category: '',
    location: '',
    severity: '',
    status: '',
    sortBy: 'date_desc',
    quickRange: 'all',
  });

  const [displayLimit, setDisplayLimit] = useState(50);

  // Subscribe to issues collection
  useEffect(() => {
    setLoading(true);
    const path = 'issues';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs: CivicIssue[] = [];
          snapshot.forEach((d) => docs.push(d.data() as CivicIssue));
          setAllIssues(docs);
          setLoading(false);
        },
        (error) => {
          console.error('Error fetching historical issues:', error);
          setErrorMsg('Failed to fetch historical issues from Firestore.');
          setLoading(false);
          handleFirestoreError(error, OperationType.LIST, path);
        }
      );
      return () => unsubscribe();
    } catch (err: any) {
      console.error('Setup error in historical query:', err);
      setErrorMsg(err.message);
      setLoading(false);
    }
  }, []);

  // Quick Date Range Handler
  const handleQuickRange = (range: HistoricalFilterState['quickRange']) => {
    const now = new Date();
    let start = new Date();

    if (range === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (range === '30d') {
      start.setDate(now.getDate() - 30);
    } else if (range === '90d') {
      start.setDate(now.getDate() - 90);
    } else if (range === '1y') {
      start.setFullYear(now.getFullYear() - 1);
    } else if (range === 'all') {
      setFilters((prev) => ({
        ...prev,
        quickRange: 'all',
        startDate: '',
        endDate: '',
      }));
      return;
    }

    setFilters((prev) => ({
      ...prev,
      quickRange: range,
      startDate: start.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    }));
  };

  // Reset Filters
  const handleResetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      category: '',
      location: '',
      severity: '',
      status: '',
      sortBy: 'date_desc',
      quickRange: 'all',
    });
    setDisplayLimit(50);
  };

  // FEATURE 3: Administrative / Officer CSV Export
  const handleExportCsv = () => {
    if (!isOfficer && !isAdmin) return;

    const headers = [
      'issueId',
      'createdAt',
      'location',
      'category',
      'severity',
      'urgency',
      'priorityScore',
      'status',
      'createdByRole',
      'resolvedAt',
      'slaStatus'
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredIssues.map((issue) => {
      const sla = getSlaDetails(issue);
      const role = issue.isDemo ? 'demo' : (issue.ownerId ? 'citizen' : 'anonymous');
      return [
        escapeCsv(issue.issueId),
        escapeCsv(issue.createdAt),
        escapeCsv(issue.location),
        escapeCsv(issue.category),
        escapeCsv(issue.severity),
        escapeCsv(issue.urgency),
        escapeCsv(issue.priorityScore),
        escapeCsv(issue.status),
        escapeCsv(role),
        escapeCsv(issue.resolvedAt || ''),
        escapeCsv(sla.status),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `civiclens_filtered_issues_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered & Sorted Issues
  const filteredIssues = useMemo(() => {
    return allIssues.filter((issue) => {
      // Date filtering
      if (filters.startDate) {
        const issueDate = issue.createdAt ? new Date(issue.createdAt).toISOString().split('T')[0] : '';
        if (issueDate < filters.startDate) return false;
      }
      if (filters.endDate) {
        const issueDate = issue.createdAt ? new Date(issue.createdAt).toISOString().split('T')[0] : '';
        if (issueDate > filters.endDate) return false;
      }

      // Category
      if (filters.category && issue.category !== filters.category) return false;

      // Location keyword match (case-insensitive substring)
      if (filters.location.trim()) {
        const query = filters.location.toLowerCase();
        const loc = (issue.location || '').toLowerCase();
        const desc = (issue.description || '').toLowerCase();
        if (!loc.includes(query) && !desc.includes(query)) return false;
      }

      // Severity
      if (filters.severity && issue.severity !== filters.severity) return false;

      // Status
      if (filters.status && issue.status !== filters.status) return false;

      return true;
    }).sort((a, b) => {
      if (filters.sortBy === 'priority_desc') {
        return (b.priorityScore || 0) - (a.priorityScore || 0);
      }
      if (filters.sortBy === 'priority_asc') {
        return (a.priorityScore || 0) - (b.priorityScore || 0);
      }
      if (filters.sortBy === 'date_asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      // Default: date_desc
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [allIssues, filters]);

  // Aggregate Metrics for currently filtered set
  const metrics = useMemo(() => {
    const total = filteredIssues.length;
    if (total === 0) {
      return {
        total: 0,
        avgPriority: 0,
        mostCommonCategory: 'None',
        openCount: 0,
        inProgressCount: 0,
        resolvedCount: 0,
        highCriticalCount: 0,
      };
    }

    let sumPriority = 0;
    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let highCriticalCount = 0;
    const catFreq: Record<string, number> = {};

    filteredIssues.forEach((issue) => {
      sumPriority += issue.priorityScore || 50;
      if (issue.status === 'Open') openCount++;
      if (issue.status === 'In Progress') inProgressCount++;
      if (issue.status === 'Resolved') resolvedCount++;
      if (issue.severity === 'High' || issue.severity === 'Critical') highCriticalCount++;

      catFreq[issue.category] = (catFreq[issue.category] || 0) + 1;
    });

    let topCat = 'None';
    let maxCatCount = 0;
    Object.entries(catFreq).forEach(([cat, count]) => {
      if (count > maxCatCount) {
        maxCatCount = count;
        topCat = cat;
      }
    });

    return {
      total,
      avgPriority: Math.round(sumPriority / total),
      mostCommonCategory: topCat,
      openCount,
      inProgressCount,
      resolvedCount,
      highCriticalCount,
    };
  }, [filteredIssues]);

  const displayedIssues = filteredIssues.slice(0, displayLimit);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Page Title & Context */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 mb-1">
            <Search className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Authorized Officer Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Historical Civic Issues & Intelligence</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Filter, trace, and analyze historical citizen reports across past months and years without data degradation.
          </p>
        </div>

        {onOpenTrendLensWithDates && (
          <button
            onClick={() => onOpenTrendLensWithDates(filters.startDate, filters.endDate)}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors self-start md:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open in Civic Trend Lens</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-4 rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* Filter Control Box */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Quick Range Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Time Horizon:</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(['7d', '30d', '90d', '1y', 'all'] as const).map((r) => {
              const labels = {
                '7d': 'Last 7 Days',
                '30d': 'Last 30 Days',
                '90d': 'Last 90 Days',
                '1y': 'Last Year',
                'all': 'All Time',
              };
              return (
                <button
                  key={r}
                  onClick={() => handleQuickRange(r)}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    filters.quickRange === r
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {labels[r]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">From Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value, quickRange: 'custom' })}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">To Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value, quickRange: 'custom' })}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Location Keyword */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Location / Substring</label>
            <input
              type="text"
              placeholder="e.g., Pune, Baner, School..."
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Severity</label>
            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">Sort Ordering</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="priority_desc">Priority (High to Low)</option>
              <option value="priority_asc">Priority (Low to High)</option>
            </select>
          </div>

          {/* Reset Action */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate Statistics Header for Filtered Scope */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 border-b border-slate-200 pb-2 gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center space-x-1.5">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Scope Aggregates ({metrics.total} Matching Records)</span>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-[11px] text-zinc-500 font-medium hidden md:inline">
              Calculated dynamically from verified Firestore documents
            </span>
            {(isOfficer || isAdmin) && (
              <button
                onClick={handleExportCsv}
                disabled={filteredIssues.length === 0}
                title="Export currently filtered dataset to CSV (excluding private citizen data)"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV ({filteredIssues.length})</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Total Issues</span>
            <span className="text-lg font-bold text-zinc-900">{metrics.total}</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Avg AI Priority</span>
            <span className="text-lg font-bold text-indigo-600">{metrics.avgPriority} <span className="text-xs font-normal text-zinc-400">/100</span></span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Common Category</span>
            <span className="text-xs font-bold text-zinc-800 truncate block mt-1">{metrics.mostCommonCategory}</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Open Count</span>
            <span className="text-lg font-bold text-amber-600">{metrics.openCount}</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Resolved Count</span>
            <span className="text-lg font-bold text-emerald-600">{metrics.resolvedCount}</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Critical / High</span>
            <span className="text-lg font-bold text-red-600">{metrics.highCriticalCount}</span>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
          <span>Showing {displayedIssues.length} of {filteredIssues.length} matching issues</span>
          {filteredIssues.length > displayLimit && (
            <span className="text-indigo-600 font-medium">Paginated (First 50 items displayed)</span>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-zinc-500 font-medium">Scanning historical issues database...</p>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-zinc-800">No matching historical issues found</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1 mb-4">
              Try adjusting the date range or category filters. You can also seed realistic sample civic scenarios using the Demo Data tool.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-xl"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedIssues.map((issue) => (
              <div
                key={issue.issueId}
                onClick={() => onSelectIssue(issue)}
                className="bg-white hover:bg-slate-50 border border-zinc-200 hover:border-indigo-300 rounded-xl p-4 transition-all cursor-pointer shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center space-x-1 ${
                        issue.status === 'Resolved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : issue.status === 'In Progress'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {issue.status === 'Resolved' && <CheckCircle2 className="w-3 h-3" />}
                      {issue.status === 'In Progress' && <Clock className="w-3 h-3" />}
                      {issue.status === 'Open' && <AlertTriangle className="w-3 h-3" />}
                      <span>{issue.status}</span>
                    </span>

                    {/* Category */}
                    <span className="bg-zinc-100 text-zinc-700 text-xs font-medium px-2 py-0.5 rounded">
                      {issue.category}
                    </span>

                    {/* Severity */}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        issue.severity === 'Critical'
                          ? 'bg-red-100 text-red-700'
                          : issue.severity === 'High'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {issue.severity}
                    </span>

                    {/* Demo marker */}
                    {issue.isDemo && (
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold px-2 py-0.5 rounded">
                        [DEMO DATA]
                      </span>
                    )}

                    <span className="text-[11px] text-zinc-400 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-zinc-900 truncate">{issue.title}</h3>

                  <div className="flex items-center space-x-1.5 text-xs text-zinc-500 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                    <span className="truncate">{issue.location}</span>
                  </div>
                </div>

                {/* Priority Score & Action */}
                <div className="flex items-center justify-between sm:justify-end space-x-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100">
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block uppercase font-bold">AI Priority</span>
                    <div className="flex items-center space-x-1 text-sm font-extrabold text-indigo-600">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{issue.priorityScore}</span>
                      <span className="text-[10px] text-zinc-400 font-normal">/100</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Pagination */}
        {filteredIssues.length > displayLimit && (
          <div className="text-center pt-4">
            <button
              onClick={() => setDisplayLimit((prev) => prev + 50)}
              className="px-5 py-2 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              Load Next 50 Results ({filteredIssues.length - displayLimit} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
