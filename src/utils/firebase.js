// src/utils/firebase.js

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

// Exporta as instâncias dos serviços do Firebase para serem usadas em toda a aplicação
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

/**
 * Constrói o caminho da coleção de dados do usuário no Firestore.
 */
export const getUserCollectionPathSegments = () => {
    if (typeof window.__app_id !== 'undefined') {
        return ['artifacts', window.__app_id, 'users'];
    } else {
        // O aviso agora fica aqui, em um só lugar
        console.warn("AVISO: __app_id não está definido. Usando um caminho de fallback 'users_fallback'.");
        return ['users_fallback'];
    }
};