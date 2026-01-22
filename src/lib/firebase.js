import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDoc, getDocs, where, serverTimestamp, runTransaction, writeBatch, documentId } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from "firebase/auth";

// TODO: Replace with your Firebase project configuration
// Go to https://console.firebase.google.com/
// Create a new project, register a web app, and copy the config here.
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
let db;
let auth;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (e) {
    console.warn("Firebase not configured correctly yet or running in offline mode.");
}

const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, collection, addDoc, updateDoc, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDoc, getDocs, where, serverTimestamp, runTransaction, writeBatch, documentId };
