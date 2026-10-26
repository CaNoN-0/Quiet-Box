import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile as updateFirebaseAuthProfile,
  signOut as firebaseSignOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { auth, googleAuthProvider, firebaseProjectId } from '../lib/firebase';
import {
  AnonymousPageDTO,
  fetchMyAccount,
  ProfileDTO,
} from '../lib/api';

interface AuthContextValue {
  user: User | null;
  profile: ProfileDTO | null;
  page: AnonymousPageDTO | null;
  loading: boolean;
  accountError: string | null;
  projectId: string;
  refreshAccount: () => Promise<void>;
  setPageState: (page: AnonymousPageDTO | null) => void;
  setProfileState: (profile: ProfileDTO | null) => void;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUserVerification: () => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<void>;
  changeAccountPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  reauthenticateForDeletion: (currentPassword?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface MappedAuthError {
  message: string;
  needsEmailProviderSetup?: boolean;
  unauthorizedDomain?: string;
}

export function mapFirebaseAuthError(err: any): MappedAuthError {
  const code = err?.code || '';
  const rawMessage = err instanceof Error ? err.message : String(err || '');

  if (code === 'auth/unauthorized-domain' || rawMessage.includes('auth/unauthorized-domain')) {
    const currentHost =
      typeof window !== 'undefined' && window.location?.hostname
        ? window.location.hostname
        : 'current app domain';
    return {
      message: `Google popup sign-in requires "${currentHost}" to be listed under Authorized Domains in your Firebase project.`,
      unauthorizedDomain: currentHost,
    };
  }

  switch (code) {
    case 'auth/operation-not-allowed':
      return {
        message:
          'Email/Password sign-in is not yet enabled in your Firebase Console. You can sign in immediately with Google, or enable Email/Password in Firebase Console > Authentication > Sign-in method.',
        needsEmailProviderSetup: true,
      };
    case 'auth/popup-blocked':
      return {
        message:
          'Your browser blocked the sign-in popup window. Please allow popups for this site and try again.',
      };
    case 'auth/email-already-in-use':
      return { message: 'An account with this email address already exists. Please sign in instead.' };
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return { message: 'Incorrect email or password. Please double-check your credentials.' };
    case 'auth/weak-password':
      return { message: 'Password must be at least 8 characters long.' };
    case 'auth/invalid-email':
      return { message: 'Please enter a valid email address.' };
    case 'auth/too-many-requests':
      return { message: 'Too many attempts. Please wait a few minutes before trying again.' };
    case 'auth/popup-closed-by-user':
      return { message: 'Sign-in window was closed before completing authentication.' };
    case 'auth/requires-recent-login':
      return { message: 'For your security, please confirm your current credentials before continuing.' };
    default:
      return { message: err instanceof Error ? err.message : 'Authentication failed. Please try again.' };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [page, setPage] = useState<AnonymousPageDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);

  const loadBackendAccount = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setProfile(null);
      setPage(null);
      setAccountError(null);
      return;
    }
    try {
      setAccountError(null);
      const data = await fetchMyAccount();
      setProfile(data.profile);
      setPage(data.page);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Unable to load account details.');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        await loadBackendAccount(nextUser);
      } else {
        setProfile(null);
        setPage(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [loadBackendAccount]);

  const refreshAccount = useCallback(async () => {
    if (auth.currentUser) {
      await loadBackendAccount(auth.currentUser);
    }
  }, [loadBackendAccount]);

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    await loadBackendAccount(cred.user);
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName.trim()) {
      await updateFirebaseAuthProfile(cred.user, { displayName: displayName.trim() });
    }
    try {
      await sendEmailVerification(cred.user);
    } catch (verifyErr) {
      console.warn('Unable to dispatch initial verification email:', verifyErr);
    }
    await loadBackendAccount(cred.user);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await loadBackendAccount(cred.user);
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    await sendEmailVerification(auth.currentUser);
  };

  const reloadUserVerification = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    setUser({ ...auth.currentUser } as User);
    await loadBackendAccount(auth.currentUser);
    return Boolean(auth.currentUser.emailVerified);
  };

  const requestPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const changeAccountPassword = async (currentPassword: string, newPassword: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error('No active email session found.');
    }
    if (currentPassword) {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
    }
    await updatePassword(currentUser, newPassword);
  };

  const reauthenticateForDeletion = async (currentPassword?: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not signed in.');
    const hasPasswordProvider = currentUser.providerData.some((p) => p.providerId === 'password');
    if (hasPasswordProvider && currentPassword && currentUser.email) {
      const cred = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, cred);
    } else if (!hasPasswordProvider) {
      await reauthenticateWithPopup(currentUser, googleAuthProvider);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
    setPage(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        page,
        loading,
        accountError,
        projectId: firebaseProjectId,
        refreshAccount,
        setPageState: setPage,
        setProfileState: setProfile,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        resendVerificationEmail,
        reloadUserVerification,
        requestPasswordReset,
        changeAccountPassword,
        reauthenticateForDeletion,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
