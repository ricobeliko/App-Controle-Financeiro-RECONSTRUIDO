// src/context/AppContext.jsx

import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, functions, getUserCollectionPathSegments } from '../utils/firebase';

// 1. O Contexto é criado e EXPORTADO aqui
export const AppContext = createContext();

// 2. O hook customizado é criado e EXPORTADO aqui
export const useAppContext = () => {
    return useContext(AppContext);
};

// 3. O "Provider" que gerencia o estado global é criado e EXPORTADO aqui
export function AppProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user && user.uid) {
                try {
                    const userCollectionPath = getUserCollectionPathSegments();
                    const userDocRef = doc(db, ...userCollectionPath, user.uid);
                    const docSnap = await getDoc(userDocRef);
                    setUserProfile(docSnap.exists() ? docSnap.data() : null);
                } catch (error) {
                    console.error("Erro ao buscar perfil do usuário:", error);
                    setUserProfile(null);
                }
            } else {
                setUserProfile(null);
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    const showToast = (text, type = 'info') => setToastMessage({ text, type });
    const clearToast = () => setToastMessage(null);

    const value = {
        currentUser,
        userId: currentUser?.uid,
        userProfile,
        isPro: userProfile?.plan === 'pro',
        isAuthReady,
        showToast,
        toastMessage,
        clearToast,
        db,
        auth,
        functions,
        getUserCollectionPathSegments,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
