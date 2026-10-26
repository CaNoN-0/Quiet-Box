import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import firebaseConfig from '../../firebase-applet-config.json';

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore(firebaseConfig.firestoreDatabaseId);
export const adminStorage = getStorage();
export const configuredStorageBucket = firebaseConfig.storageBucket;
