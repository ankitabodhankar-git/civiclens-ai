import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { collection, getDocs, doc, setDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { UserProfile, UserRole, AuditLog } from '../types.ts';
import {
  SlidersHorizontal,
  Users,
  ShieldCheck,
  UserCog,
  Check,
  History,
  AlertCircle
} from 'lucide-react';

export const AdminManagement: React.FC = () => {
  const { user, profile, isAdmin, updateUserRole } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchAuditLogs();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg(null);
    const path = 'users';
    try {
      const snap = await getDocs(collection(db, path));
      const list: UserProfile[] = [];
      snap.forEach((d) => list.push(d.data() as UserProfile));
      setUsers(list);
    } catch (err: any) {
      console.error('Error fetching users for admin:', err);
      setErrorMsg('Could not fetch user directory. Verify admin permissions.');
      handleFirestoreError(err, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    const path = 'auditLogs';
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      const list: AuditLog[] = [];
      snap.forEach((d) => list.push(d.data() as AuditLog));
      setAuditLogs(list.slice(0, 30));
    } catch (e) {
      console.warn('Audit trail query warning:', e);
    }
  };

  const handleRoleChange = async (targetUid: string, targetEmail: string, newRole: UserRole) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateUserRole(targetUid, newRole);

      // Audit log
      if (user) {
        const logId = 'audit_' + Date.now();
        await setDoc(doc(db, 'auditLogs', logId), {
          logId,
          actorId: user.uid,
          actorRole: 'admin',
          actorEmail: user.email || 'admin',
          action: 'ROLE_ASSIGNED',
          timestamp: new Date().toISOString(),
          notes: `Admin assigned role '${newRole}' to user ${targetEmail} (${targetUid}).`,
        });
      }

      setSuccessMsg(`Successfully updated role to ${newRole} for ${targetEmail}.`);
      fetchUsers();
      fetchAuditLogs();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update role.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-zinc-900">Access Restricted</h2>
        <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
          The administration portal requires verified Admin credentials. Please contact the municipal system administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200">
        <div className="flex items-center space-x-2 text-indigo-600 mb-1">
          <SlidersHorizontal className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Governance Administration</span>
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">User & Role Management</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Assign authorized Civic Officer and Admin privileges to governance staff and community supervisors.
        </p>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-xl flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3.5 rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Registered System Users</span>
          </div>
          <span className="text-xs text-zinc-500 font-medium">{users.length} Total Users</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-400">Loading user registry...</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            No users registered in the database yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Email Address</th>
                  <th className="px-6 py-3">Current Role</th>
                  <th className="px-6 py-3">Registered Date</th>
                  <th className="px-6 py-3 text-right">Assign Authority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-zinc-900 whitespace-nowrap">
                      {u.displayName || 'Civic Participant'}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 whitespace-nowrap">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`font-semibold px-2.5 py-0.5 rounded-full text-[11px] ${
                          u.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : u.role === 'officer'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400 whitespace-nowrap">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.uid, u.email, e.target.value as UserRole)}
                        className="px-2.5 py-1 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="citizen">Citizen</option>
                        <option value="officer">Civic Officer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Governance Audit Log History */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-zinc-100 pb-3">
          <History className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            System Security & Action Audit Trail
          </h2>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-zinc-400 py-4 text-center">No system audit events recorded yet.</p>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div
                key={log.logId}
                className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-zinc-800">{log.action}</span>
                    <span className="text-[10px] text-zinc-400">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-zinc-600">{log.notes}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-zinc-400 block">Actor: {log.actorEmail}</span>
                  <span className="bg-zinc-200 text-zinc-700 px-1.5 py-0.2 rounded text-[10px] uppercase font-bold">
                    {log.actorRole}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
