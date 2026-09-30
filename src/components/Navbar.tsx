import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserRole } from '../types.ts';
import {
  ShieldAlert,
  Building2,
  UserCheck,
  LogOut,
  LogIn,
  Layers,
  Sparkles,
  FileText,
  Search,
  TrendingUp,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onSelectPersona: (role: UserRole) => void;
  onOpenDemoModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onSelectPersona,
  onOpenDemoModal,
}) => {
  const { user, activeRole, isOfficer, isAdmin, signInWithGoogle, signOutUser } = useAuth();
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const roles: { role: UserRole; label: string; desc: string }[] = [
    { role: 'citizen', label: 'Citizen', desc: 'Report issues & view own submissions' },
    { role: 'officer', label: 'Civic Officer', desc: 'Access queue, historical search & update status' },
    { role: 'admin', label: 'Admin', desc: 'Full governance, role management & audits' },
  ];

  const handleSelectRole = (selectedRole: UserRole) => {
    setShowRoleMenu(false);
    onSelectPersona(selectedRole);
  };

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-40">
      {/* Prototype Governance Notice Bar */}
      <div className="bg-indigo-900 text-indigo-100 text-xs py-1.5 px-4 text-center font-medium tracking-wide flex items-center justify-center space-x-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>
          <strong>CivicLens AI</strong> is a prototype civic intelligence platform for municipal governance. AI recommendations are advisory and require officer verification.
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Track Badge */}
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => onTabChange(activeRole === 'admin' ? 'admin' : activeRole === 'officer' ? 'dashboard' : 'report')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 to-blue-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-zinc-900 tracking-tight">CivicLens AI</span>
                <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
                  Governance
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-normal hidden sm:block">AI-powered civic issue intelligence</p>
            </div>
          </div>

          {/* Role Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {!isOfficer ? (
              // Citizen Navigation
              <>
                <button
                  onClick={() => onTabChange('report')}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                    currentTab === 'report'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Report an Issue</span>
                </button>

                <button
                  onClick={() => onTabChange('my-issues')}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                    currentTab === 'my-issues'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>My Issues</span>
                </button>
              </>
            ) : (
              // Officer / Admin Navigation
              <>
                {isAdmin && (
                  <button
                    onClick={() => onTabChange('admin')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                      currentTab === 'admin'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Admin</span>
                  </button>
                )}

                <button
                  onClick={() => onTabChange('dashboard')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                    currentTab === 'dashboard'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => onTabChange('historical')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                    currentTab === 'historical'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Historical Search</span>
                </button>

                <button
                  onClick={() => onTabChange('trend-lens')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                    currentTab === 'trend-lens'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Civic Trend Lens</span>
                </button>
              </>
            )}
          </nav>

          {/* Right Action Area */}
          <div className="flex items-center space-x-2.5">
            {/* Seed Demo Data Button */}
            <button
              onClick={onOpenDemoModal}
              title="Populate test civic scenarios for evaluation"
              className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-medium px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Demo Data</span>
            </button>

            {/* Persona / Role Switcher for seamless testing */}
            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center space-x-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-zinc-200 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span className="capitalize">{activeRole}</span>
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </button>

              {showRoleMenu && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-zinc-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setShowRoleMenu(false)}
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Switch Persona View
                  </div>
                  {roles.map((r) => (
                    <button
                      key={r.role}
                      onClick={() => handleSelectRole(r.role)}
                      className={`w-full text-left px-3 py-2 text-xs flex flex-col hover:bg-zinc-50 transition-colors ${
                        activeRole === r.role ? 'bg-indigo-50 border-l-2 border-indigo-600' : ''
                      }`}
                    >
                      <span className="font-semibold text-zinc-800">{r.label}</span>
                      <span className="text-zinc-500 text-[11px]">{r.desc}</span>
                    </button>
                  ))}
                  <div className="border-t border-zinc-100 mt-1 pt-1 px-3 py-1 text-[10px] text-zinc-400">
                    Switching roles lets evaluators test both Citizen and Officer permissions.
                  </div>
                </div>
              )}
            </div>

            {/* Auth Button */}
            {user ? (
              <div className="flex items-center space-x-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full border border-zinc-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={signOutUser}
                  title="Sign out"
                  className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm shadow-indigo-200 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden border-t border-zinc-100 py-2 space-x-2 overflow-x-auto text-xs">
          {!isOfficer ? (
            <>
              <button
                onClick={() => onTabChange('report')}
                className={`px-3 py-1.5 rounded-md font-medium shrink-0 ${
                  currentTab === 'report' ? 'bg-indigo-600 text-white' : 'text-zinc-600 bg-zinc-100'
                }`}
              >
                Report Issue
              </button>
              <button
                onClick={() => onTabChange('my-issues')}
                className={`px-3 py-1.5 rounded-md font-medium shrink-0 ${
                  currentTab === 'my-issues' ? 'bg-indigo-600 text-white' : 'text-zinc-600 bg-zinc-100'
                }`}
              >
                My Issues
              </button>
            </>
          ) : (
            <>
              {isAdmin && (
                <button
                  onClick={() => onTabChange('admin')}
                  className={`px-3 py-1.5 rounded-md font-medium shrink-0 ${
                    currentTab === 'admin' ? 'bg-indigo-600 text-white' : 'text-zinc-600 bg-zinc-100'
                  }`}
                >
                  Admin
                </button>
              )}
              <button
                onClick={() => onTabChange('dashboard')}
                className={`px-3 py-1.5 rounded-md font-medium shrink-0 ${
                  currentTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-zinc-600 bg-zinc-100'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onTabChange('historical')}
                className={`px-3 py-1.5 rounded-md font-medium shrink-0 ${
                  currentTab === 'historical' ? 'bg-indigo-600 text-white' : 'text-zinc-600 bg-zinc-100'
                }`}
              >
                Historical
              </button>
              <button
                onClick={() => onTabChange('trend-lens')}
                className={`px-3 py-1.5 rounded-md font-medium shrink-0 ${
                  currentTab === 'trend-lens' ? 'bg-indigo-600 text-white' : 'text-zinc-600 bg-zinc-100'
                }`}
              >
                Trend Lens
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
