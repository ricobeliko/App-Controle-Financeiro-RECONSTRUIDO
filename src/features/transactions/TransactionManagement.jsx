// src/features/transactions/TransactionManagement.jsx

import React, { useState, useEffect, useMemo, useContext } from 'react';
import LoanManagement from '../loans/LoanManagement';
import IncomeManagement from '../income/IncomeManagement';
// ✅ 1. IMPORTAR O NOVO COMPONENTE DE DESPESAS
import ExpenseManagement from '../expenses/ExpenseManagement';

// Para evitar recriar os componentes de formulário, vamos envolvê-los
const MemoizedLoanForm = React.memo(LoanManagement);
const MemoizedIncomeForm = React.memo(IncomeManagement);
const MemoizedExpenseForm = React.memo(ExpenseManagement);


// Componente principal que unifica os formulários
function UnifiedTransactionManagement() {
    const [transactionType, setTransactionType] = useState('purchase');

    return (
        <div className="space-y-6">
            {/* ✅ 2. ATUALIZAR O SELETOR PARA INCLUIR "DESPESA" */}
            <div className="flex justify-center p-1 bg-gray-200 dark:bg-gray-700 rounded-lg max-w-md mx-auto">
                <button 
                    onClick={() => setTransactionType('purchase')}
                    className={`w-1/3 px-4 py-2 text-sm font-bold rounded-md transition-colors ${transactionType === 'purchase' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow' : 'text-gray-600 dark:text-gray-300'}`}
                >
                    Compra
                </button>
                <button 
                    onClick={() => setTransactionType('income')}
                    className={`w-1/3 px-4 py-2 text-sm font-bold rounded-md transition-colors ${transactionType === 'income' ? 'bg-white dark:bg-gray-800 text-green-600 shadow' : 'text-gray-600 dark:text-gray-300'}`}
                >
                    Receita
                </button>
                <button 
                    onClick={() => setTransactionType('expense')}
                    className={`w-1/3 px-4 py-2 text-sm font-bold rounded-md transition-colors ${transactionType === 'expense' ? 'bg-white dark:bg-gray-800 text-red-600 shadow' : 'text-gray-600 dark:text-gray-300'}`}
                >
                    Despesa
                </button>
            </div>
            
            {/* ✅ 3. RENDERIZAR O FORMULÁRIO DE DESPESAS CONDICIONALMENTE */}
            <div style={{ display: transactionType === 'purchase' ? 'block' : 'none' }}>
                <MemoizedLoanForm />
            </div>
            <div style={{ display: transactionType === 'income' ? 'block' : 'none' }}>
                <MemoizedIncomeForm />
            </div>
            <div style={{ display: transactionType === 'expense' ? 'block' : 'none' }}>
                <MemoizedExpenseForm />
            </div>
        </div>
    )
}

export default UnifiedTransactionManagement;