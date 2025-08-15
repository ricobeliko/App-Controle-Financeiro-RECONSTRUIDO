// src/features/dashboard/ProSummary.jsx

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAppContext } from '../../context/AppContext';
import { formatCurrencyDisplay } from '../../utils/currency';
import UpgradePrompt from '../../components/UpgradePrompt'; // Importar o componente de upgrade

function ProSummary({ selectedMonth, totalExpenses }) {
    // ✅ 1. OBTER O STATUS 'isPro' DO CONTEXTO
    const { db, userId, isAuthReady, getUserCollectionPathSegments, isPro } = useAppContext();
    const [monthlyIncome, setMonthlyIncome] = useState(0);

    useEffect(() => {
        // A busca de dados só acontece se for Pro, para economizar leituras do banco
        if (!isAuthReady || !db || !userId || !selectedMonth || !isPro) {
            // Se não for pro, definimos um valor de exemplo para o fundo desfocado
            if (!isPro) {
                setMonthlyIncome(1234.56);
            }
            return;
        };

        const [year, month] = selectedMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).getDate();
        const endDateStr = `${year}-${month}-${String(endDate).padStart(2, '0')}`;

        const userCollectionPath = getUserCollectionPathSegments();
        const incomesColRef = collection(db, ...userCollectionPath, userId, 'incomes');
        
        const q = query(incomesColRef, 
            where("date", ">=", startDate), 
            where("date", "<=", endDateStr)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const total = snapshot.docs.reduce((acc, doc) => acc + doc.data().value, 0);
            setMonthlyIncome(total);
        }, (error) => {
            console.error("Erro ao carregar receitas para o resumo:", error);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady, selectedMonth, getUserCollectionPathSegments, isPro]);

    const finalBalance = monthlyIncome - totalExpenses;
    const balanceColorClass = finalBalance >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400';

    return (
        // O container principal agora é 'relative' para posicionar o aviso de upgrade
        <div className="relative">
            {/* ✅ 2. CONTAINER PARA A PRÉVIA DISTORCIDA */}
            <div className={!isPro ? 'blur-sm pointer-events-none' : ''}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 p-4 border-2 border-dashed border-yellow-500 dark:border-yellow-400/50 rounded-lg bg-yellow-50 dark:bg-gray-800 shadow-inner">
                    <div className="bg-green-100 dark:bg-green-900/50 p-4 rounded-lg">
                        <h3 className="text-lg font-medium text-green-800 dark:text-green-200">Total Receitas (Mês)</h3>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrencyDisplay(monthlyIncome)}</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg">
                        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Balanço Final (Receitas - Fatura)</h3>
                        <p className={`text-2xl font-bold ${balanceColorClass}`}>{formatCurrencyDisplay(finalBalance)}</p>
                    </div>
                </div>
            </div>
            
            {/* ✅ 3. EXIBIR O UPGRADEPROMPT SE NÃO FOR PRO */}
            {!isPro && (
                <div className="absolute inset-0 flex items-center justify-center -mt-8">
                     {/* O UpgradePrompt é menor aqui para se ajustar ao card */}
                    <div className="scale-75">
                         <UpgradePrompt />
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProSummary;