import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { CitizenReportForm } from './components/CitizenReportForm.tsx';
import { CitizenMyIssues } from './components/CitizenMyIssues.tsx';
import { OfficerDashboard } from './components/OfficerDashboard.tsx';
import { HistoricalSearch } from './components/HistoricalSearch.tsx';
import { CivicTrendLens } from './components/CivicTrendLens.tsx';
import { AdminManagement } from './components/AdminManagement.tsx';
import { IssueDetailModal } from './components/IssueDetailModal.tsx';
import { DemoDataModal } from './components/DemoDataModal.tsx';
import { CivicIssue, UserRole } from './types.ts';
import { Sparkles, Shield, Building2 } from 'lucide-react';

export const PERSONA_PRIMARY_TAB: Record<UserRole, string> = {
  citizen: 'report',
  officer: 'dashboard',
  admin: 'admin',
};

export const PERSONA_ALLOWED_TABS: Record<UserRole, string[]> = {
  citizen: ['report', 'my-issues'],
  officer: ['dashboard', 'historical', 'trend-lens'],
  admin: ['admin', 'dashboard', 'historical', 'trend-lens'],
};

const AppContent: React.FC = () => {
  const { user, activeRole, isOfficer, isAdmin, loading, switchRolePreview } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('civiclens_persona_override') as UserRole | null;
      if (saved && PERSONA_PRIMARY_TAB[saved]) {
        return PERSONA_PRIMARY_TAB[saved];
      }
    } catch {}
    return PERSONA_PRIMARY_TAB.citizen;
  });
  const [selectedIssue, setSelectedIssue] = useState<CivicIssue | null>(null);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  // Synchronous persona switcher handler - Requirement 4
  const handleSelectPersona = (newRole: UserRole) => {
    switchRolePreview(newRole);
    setCurrentTab(PERSONA_PRIMARY_TAB[newRole]);
  };

  // Requirement 6: Compute effective tab using persona-to-primary-tab mapping
  const primaryTab = PERSONA_PRIMARY_TAB[activeRole] || 'report';
  const allowedTabs = PERSONA_ALLOWED_TABS[activeRole] || ['report'];
  const effectiveTab = allowedTabs.includes(currentTab) ? currentTab : primaryTab;

  // Keep internal state aligned if effectiveTab resolved to a fallback
  React.useEffect(() => {
    if (currentTab !== effectiveTab) {
      setCurrentTab(effectiveTab);
    }
  }, [currentTab, effectiveTab]);

  const handleOpenTrendLensWithDates = (startDate: string, endDate: string) => {
    setCurrentTab('trend-lens');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <Navbar
        currentTab={effectiveTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onSelectPersona={handleSelectPersona}
        onOpenDemoModal={() => setIsDemoModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Citizen Persona Workspace */}
        {activeRole === 'citizen' && (
          <>
            {effectiveTab === 'my-issues' ? (
              <CitizenMyIssues
                onSelectIssue={(issue) => setSelectedIssue(issue)}
                onNavigateReport={() => setCurrentTab('report')}
              />
            ) : (
              <CitizenReportForm onSuccessNavigate={() => setCurrentTab('my-issues')} />
            )}
          </>
        )}

        {/* Civic Officer Persona Workspace */}
        {activeRole === 'officer' && (
          <>
            {effectiveTab === 'historical' && (
              <HistoricalSearch
                onSelectIssue={(issue) => setSelectedIssue(issue)}
                onOpenTrendLensWithDates={handleOpenTrendLensWithDates}
              />
            )}
            {effectiveTab === 'trend-lens' && (
              <CivicTrendLens
                onSelectIssue={(issue) => setSelectedIssue(issue)}
              />
            )}
            {effectiveTab === 'dashboard' && (
              <OfficerDashboard
                onSelectIssue={(issue) => setSelectedIssue(issue)}
                onNavigateTab={(tab) => setCurrentTab(tab)}
              />
            )}
          </>
        )}

        {/* Admin Persona Workspace */}
        {activeRole === 'admin' && (
          <>
            {effectiveTab === 'admin' && <AdminManagement />}
            {effectiveTab === 'dashboard' && (
              <OfficerDashboard
                onSelectIssue={(issue) => setSelectedIssue(issue)}
                onNavigateTab={(tab) => setCurrentTab(tab)}
              />
            )}
            {effectiveTab === 'historical' && (
              <HistoricalSearch
                onSelectIssue={(issue) => setSelectedIssue(issue)}
                onOpenTrendLensWithDates={handleOpenTrendLensWithDates}
              />
            )}
            {effectiveTab === 'trend-lens' && (
              <CivicTrendLens
                onSelectIssue={(issue) => setSelectedIssue(issue)}
              />
            )}
          </>
        )}
      </main>

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onIssueUpdated={(updated) => setSelectedIssue(updated)}
          onSelectIssue={(issue) => setSelectedIssue(issue)}
        />
      )}

      {/* Demo Data Seeding Modal */}
      <DemoDataModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />

      {/* Production Governance Footer */}
      <footer className="bg-white border-t border-zinc-200 py-6 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              CL
            </div>
            <span className="font-semibold text-zinc-800">CivicLens AI</span>
            <span className="text-zinc-400">·</span>
            <span>Governance Technology Prototype</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px] text-zinc-400">
            <span>Powered by Gemini 3.8 Flash</span>
            <span>·</span>
            <span>Cloud Firestore</span>
            <span>·</span>
            <span>Firebase Auth</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
