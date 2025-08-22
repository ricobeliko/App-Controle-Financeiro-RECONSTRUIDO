// src/features/dashboard/DashboardLayout.jsx

import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useAppContext } from '../../context/AppContext';
import { auth, functions } from '../../utils/firebase';

// Importe as páginas do painel
import Dashboard from './Dashboard';
import ClientManagement from '../clients/ClientManagement';
import CardManagement from '../cards/CardManagement';
import UnifiedTransactionManagement from '../transactions/TransactionManagement';
import SubscriptionManagement from '../subscriptions/SubscriptionManagement';
import Toast from '../../components/Toast';

// --- Ícones para o Layout e Sidebar ---
const FinControlLogo = ({ className }) => (
    <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
const HomeIcon = () => <svg xmlns="http://www.w.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const UsersIconNav = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const CreditCardIconNav = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>;
const ListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>;
const RepeatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>;
const LogoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>;

// --- Componente de Status do Usuário ---
const ShieldCheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
const ShieldIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const StarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>;

function UserStatusBadge() {
    const { isPro, isTrialActive, userProfile, showToast, activateFreeTrial } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState('');

    useEffect(() => {
        if (isTrialActive && userProfile?.trialExpiresAt) {
            const trialEndDate = userProfile.trialExpiresAt.toDate().getTime();
            const updateRemainingTime = () => {
                const now = new Date().getTime();
                const difference = trialEndDate - now;
                if (difference > 0) {
                    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    setTimeRemaining(`${days}d ${hours}h restantes`);
                } else { setTimeRemaining('Expirado'); }
            };
            updateRemainingTime();
            const interval = setInterval(updateRemainingTime, 1000 * 60);
            return () => clearInterval(interval);
        }
    }, [isTrialActive, userProfile]);

    const handleUpgrade = async () => {
        setIsLoading(true);
        try {
            const createStripeCheckout = httpsCallable(functions, 'createStripeCheckout');
            const { url } = (await createStripeCheckout()).data;
            window.location.href = url;
        } catch (error) {
            console.error("Erro ao chamar a Cloud Function de checkout:", error);
            showToast(error.message || "Ocorreu um erro ao iniciar o processo de upgrade.", "error");
            setIsLoading(false);
        }
    };

    if (userProfile?.plan === 'pro') return <div className="flex items-center gap-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-full px-3 py-1 text-xs font-semibold"><ShieldCheckIcon /><span>PRO</span></div>;
    if (isTrialActive) return <div className="flex items-center gap-2 bg-green-400/10 text-green-400 border border-green-400/30 rounded-full px-3 py-1 text-xs font-semibold"><StarIcon /><span>MÊS GRÁTIS</span>{timeRemaining && <span className="ml-1 opacity-80">({timeRemaining})</span>}</div>;
    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-gray-800 text-gray-400 border border-gray-700 rounded-full px-3 py-1 text-xs font-semibold"><ShieldIcon /><span>FREE</span></div>
            {!userProfile?.trialExpiresAt && (<button onClick={activateFreeTrial} className="bg-purple-600 text-white font-semibold py-1 px-3 rounded-full shadow-md hover:bg-purple-700 transition text-xs">Ativar Mês Grátis</button>)}
            <button onClick={handleUpgrade} disabled={isLoading} className="bg-purple-600 text-white font-semibold py-1 px-3 rounded-full shadow-md hover:bg-purple-700 transition disabled:opacity-50 text-xs">{isLoading ? 'Aguarde...' : 'Tornar-se PRO'}</button>
        </div>
    );
}


// --- Componente Principal do Layout do Painel ---
export default function DashboardLayout() {
    const { toastMessage, clearToast, currentUser } = useAppContext();
    const [activePage, setActivePage] = useState('resumo');
    
    // CORREÇÃO: Estados de filtro movidos para cá para serem passados como props
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    });
    const [selectedCardFilter, setSelectedCardFilter] = useState('');
    const [selectedClientFilter, setSelectedClientFilter] = useState('');


    const handleLogout = () => signOut(auth);

    const renderActivePage = () => {
        // CORREÇÃO: Passando as props necessárias para os componentes filhos
        const pageProps = {
            selectedMonth,
            setSelectedMonth,
            selectedCardFilter,
            setSelectedCardFilter,
            selectedClientFilter,
            setSelectedClientFilter,
        };

        switch (activePage) {
            case 'resumo': return <Dashboard {...pageProps} />;
            case 'pessoas': return <ClientManagement />;
            case 'cards': return <CardManagement />;
            case 'transactions': return <UnifiedTransactionManagement />;
            case 'subscriptions': return <SubscriptionManagement {...{ selectedMonth, setSelectedMonth }} />;
            default: return <Dashboard {...pageProps} />;
        }
    };

    return (
        <div className="min-h-screen bg-[#1e1e1e] font-sans text-gray-300 flex">
            {/* Sidebar (Menu Lateral) */}
            <aside className="w-64 bg-black/20 p-4 flex flex-col border-r border-gray-800">
                <div className="flex items-center gap-2 mb-8">
                    <FinControlLogo className="text-purple-500" />
                    <h1 className="text-xl font-roboto font-bold tracking-wider text-white">FinControl</h1>
                </div>

                <nav className="flex flex-col gap-2">
                    <button onClick={() => setActivePage('resumo')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${activePage === 'resumo' ? 'bg-purple-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}><HomeIcon /> Resumo</button>
                    <button onClick={() => setActivePage('pessoas')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${activePage === 'pessoas' ? 'bg-purple-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}><UsersIconNav /> Pessoas</button>
                    <button onClick={() => setActivePage('cards')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${activePage === 'cards' ? 'bg-purple-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}><CreditCardIconNav /> Cartões</button>
                    <button onClick={() => setActivePage('transactions')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${activePage === 'transactions' ? 'bg-purple-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}><ListIcon /> Movimentações</button>
                    <button onClick={() => setActivePage('subscriptions')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${activePage === 'subscriptions' ? 'bg-purple-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}><RepeatIcon /> Assinaturas</button>
                </nav>

                <div className="mt-auto">
                    <div className="border-t border-gray-800 pt-4">
                         <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-bold text-white">
                                {currentUser?.email?.[0].toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-400 truncate">{currentUser?.email}</span>
                        </div>
                        <button onClick={handleLogout} className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition text-red-400 hover:bg-red-800/50">
                            <LogoutIcon /> Sair
                        </button>
                    </div>
                </div>
            </aside>

            {/* Conteúdo Principal */}
            <div className="flex-1 flex flex-col">
                <header className="bg-[#1e1e1e]/80 backdrop-blur-sm border-b border-gray-800 p-4">
                    <div className="flex justify-end items-center">
                        <UserStatusBadge />
                    </div>
                </header>
                <main className="flex-1 p-6 overflow-y-auto">
                    {renderActivePage()}
                </main>
            </div>

            <Toast message={toastMessage} onClose={clearToast} />
        </div>
    );
}
