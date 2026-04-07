import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBemrfSlRyBNRI4fPl41jRE5k9MYamCGRk",
  authDomain: "keelung-sbir.firebaseapp.com",
  projectId: "keelung-sbir",
  storageBucket: "keelung-sbir.firebasestorage.app",
  messagingSenderId: "260024336544",
  appId: "1:260024336544:web:1a8ba0cba7f368525149c5",
  measurementId: "G-0NVM5HG96X",
};

export const workshopApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const workshopDb = getFirestore(workshopApp);

let analyticsInstance: Analytics | null = null;

/**
 * 僅在瀏覽器端且可用時初始化 Analytics；SSR 階段不會觸發。
 */
export async function initWorkshopAnalytics(): Promise<Analytics | null> {
  if (analyticsInstance) return analyticsInstance;
  if (typeof window === "undefined") return null;
  const ok = await isSupported().catch(() => false);
  if (!ok) return null;
  analyticsInstance = getAnalytics(workshopApp);
  return analyticsInstance;
}
