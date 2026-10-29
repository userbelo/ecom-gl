import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { get, getDatabase, onValue, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCuuYjhZ8lxLxSv5YmgZJUG993exPnYw3E",
  authDomain: "ecom-f9ef5.firebaseapp.com",
  databaseURL: "https://ecom-f9ef5-default-rtdb.firebaseio.com",
  projectId: "ecom-f9ef5",
  storageBucket: "ecom-f9ef5.firebasestorage.app",
  messagingSenderId: "660715995787",
  appId: "1:660715995787:web:cdc3fbbf73327f52ca4a8e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export async function getCatalog() {
  const snapshot = await get(ref(database, "catalog"));
  if (snapshot.exists()) return snapshot.val();

  const response = await fetch("/catalog.seed.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("O catálogo ainda não foi configurado no Firebase.");
  }
  return response.json();
}

export async function saveCatalog(catalog: unknown) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Sua sessão expirou. Entre novamente para salvar.");
  }

  try {
    await user.getIdToken();
  } catch {
    throw new Error("Sua sessão expirou. Entre novamente para salvar.");
  }

  const cleanCatalog = JSON.parse(
    JSON.stringify(catalog, (_key, value) =>
      value === undefined ? null : value,
    ),
  );

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await set(ref(database, "catalog"), cleanCatalog);
      return cleanCatalog;
    } catch (error) {
      lastError = error;
      const code = error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
      if (code.includes("PERMISSION_DENIED")) {
        throw new Error(
          "O Firebase recusou o salvamento. Verifique as regras do Realtime Database e faça login novamente.",
        );
      }
      if (attempt === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 600));
      }
    }
  }

  console.error("Falha persistente ao salvar o catálogo:", lastError);
  throw new Error(
    "Não foi possível salvar agora. Verifique sua conexão e tente novamente.",
  );
}

export function watchCatalog(callback: (catalog: unknown) => void) {
  return onValue(ref(database, "catalog"), (snapshot) => {
    if (snapshot.exists()) callback(snapshot.val());
  });
}

export function watchAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}
