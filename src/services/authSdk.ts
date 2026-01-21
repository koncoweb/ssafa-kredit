import { deleteApp, getApps, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, firebaseConfig } from './firebase';

type AuthUser = { uid: string; email: string | null };

export async function loginEmailAuth(email: string, password: string): Promise<AuthUser> {
  const cred: any = await signInWithEmailAndPassword(auth as any, email, password);
  return { uid: cred.user?.uid, email: cred.user?.email ?? null };
}

export async function registerEmailAuth(email: string, password: string): Promise<AuthUser> {
  const cred: any = await createUserWithEmailAndPassword(auth as any, email, password);
  return { uid: cred.user?.uid, email: cred.user?.email ?? null };
}

// Function to create secondary user without logging out the current admin
export async function createSecondaryUser(email: string, password: string): Promise<AuthUser> {
  let secondaryApp;
  try {
    // Check if app exists or create new unique one
    const appName = 'SecondaryApp';
    const apps = getApps();
    secondaryApp = apps.find((a: any) => a.name === appName) || initializeApp(firebaseConfig, appName);
    
    const secondaryAuth = getAuth(secondaryApp);
    const cred: any = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    
    // Important: Sign out immediately from secondary auth so it doesn't interfere
    await signOut(secondaryAuth);
    
    return { uid: cred.user?.uid, email: cred.user?.email ?? null };
  } catch (error) {
    throw error;
  } finally {
    // Always clean up the secondary app to prevent "Duplicate App" errors or stale state
    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp); 
      } catch (e) {
        console.warn('Error deleting secondary app:', e);
      }
    }
  }
}

