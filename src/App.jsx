// src/App.jsx - VERSÃO FINAL E REFATORADA

import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// 1. IMPORTANDO DE LOCAIS CENTRALIZADOS
import { auth, db, functions, getUserCollectionPathSegments } from './utils/firebase'; 
import AuthScreen from './features/auth/AuthScreen';
import Dashboard from './features/dashboard/Dashboard';
import ClientManagement from './features/clients/ClientManagement';
import CardManagement from './features/cards/CardManagement';
import LoanManagement from './features/loans/LoanManagement';
import SubscriptionManagement from './features/subscriptions/SubscriptionManagement';
import Toast from './components/Toast';

// 2. O CONTEXTO É CRIADO AQUI
export const AppContext = createContext();

// 3. HOOK CUSTOMIZADO PARA FACILITAR O USO DO CONTEXTO
export const useAppContext = () => {
    return useContext(AppContext);
};

// 4. O "PROVIDER" QUE GERENCIA O ESTADO GLOBAL
function AppProvider({ children }) {
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

// 5. O COMPONENTE APP (AGORA APENAS O LAYOUT)
function App() {
    const { isAuthReady, currentUser, toastMessage, clearToast } = useAppContext();
    const [activeTab, setActiveTab] = useState('resumo');
    const [theme, setTheme] = useState('dark');
    const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

    // Filtros que são compartilhados entre abas
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    });
    const [selectedCardFilter, setSelectedCardFilter] = useState('');
    const [selectedClientFilter, setSelectedClientFilter] = useState('');

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    const handleLogout = () => {
        signOut(auth);
    };
    const toggleTheme = () => setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));

    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900">
                <div className="text-lg font-semibold text-gray-300">A carregar aplicação...</div>
            </div>
        );
    }
    
    if (!currentUser || !currentUser.emailVerified) {
        return <AuthScreen />;
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-inter text-gray-900 dark:text-gray-100 transition-colors duration-300">
            <header className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-gray-800 dark:to-gray-900 text-white p-4 shadow-md rounded-b-lg">
                <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
                    <h1 className="text-3xl font-bold mb-2 sm:mb-0">Controle Financeiro de Cartões</h1>
                    <nav className="flex flex-wrap space-x-2 sm:space-x-4 items-center">
                        <button onClick={() => setActiveTab('resumo')} className={`py-2 px-3 sm:px-4 rounded-lg transition duration-300 ${activeTab === 'resumo' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700'}`}>Resumo</button>
                        <button onClick={() => setActiveTab('pessoas')} className={`py-2 px-3 sm:px-4 rounded-lg transition duration-300 ${activeTab === 'pessoas' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700'}`}>Pessoas</button>
                        <button onClick={() => setActiveTab('cards')} className={`py-2 px-3 sm:px-4 rounded-lg transition duration-300 ${activeTab === 'cards' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700'}`}>Cartões</button>
                        <button onClick={() => setActiveTab('purchases')} className={`py-2 px-3 sm:px-4 rounded-lg transition duration-300 ${activeTab === 'purchases' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700'}`}>Compras</button>
                        <button onClick={() => setActiveTab('subscriptions')} className={`py-2 px-3 sm:px-4 rounded-lg transition duration-300 ${activeTab === 'subscriptions' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700'}`}>Assinaturas</button>
                        <div className="relative">
                            <button onClick={() => setShowSettingsDropdown(prev => !prev)} className="ml-2 sm:ml-4 p-2 rounded-full text-white hover:bg-blue-700 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-800 dark:focus:ring-offset-gray-900 focus:ring-white" title="Configurações">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                            </button>
                            {showSettingsDropdown && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5" onMouseLeave={() => setShowSettingsDropdown(false)}>
                                    <button onClick={() => { toggleTheme(); setShowSettingsDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
                                        {theme === 'light' ? '🌙' : '☀️'} Alternar Tema
                                    </button>
                                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-800 flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-out mr-2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                                        Sair
                                    </button>
                                </div>
                            )}
                        </div>
                    </nav>
                </div>
            </header>
            <main className="container mx-auto p-4 mt-4">
                {activeTab === 'resumo' && <Dashboard {...{ selectedMonth, setSelectedMonth, selectedCardFilter, setSelectedCardFilter, selectedClientFilter, setSelectedClientFilter }} />}
                {activeTab === 'pessoas' && <ClientManagement />}
                {activeTab === 'cards' && <CardManagement />}
                {activeTab === 'purchases' && <LoanManagement />}
                {activeTab === 'subscriptions' && <SubscriptionManagement {...{ selectedMonth, setSelectedMonth }} />}
            </main>
            <Toast message={toastMessage} onClose={clearToast} />
        </div>
    );
}

// 6. O COMPONENTE FINAL QUE É EXPORTADO
function AppWrapper() {
    return (
        <AppProvider>
            <App />
        </AppProvider>
    );
}

export default AppWrapper;
