// src/utils/firebase.js - VERSÃO FINAL PARA USAR A BASE DE DADOS ANTIGA

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export { firebaseConfig };

/**
 * Constrói o caminho da coleção de dados do utilizador no Firestore.
 * Aponta permanentemente para a coleção 'users_fallback'.
 */
export const getUserCollectionPathSegments = () => {
    // Retorna o caminho para a sua base de dados original.
    return ['users_fallback'];
};
