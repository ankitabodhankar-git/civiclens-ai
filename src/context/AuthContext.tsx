import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase.ts';
import { UserProfile, UserRole } from '../types.ts';

const BOOTSTRAP_ADMIN_EMAIL = 'ankitabodhankar90@gmail.com';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  activeRole: UserRole;
  isOfficer: boolean;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  switchRolePreview: (role: UserRole) => void;
  updateUserRole: (targetUid: string, newRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [roleOverride, setRoleOverride] = useState<UserRole | null>(() => {
    try {
      const saved = localStorage.getItem('civiclens_persona_override');
      if (saved === 'citizen' || saved === 'officer' || saved === 'admin') {
        return saved;
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            // Ensure bootstrapped admin email always has admin role
            if (currentUser.email === BOOTSTRAP_ADMIN_EMAIL && data.role !== 'admin') {
              const updatedData: UserProfile = { ...data, role: 'admin', updatedAt: new Date().toISOString() };
              await updateDoc(userDocRef, { role: 'admin', updatedAt: updatedData.updatedAt });
              setProfile(updatedData);
            } else {
              setProfile(data);
            }
          } else {
            // New user registration
            const isDefaultAdmin = currentUser.email === BOOTSTRAP_ADMIN_EMAIL;
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Civic Participant',
              email: currentUser.email || '',
              role: isDefaultAdmin ? 'admin' : 'citizen',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          console.error('Error fetching/creating user profile:', err);
          // Fallback profile if Firestore permission is initial
          setProfile({
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Civic Participant',
            email: currentUser.email || '',
            role: currentUser.email === BOOTSTRAP_ADMIN_EMAIL ? 'admin' : 'citizen',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        setProfile(null);
        setRoleOverride(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Sign In failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setProfile(null);
      setRoleOverride(null);
      try {
        localStorage.removeItem('civiclens_persona_override');
      } catch {}
    } catch (err) {
      console.error('Sign Out failed:', err);
    }
  };

  const switchRolePreview = (role: UserRole) => {
    setRoleOverride(role);
    try {
      localStorage.setItem('civiclens_persona_override', role);
    } catch {}
  };

  const updateUserRole = async (targetUid: string, newRole: UserRole) => {
    if (!user) throw new Error('Unauthenticated');
    const path = `users/${targetUid}`;
    try {
      const userRef = doc(db, 'users', targetUid);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: new Date().toISOString(),
      });
      if (profile && profile.uid === targetUid) {
        setProfile({ ...profile, role: newRole, updatedAt: new Date().toISOString() });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const activeRole: UserRole = useMemo(() => {
    if (roleOverride) return roleOverride;
    if (profile?.role) return profile.role;
    if (user?.email === BOOTSTRAP_ADMIN_EMAIL) return 'admin';
    return 'citizen';
  }, [roleOverride, profile, user]);

  const isOfficer = activeRole === 'officer' || activeRole === 'admin';
  const isAdmin = activeRole === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        activeRole,
        isOfficer,
        isAdmin,
        loading,
        signInWithGoogle,
        signOutUser,
        switchRolePreview,
        updateUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
