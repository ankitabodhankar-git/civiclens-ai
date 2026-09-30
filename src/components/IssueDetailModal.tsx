import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { doc, updateDoc, collection, query, where, orderBy, getDocs, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { CivicIssue, IssueStatus, AuditLog, CivicPlaybook } from '../types.ts';
import { getSlaDetails, findRelatedIssues } from '../utils/slaUtils.ts';
import {
  X,
  MapPin,
  Clock,
  Sparkles,
  Shield,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
  Building,
  Wrench,
  Check,
  Copy,
  Printer,
  ChevronRight,
  Info
} from 'lucide-react';

interface IssueDetailModalProps {
  issue: CivicIssue | null;
  allIssues?: CivicIssue[];
  onClose: () => void;
  onIssueUpdated?: (updated: CivicIssue) => void;
  onSelectIssue?: (issue: CivicIssue) => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  allIssues,
  onClose,
  onIssueUpdated,
  onSelectIssue,
}) => {
  const { user, profile, activeRole, isOfficer } = useAuth();

  const [currentIssue, setCurrentIssue] = useState<CivicIssue | null>(issue);
  const [issuesList, setIssuesList] = useState<CivicIssue[]>(allIssues || []);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);

  // Status Update State
  const [newStatus, setNewStatus] = useState<IssueStatus>(issue?.status || 'Open');
  const [officerNotes, setOfficerNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Playbook Generation State (Original Feature)
  const [generatingPlaybook, setGeneratingPlaybook] = useState(false);
  const [playbookError, setPlaybookError] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  useEffect(() => {
    if (allIssues && allIssues.length > 0) {
      setIssuesList(allIssues);
    } else {
      // Query recent issues for recurring detection
      const path = 'issues';
      getDocs(query(collection(db, path), orderBy('createdAt', 'desc')))
        .then((snap) => {
          const list: CivicIssue[] = [];
          snap.forEach((d) => list.push(d.data() as CivicIssue));
          setIssuesList(list);
        })
        .catch((e) => console.warn('Could not query issues for duplicate detection:', e));
    }
  }, [allIssues]);

  useEffect(() => {
    setCurrentIssue(issue);
    if (issue) {
      setNewStatus(issue.status);
      fetchAuditLogs(issue.issueId);
    }
  }, [issue]);

  const fetchAuditLogs = async (issueId: string) => {
    setLoadingAudits(true);
    const path = 'auditLogs';
    try {
      const q = query(
        collection(db, path),
        where('issueId', '==', issueId),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      const logs: AuditLog[] = [];
      snap.forEach((d) => logs.push(d.data() as AuditLog));
      setAuditLogs(logs);
    } catch (err) {
      console.warn('Could not fetch audit logs (restricted for citizen):', err);
    } finally {
      setLoadingAudits(false);
    }
  };

  if (!currentIssue) return null;

  // Handle Officer Status Update
  const handleUpdateStatus = async () => {
    if (!user || !isOfficer) return;
    if (newStatus === currentIssue.status && !officerNotes.trim()) return;

    setUpdatingStatus(true);
    setUpdateError(null);

    const nowIso = new Date().toISOString();
    const isResolvedNow = newStatus === 'Resolved' && currentIssue.status !== 'Resolved';
    const path = `issues/${currentIssue.issueId}`;

    try {
      const issueRef = doc(db, 'issues', currentIssue.issueId);
      const updatePayload: Partial<CivicIssue> = {
        status: newStatus,
        updatedAt: nowIso,
        ...(isResolvedNow ? { resolvedAt: nowIso } : {}),
      };

      await updateDoc(issueRef, updatePayload);

      // Create Audit Record
      const logId = 'audit_' + Date.now();
      const auditPayload: AuditLog = {
        logId,
        actorId: user.uid,
        actorRole: activeRole,
        actorEmail: user.email || 'officer',
        action: 'STATUS_CHANGE',
        issueId: currentIssue.issueId,
        previousStatus: currentIssue.status,
        newStatus,
        timestamp: nowIso,
        notes: officerNotes.trim() || `Status updated from ${currentIssue.status} to ${newStatus} by civic officer.`,
      };

      try {
        await setDoc(doc(db, 'auditLogs', logId), auditPayload);
      } catch (auditErr) {
        console.warn('Audit record warning:', auditErr);
      }

      const updatedObj: CivicIssue = {
        ...currentIssue,
        ...updatePayload,
      };

      setCurrentIssue(updatedObj);
      if (onIssueUpdated) onIssueUpdated(updatedObj);
      setAuditLogs((prev) => [auditPayload, ...prev]);
      setOfficerNotes('');
    } catch (err: any) {
      console.error('Error updating issue status:', err);
      setUpdateError(err.message || 'Permission denied or update failed.');
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Original Feature: Generate Resolution Playbook & Public Notice
  const handleGeneratePlaybook = async () => {
    setGeneratingPlaybook(true);
    setPlaybookError(null);

    try {
      const res = await fetch('/api/generate-playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentIssue.title,
          category: currentIssue.category,
          severity: currentIssue.severity,
          urgency: currentIssue.urgency,
          location: currentIssue.location,
          summary: currentIssue.summary,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate civic playbook.');
      }

      const data = await res.json();
      const generatedPlaybook: CivicPlaybook = {
        ...data.playbook,
        generatedAt: data.generatedAt,
      };

      // Persist playbook to Firestore issue document
      const issueRef = doc(db, 'issues', currentIssue.issueId);
      await updateDoc(issueRef, {
        playbook: generatedPlaybook,
        updatedAt: new Date().toISOString(),
      });

      const updatedObj = { ...currentIssue, playbook: generatedPlaybook };
      setCurrentIssue(updatedObj);
      if (onIssueUpdated) onIssueUpdated(updatedObj);
    } catch (err: any) {
      console.error(err);
      setPlaybookError(err.message || 'Error generating playbook.');
    } finally {
      setGeneratingPlaybook(false);
    }
  };

  const handleCopyNotice = () => {
    if (currentIssue.playbook?.publicTransparencyNotice) {
      navigator.clipboard.writeText(currentIssue.playbook.publicTransparencyNotice);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    }
  };

  const sla = currentIssue ? getSlaDetails(currentIssue) : null;
  const relatedData = currentIssue ? findRelatedIssues(currentIssue, issuesList) : { relatedIssues: [] };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center space-x-2.5">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                currentIssue.status === 'Resolved'
                  ? 'bg-emerald-100 text-emerald-800'
                  : currentIssue.status === 'In Progress'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              Status: {currentIssue.status}
            </span>
            <span className="text-xs text-zinc-500 font-mono">ID: {currentIssue.issueId.slice(0, 14)}...</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Issue Title & Location */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded">
                {currentIssue.category}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  currentIssue.severity === 'Critical'
                    ? 'bg-red-100 text-red-700 font-bold'
                    : currentIssue.severity === 'High'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                Severity: {currentIssue.severity}
              </span>
              <span className="text-xs text-zinc-500 font-medium">Urgency: {currentIssue.urgency}</span>
              {currentIssue.isDemo && (
                <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded">
                  [DEMO DATA]
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-zinc-900">{currentIssue.title}</h1>

            <div className="flex items-center space-x-2 text-xs text-zinc-500 mt-2">
              <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>{currentIssue.location}</span>
            </div>
          </div>

          {/* Status Progression Timeline */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-3">
              Resolution Workflow Progression
            </span>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${
                    currentIssue.status === 'Open' || currentIssue.status === 'In Progress' || currentIssue.status === 'Resolved'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-200 text-zinc-500'
                  }`}
                >
                  1
                </div>
                <div>
                  <span className="font-bold text-zinc-900 block">Reported & Logged</span>
                  <span className="text-[10px] text-zinc-400">{new Date(currentIssue.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="h-0.5 flex-1 mx-3 bg-zinc-200">
                <div
                  className={`h-full ${
                    currentIssue.status === 'In Progress' || currentIssue.status === 'Resolved' ? 'bg-indigo-600' : ''
                  }`}
                ></div>
              </div>

              <div className="flex items-center space-x-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${
                    currentIssue.status === 'In Progress' || currentIssue.status === 'Resolved'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-200 text-zinc-500'
                  }`}
                >
                  2
                </div>
                <div>
                  <span className="font-bold text-zinc-900 block">In Progress</span>
                  <span className="text-[10px] text-zinc-400">
                    {currentIssue.status !== 'Open' ? new Date(currentIssue.updatedAt).toLocaleDateString() : 'Awaiting review'}
                  </span>
                </div>
              </div>

              <div className="h-0.5 flex-1 mx-3 bg-zinc-200">
                <div className={`h-full ${currentIssue.status === 'Resolved' ? 'bg-emerald-600' : ''}`}></div>
              </div>

              <div className="flex items-center space-x-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${
                    currentIssue.status === 'Resolved' ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-500'
                  }`}
                >
                  3
                </div>
                <div>
                  <span className="font-bold text-zinc-900 block">Resolved</span>
                  <span className="text-[10px] text-zinc-400">
                    {currentIssue.resolvedAt ? new Date(currentIssue.resolvedAt).toLocaleDateString() : 'Pending fix'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Civic SLA Watch Card (Feature 2) */}
          {sla && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-zinc-900 uppercase tracking-wider">Civic SLA Watch</span>
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                    Prototype advisory SLA
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-600">
                  <span>Target Resolution: <strong>{sla.targetAt.toLocaleString()}</strong></span>
                  <span className="text-zinc-400">·</span>
                  <span>
                    Status: <strong className={
                      sla.status === 'Resolved' ? 'text-emerald-700 font-bold' :
                      sla.status === 'Overdue' ? 'text-red-600 font-bold' :
                      sla.status === 'At Risk' ? 'text-amber-600 font-bold' : 'text-blue-700 font-bold'
                    }>{sla.remainingOrOverdueText}</strong>
                  </span>
                </div>
              </div>
              <span className={`self-start sm:self-auto px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wider ${
                sla.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                sla.status === 'Overdue' ? 'bg-red-100 text-red-800 border border-red-200 animate-pulse' :
                sla.status === 'At Risk' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {sla.status}
              </span>
            </div>
          )}

          {/* AI Intelligence & Advisory Priority Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-zinc-800">AI Priority Score:</span>
                <span className="text-base font-extrabold text-indigo-600">{currentIssue.priorityScore} / 100</span>
              </div>
              <span className="text-xs text-zinc-500 bg-white px-2.5 py-0.5 rounded border border-slate-200">
                AI Confidence: {(currentIssue.aiConfidence * 100).toFixed(0)}%
              </span>
            </div>

            <div>
              <span className="text-xs font-bold text-zinc-700 block mb-1">Factual Issue Summary:</span>
              <p className="text-sm text-zinc-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                {currentIssue.summary}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold text-zinc-700 block mb-1">Identified Community Impact:</span>
              <p className="text-sm text-zinc-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                {currentIssue.impact}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold text-zinc-700 block mb-1">Recommended Municipal Action:</span>
              <p className="text-sm text-zinc-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                {currentIssue.recommendedAction}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg flex items-start space-x-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Advisory — human review required:</strong> AI-generated analysis is an advisory decision support tool. Government officers verify physical conditions and authorize municipal deployments.
              </span>
            </div>
          </div>

          {/* FEATURE 1: Recurring / Possible Duplicate Issue Detection */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-zinc-900 text-sm">Recurring Issue Detection</span>
              </div>
              <span className="bg-white border border-amber-300 text-amber-900 font-semibold px-2.5 py-0.5 rounded-full text-xs">
                Possible related reports: {relatedData.relatedIssues.length}
              </span>
            </div>

            {relatedData.relatedIssues.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-700">
                  <span>Common category: <strong className="text-zinc-900">{relatedData.commonCategory}</strong></span>
                  <span>Common location: <strong className="text-zinc-900">{relatedData.commonLocation}</strong></span>
                </div>
                <p className="text-zinc-600 leading-relaxed">
                  Possible recurring issue: <strong>{relatedData.relatedIssues.length} related report{relatedData.relatedIssues.length > 1 ? 's' : ''}</strong> found in this area during the last 30–60 days with matching category or geographical vicinity.
                </p>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase block">Review Related Reports:</span>
                  {relatedData.relatedIssues.map((rel) => (
                    <div
                      key={rel.issueId}
                      onClick={() => {
                        setCurrentIssue(rel);
                        if (onSelectIssue) onSelectIssue(rel);
                      }}
                      className="p-2.5 bg-white hover:bg-amber-50/50 border border-amber-200 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="space-y-0.5 truncate flex-1 mr-3">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            rel.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {rel.status}
                          </span>
                          <span className="font-semibold text-zinc-900 truncate">{rel.title}</span>
                        </div>
                        <span className="text-[11px] text-zinc-400 block truncate">{rel.location} · {new Date(rel.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span className="text-indigo-600 text-[11px] font-semibold shrink-0 hover:underline flex items-center space-x-0.5">
                        <span>View Report</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-amber-800/80 italic pt-1">
                  * Advisory only: Reports are labeled &quot;Possible related reports&quot; and are never automatically merged. Only an authorized human officer can confirm if reports describe the same physical event.
                </p>
              </div>
            ) : (
              <p className="text-zinc-500 text-xs">
                No related or recurring reports detected in this vicinity within the last 60 days.
              </p>
            )}
          </div>

          {/* Original Citizen Narrative */}
          <div>
            <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-1.5 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              <span>Citizen Submitted Narrative</span>
            </span>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
              {currentIssue.description}
            </div>
          </div>

          {/* ORIGINAL FEATURE: Civic Resolution Playbook & Public Transparency Notice */}
          <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Wrench className="w-4 h-4 text-indigo-700" />
                  <h2 className="text-sm font-bold text-indigo-900">
                    Civic Resolution Playbook & Transparency Notice
                  </h2>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Original Feature
                  </span>
                </div>
                <p className="text-xs text-indigo-700/80 mt-0.5">
                  AI-assisted inter-departmental action plan, resource requirements, and shareable public notice
                </p>
              </div>

              {isOfficer && (
                <button
                  onClick={handleGeneratePlaybook}
                  disabled={generatingPlaybook}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 shrink-0 self-start sm:self-auto"
                >
                  {generatingPlaybook ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Synthesizing Playbook...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{currentIssue.playbook ? 'Regenerate Playbook' : 'Generate Playbook'}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {playbookError && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg">
                {playbookError}
              </div>
            )}

            {currentIssue.playbook ? (
              <div className="space-y-3.5 bg-white border border-indigo-100 rounded-xl p-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-zinc-100 pb-3">
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold">Target Resolution SLA</span>
                    <span className="text-sm font-bold text-zinc-900">{currentIssue.playbook.targetResolutionTime}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold">Lead Department</span>
                    <span className="text-sm font-bold text-indigo-700">{currentIssue.playbook.leadDepartment}</span>
                  </div>
                </div>

                {currentIssue.playbook.collaboratingDepartments?.length > 0 && (
                  <div>
                    <span className="font-bold text-zinc-700 block mb-1">Collaborating Agencies:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentIssue.playbook.collaboratingDepartments.map((dept, idx) => (
                        <span key={idx} className="bg-slate-100 text-zinc-700 px-2 py-0.5 rounded text-[11px]">
                          {dept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="font-bold text-zinc-700 block mb-1">Required Equipment & Municipal Resources:</span>
                  <ul className="list-disc list-inside text-zinc-600 space-y-0.5">
                    {currentIssue.playbook.requiredEquipmentAndResources.map((eq, idx) => (
                      <li key={idx}>{eq}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span className="font-bold text-zinc-700 block mb-1">On-Site Safety Protocols:</span>
                  <ul className="list-disc list-inside text-zinc-600 space-y-0.5">
                    {currentIssue.playbook.safetyProtocols.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>

                {/* Citizen Transparency Notice */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-800 flex items-center space-x-1.5">
                      <Building className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Citizen Transparency Notice Draft (Official Notification)</span>
                    </span>
                    <button
                      onClick={handleCopyNotice}
                      className="px-2.5 py-1 bg-white hover:bg-zinc-100 border border-zinc-200 rounded text-[11px] font-medium text-zinc-700 flex items-center space-x-1 transition-colors"
                    >
                      {copiedNotice ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-zinc-400" />
                          <span>Copy Notice</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-zinc-700 whitespace-pre-wrap leading-relaxed text-[11px] italic font-serif">
                    {currentIssue.playbook.publicTransparencyNotice}
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    This official notice can be posted on community noticeboards or sent via SMS/email to local residents without exposing reporter identity.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-indigo-700/70 italic">
                {isOfficer
                  ? 'Click "Generate Playbook" to receive a tailored multi-department mitigation strategy and equipment checklist for this issue.'
                  : 'Civic playbook generation is reserved for authorized civic officers.'}
              </p>
            )}
          </div>

          {/* Officer Status Management Controls */}
          {isOfficer ? (
            <div className="bg-white border-2 border-indigo-100 rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-zinc-900">Officer Status Action</h3>
              </div>

              {updateError && (
                <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl">
                  {updateError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 uppercase mb-1">Set New Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as IssueStatus)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="Open">Open (Pending Inspection)</option>
                    <option value="In Progress">In Progress (Crews Dispatched)</option>
                    <option value="Resolved">Resolved (Completed & Verified)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 uppercase mb-1">
                    Officer Governance Note / Reason
                  </label>
                  <input
                    type="text"
                    value={officerNotes}
                    onChange={(e) => setOfficerNotes(e.target.value)}
                    placeholder="e.g., Road repair crew #4 deployed, scheduled completion in 24h"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleUpdateStatus}
                  disabled={updatingStatus || (newStatus === currentIssue.status && !officerNotes.trim())}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  {updatingStatus ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Persisting Status...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Status Update</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-500">
              Only authorized civic officers have permission to modify status and priority scores.
            </div>
          )}

          {/* Audit History Timeline */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <History className="w-4 h-4 text-zinc-500" />
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Governance Audit Trail</h3>
            </div>

            {loadingAudits ? (
              <p className="text-xs text-zinc-400">Loading audit history...</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">No historical status modifications recorded yet.</p>
            ) : (
              <div className="space-y-2 border-l-2 border-zinc-200 pl-3">
                {auditLogs.map((log) => (
                  <div key={log.logId} className="text-xs text-zinc-600 space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-zinc-800">{log.action}</span>
                      <span className="text-[10px] text-zinc-400">{new Date(log.timestamp).toLocaleString()}</span>
                      <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded text-[10px] capitalize">
                        {log.actorRole}
                      </span>
                    </div>
                    {log.notes && <p className="text-zinc-500">{log.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
