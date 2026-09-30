import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { CivicIssue } from '../types.ts';
import {
  FileText,
  MapPin,
  Clock,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Inbox
} from 'lucide-react';

interface CitizenMyIssuesProps {
  onSelectIssue: (issue: CivicIssue) => void;
  onNavigateReport: () => void;
}

export const CitizenMyIssues: React.FC<CitizenMyIssuesProps> = ({ onSelectIssue, onNavigateReport }) => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIssues([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(null);
    const path = 'issues';

    try {
      const q = query(
        collection(db, path),
        where('ownerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: CivicIssue[] = [];
          snapshot.forEach((doc) => {
            list.push(doc.data() as CivicIssue);
          });
          setIssues(list);
          setLoading(false);
        },
        (error) => {
          console.error('Error fetching citizen issues:', error);
          setFetchError('Unable to load your submitted issues. Please check your network connection.');
          setLoading(false);
          handleFirestoreError(error, OperationType.LIST, path);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.error('Query setup error:', err);
      setFetchError(err.message || 'Error initializing issues listener');
      setLoading(false);
    }
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Resolved':
        return (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Resolved</span>
          </span>
        );
      case 'In Progress':
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>In Progress</span>
          </span>
        );
      default:
        return (
          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Open</span>
          </span>
        );
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900">Sign in to View Your Issues</h2>
        <p className="text-sm text-zinc-500 max-w-md mx-auto mt-2">
          Your personal civic submissions are tied to your authenticated Google account to protect your privacy and ensure owner-bound access.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-zinc-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">My Submitted Civic Issues</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Review status updates and AI classifications for problems you have reported.
          </p>
        </div>
        <button
          onClick={onNavigateReport}
          className="self-start sm:self-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center space-x-1.5"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Report New Problem</span>
        </button>
      </div>

      {fetchError && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-800 text-xs p-4 rounded-xl">
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-zinc-500 font-medium">Loading your civic records from Firestore...</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center mt-6">
          <div className="w-12 h-12 bg-zinc-100 text-zinc-400 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-800">No issues reported yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-6">
            When you report a broken streetlight, pothole, or garbage delay, it will appear here with real-time status updates from civic officers.
          </p>
          <button
            onClick={onNavigateReport}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
          >
            Submit Your First Report
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {issues.map((issue) => (
            <div
              key={issue.issueId}
              onClick={() => onSelectIssue(issue)}
              className="bg-white hover:bg-slate-50 border border-zinc-200 hover:border-indigo-300 rounded-xl p-4 sm:p-5 transition-all cursor-pointer shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {getStatusBadge(issue.status)}
                  <span className="bg-zinc-100 text-zinc-700 text-xs font-medium px-2 py-0.5 rounded">
                    {issue.category}
                  </span>
                  <span className="text-[11px] text-zinc-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                  </span>
                </div>

                <h3 className="text-base font-bold text-zinc-900 truncate">{issue.title}</h3>

                <div className="flex items-center space-x-1.5 text-xs text-zinc-500 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                  <span className="truncate">{issue.location}</span>
                </div>
              </div>

              {/* Priority & Arrow */}
              <div className="flex items-center justify-between sm:justify-end space-x-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-100">
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
    </div>
  );
};
