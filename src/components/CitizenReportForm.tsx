import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { CivicIssue, IssueCategory } from '../types.ts';
import { calculateSlaTarget } from '../utils/slaUtils.ts';
import {
  Send,
  Sparkles,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Clock,
  Shield,
  Layers,
  RotateCcw,
  Info
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

interface CitizenReportFormProps {
  onSuccessNavigate: () => void;
}

export const CitizenReportForm: React.FC<CitizenReportFormProps> = ({ onSuccessNavigate }) => {
  const { user, signInWithGoogle } = useAuth();

  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [citizenCategory, setCitizenCategory] = useState<string>('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdIssue, setCreatedIssue] = useState<CivicIssue | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    const trimmedDesc = description.trim();
    const trimmedLoc = location.trim();

    if (!user) {
      setErrorMessage('Please sign in with Google before submitting a civic issue report.');
      return;
    }

    if (trimmedDesc.length < 10) {
      setErrorMessage('Please describe the problem in more detail (at least 10 characters).');
      return;
    }

    if (trimmedDesc.length > 8000) {
      setErrorMessage('Description exceeds the maximum limit of 8,000 characters.');
      return;
    }

    if (trimmedLoc.length < 2) {
      setErrorMessage('Please provide a specific street address, intersection, or landmark location.');
      return;
    }

    if (trimmedLoc.length > 300) {
      setErrorMessage('Location exceeds the maximum limit of 300 characters.');
      return;
    }

    setIsProcessing(true);
    setStepMessage('Sanitizing and validating input...');

    try {
      // Step 1: Call Server-side Gemini AI Intelligence
      setStepMessage('Gemini AI analyzing report, extracting category, severity & priority...');
      const response = await fetch('/api/analyze-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: trimmedDesc,
          location: trimmedLoc,
          citizenCategory: citizenCategory || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Server analysis error (${response.status})`);
      }

      const { analysis, analyzedAt } = await response.json();

      // Step 2: Write verified issue to Cloud Firestore
      setStepMessage('Persisting civic intelligence record to Cloud Firestore...');
      const issueId = 'issue_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const nowIso = new Date().toISOString();

      const { targetAt, durationHours } = calculateSlaTarget(nowIso, analysis.severity, analysis.urgency);

      const newIssue: CivicIssue = {
        issueId,
        ownerId: user.uid,
        ownerEmail: user.email || undefined,
        title: analysis.title,
        description: trimmedDesc,
        location: trimmedLoc,
        category: analysis.category,
        severity: analysis.severity,
        urgency: analysis.urgency,
        impact: analysis.impact,
        summary: analysis.summary,
        recommendedAction: analysis.recommendedAction,
        priorityScore: analysis.priorityScore,
        aiConfidence: analysis.aiConfidence,
        status: 'Open',
        createdAt: nowIso,
        updatedAt: nowIso,
        aiAnalyzedAt: analyzedAt || nowIso,
        isDemo: false,
        slaTargetAt: targetAt.toISOString(),
        slaStatus: 'On Track',
      };

      // Write to issues/{issueId}
      try {
        await setDoc(doc(db, 'issues', issueId), newIssue);
      } catch (dbError) {
        handleFirestoreError(dbError, OperationType.CREATE, `issues/${issueId}`);
      }

      // Record in audit log
      try {
        const logId = 'audit_' + Date.now();
        await setDoc(doc(db, 'auditLogs', logId), {
          logId,
          actorId: user.uid,
          actorRole: 'citizen',
          actorEmail: user.email || 'anonymous',
          action: 'ISSUE_CREATED',
          issueId,
          newStatus: 'Open',
          timestamp: nowIso,
          notes: 'Citizen submitted initial civic problem report via CivicLens AI.',
        });
      } catch (auditErr) {
        // Non-blocking for citizen
        console.warn('Audit log write error:', auditErr);
      }

      // Success
      setCreatedIssue(newIssue);
      // Do not clear inputs until confirmed in view
    } catch (err: any) {
      console.error('Error submitting civic issue:', err);
      setErrorMessage(err.message || 'An unexpected error occurred while processing your report. Your input has been saved so you can retry.');
    } finally {
      setIsProcessing(false);
      setStepMessage('');
    }
  };

  const handleStartNewReport = () => {
    setCreatedIssue(null);
    setDescription('');
    setLocation('');
    setCitizenCategory('');
    setErrorMessage(null);
  };

  // If issue just successfully created, show confirmation card with AI intelligence
  if (createdIssue) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Report Submitted & Verified</span>
                <h2 className="text-xl font-bold text-zinc-900">{createdIssue.title}</h2>
              </div>
            </div>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3 py-1 rounded-full">
              Status: Open
            </span>
          </div>

          {/* AI Intelligence Summary Card */}
          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-semibold text-zinc-800">AI Priority Score:</span>
                <span className="text-base font-extrabold text-indigo-600">{createdIssue.priorityScore} / 100</span>
              </div>
              <span className="text-[11px] text-zinc-500 font-medium bg-white px-2 py-0.5 rounded border border-zinc-200">
                Confidence: {(createdIssue.aiConfidence * 100).toFixed(0)}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Category</span>
                <span className="font-semibold text-zinc-800">{createdIssue.category}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Severity</span>
                <span className={`font-semibold ${
                  createdIssue.severity === 'Critical' ? 'text-red-600' :
                  createdIssue.severity === 'High' ? 'text-amber-600' : 'text-zinc-800'
                }`}>
                  {createdIssue.severity}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Urgency</span>
                <span className="font-semibold text-zinc-800">{createdIssue.urgency}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Reported At</span>
                <span className="font-semibold text-zinc-800">{new Date(createdIssue.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-zinc-700 block mb-1">Factual Problem Summary:</span>
              <p className="text-sm text-zinc-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                {createdIssue.summary}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold text-zinc-700 block mb-1">Recommended Municipal Action:</span>
              <p className="text-sm text-zinc-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                {createdIssue.recommendedAction}
              </p>
            </div>

            {createdIssue.slaTargetAt && (
              <div className="bg-indigo-50/60 border border-indigo-200 rounded-lg p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Prototype Advisory SLA Target</span>
                  <span className="text-zinc-700">Advisory resolution target: <strong>{new Date(createdIssue.slaTargetAt).toLocaleString()}</strong></span>
                </div>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-semibold px-2 py-0.5 rounded">
                  Status: On Track
                </span>
              </div>
            )}

            {/* Mandatory Advisory Notice */}
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg flex items-start space-x-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Advisory — human review required:</strong> AI-generated analysis assists municipal officers in triaging and prioritizing issues. An authorized civic officer will review and verify this issue.
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-end space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={handleStartNewReport}
              className="w-full sm:w-auto px-4 py-2 border border-zinc-300 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Report Another Problem
            </button>
            <button
              onClick={onSuccessNavigate}
              className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center justify-center space-x-1.5"
            >
              <Layers className="w-4 h-4" />
              <span>View My Submitted Issues</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 sm:p-8">
        {/* Header */}
        <div className="border-b border-zinc-100 pb-5 mb-6">
          <div className="flex items-center space-x-2 text-indigo-600 mb-1">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Citizen Reporting Portal</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Report a Local Civic Problem</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Describe the problem clearly. CivicLens AI automatically structures your description into actionable municipal intelligence for authorized civic officers.
          </p>
        </div>

        {/* Auth prompt if not signed in */}
        {!user && (
          <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-indigo-600" />
              <div className="text-xs text-indigo-900">
                <span className="font-semibold block">Sign in required to submit reports</span>
                <span>Track issue resolution and receive status updates on your submissions.</span>
              </div>
            </div>
            <button
              onClick={signInWithGoogle}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm shrink-0"
            >
              Sign In with Google
            </button>
          </div>
        )}

        {/* Error notification banner */}
        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 text-red-800 text-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Submission Error</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Main Submission Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location Field */}
          <div>
            <label htmlFor="location" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                <span>Problem Location <span className="text-red-500">*</span></span>
              </span>
              <span className="text-zinc-400 font-normal lowercase">{location.length}/300</span>
            </label>
            <input
              id="location"
              type="text"
              required
              disabled={isProcessing}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Corner of Baner Road and High Street, near Public School #4, Pune"
              maxLength={300}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-60"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Provide cross-streets, specific landmarks, or exact neighborhood details.
            </p>
          </div>

          {/* Optional Category Field */}
          <div>
            <label htmlFor="category" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              <span>Suggested Category (Optional)</span>
            </label>
            <select
              id="category"
              disabled={isProcessing}
              value={citizenCategory}
              onChange={(e) => setCitizenCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-60"
            >
              <option value="">Let Gemini AI determine the most suitable category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Problem Description Field */}
          <div>
            <label htmlFor="description" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Detailed Problem Description <span className="text-red-500">*</span></span>
              <span className={`text-[11px] font-mono ${description.length > 7500 ? 'text-amber-600 font-bold' : 'text-zinc-400 font-normal'}`}>
                {description.length} / 8,000
              </span>
            </label>
            <textarea
              id="description"
              required
              rows={6}
              disabled={isProcessing}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what is broken or happening in detail. What is the hazard? How long has it been there? Who is impacted (e.g. schoolchildren, evening pedestrians, hospital vehicles)?"
              maxLength={8000}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-60 resize-y"
            />
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
              <span>Minimum 10 characters. Do not include sensitive personal identity documents.</span>
              {description.length >= 10 && <span className="text-emerald-600 font-medium">Valid length</span>}
            </div>
          </div>

          {/* AI Notice Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-zinc-600">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-800 block">AI-Assisted Governance</span>
              <span>
                Your description will be processed server-side by <strong>Gemini 3.8 Flash</strong> to calculate an advisory priority score and generate a factual summary. Civic officers retain full decision-making responsibility.
              </span>
            </div>
          </div>

          {/* Live Processing Indicator */}
          {isProcessing && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 animate-in fade-in duration-200">
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-xs">
                  <span className="font-bold text-indigo-900 block">Processing with Civic Intelligence Engine</span>
                  <span className="text-indigo-700">{stepMessage}</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            {errorMessage && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isProcessing}
                className="px-4 py-2.5 border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center space-x-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Save</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isProcessing || !user}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-sm shadow-indigo-200 flex items-center space-x-2 transition-all"
            >
              {isProcessing ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Analyzing & Saving...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Civic Issue</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
