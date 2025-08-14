// src/App.jsx

import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useAppContext } from './context/AppContext'; 
// CAMINHO CORRIGIDO AQUI
import { auth, functions, db } from './utils/firebase'; 
import AuthScreen from './features/auth/AuthScreen';
import Dashboard from './features/dashboard/Dashboard';
import ClientManagement from './features/clients/ClientManagement';
import CardManagement from './features/cards/CardManagement';
import LoanManagement from './features/loans/LoanManagement';
import SubscriptionManagement from './features/subscriptions/SubscriptionManagement';
import Toast from './components/Toast';

// --- COMPONENTE UserStatusBadge ---
const ShieldCheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
);
const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
function UserStatusBadge() {
    const { isPro, functions, showToast } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    const handleUpgrade = async () => {
        setIsLoading(true);
        try {
            const createStripeCheckout = httpsCallable(functions, 'createStripeCheckout');
            const result = await createStripeCheckout();
            const { url } = result.data;
            window.location.href = url;
        } catch (error) {
            console.error("Erro ao chamar a Cloud Function de checkout:", error);
            showToast(error.message || "Ocorreu um erro ao iniciar o processo de upgrade. Tente novamente.", "error");
            setIsLoading(false);
        }
    };
    if (isPro) {
        return (
            <div className="flex items-center gap-2 bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 rounded-full px-4 py-1 text-sm font-semibold" title="A sua conta é Pro!">
                <ShieldCheckIcon />
                <span>PRO</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded-full px-4 py-1 text-sm font-semibold" title="A sua conta é Free">
                <ShieldIcon />
                <span>FREE</span>
            </div>
            <button
                onClick={handleUpgrade}
                disabled={isLoading}
                className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:scale-105 transform transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
                {isLoading ? 'Aguarde...' : 'Tornar-se PRO ✨'}
            </button>
        </div>
    );
}

// --- COMPONENTE PRINCIPAL: App ---
function App() {
    const { isAuthReady, currentUser, toastMessage, clearToast } = useAppContext();
    const [activeTab, setActiveTab] = useState('resumo');
    const [theme, setTheme] = useState('dark');
    const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
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
                <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl md:text-3xl font-bold">Controlo Financeiro</h1>
                        <UserStatusBadge />
                    </div>
                    <nav className="flex flex-wrap space-x-1 sm:space-x-2 items-center">
                        <button onClick={() => setActiveTab('resumo')} className={`py-2 px-3 rounded-lg transition duration-300 text-sm ${activeTab === 'resumo' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700'}`}>Resumo</button>
                        <button onClick={() => setActiveTab('pessoas')} className={`py-2 px-3 rounded-lg transition duration-300 text-sm ${activeTab === 'pessoas' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700'}`}>Pessoas</button>
                        <button onClick={() => setActiveTab('cards')} className={`py-2 px-3 rounded-lg transition duration-300 text-sm ${activeTab === 'cards' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700'}`}>Cartões</button>
                        <button onClick={() => setActiveTab('purchases')} className={`py-2 px-3 rounded-lg transition duration-300 text-sm ${activeTab === 'purchases' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700'}`}>Compras</button>
                        <button onClick={() => setActiveTab('subscriptions')} className={`py-2 px-3 rounded-lg transition duration-300 text-sm ${activeTab === 'subscriptions' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700'}`}>Assinaturas</button>
                        <div className="relative">
                            <button onClick={() => setShowSettingsDropdown(prev => !prev)} className="ml-2 p-2 rounded-full text-white hover:bg-blue-700 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-800 dark:focus:ring-offset-gray-900 focus:ring-white" title="Configurações">
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

export default App;
