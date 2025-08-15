// src/features/income/IncomeManagement.jsx

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useAppContext } from '../../context/AppContext';
import { formatCurrencyDisplay, parseCurrencyInput, handleCurrencyInputChange } from '../../utils/currency';
import GenericModal from '../../components/GenericModal';
import UpgradePrompt from '../../components/UpgradePrompt'; // Importar o componente de upgrade

function IncomeManagement() {
    // ✅ 1. OBTER O STATUS 'isPro' DO CONTEXTO
    const { db, userId, isAuthReady, getUserCollectionPathSegments, theme, showToast, isPro } = useAppContext();
    const [incomes, setIncomes] = useState([]);
    const [description, setDescription] = useState('');
    const [valueInput, setValueInput] = useState('');
    const [date, setDate] = useState('');
    const [editingIncome, setEditingIncome] = useState(null);

    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [incomeToDelete, setIncomeToDelete] = useState(null);

    // Efeito para carregar as receitas (sem alteração)
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();
        const incomesColRef = collection(db, ...userCollectionPath, userId, 'incomes');
        const q = query(incomesColRef, orderBy("date", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setIncomes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar receitas:", error));
        return () => unsubscribe();
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    const resetForm = () => {
        setDescription('');
        setValueInput('');
        setDate('');
        setEditingIncome(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Bloqueia a submissão se não for Pro
        if (!isPro) {
            showToast('Este é um recurso exclusivo para assinantes Pro.', 'warning');
            return;
        }
        if (!description.trim() || !valueInput || !date) {
            showToast('Por favor, preencha todos os campos.', 'warning');
            return;
        }
        const value = parseCurrencyInput(valueInput);
        const userCollectionPath = getUserCollectionPathSegments();
        const incomeData = {
            description,
            value,
            date,
        };

        try {
            if (editingIncome) {
                await updateDoc(doc(db, ...userCollectionPath, userId, 'incomes', editingIncome.id), incomeData);
                showToast("Receita atualizada com sucesso!", "success");
            } else {
                await addDoc(collection(db, ...userCollectionPath, userId, 'incomes'), { ...incomeData, createdAt: new Date() });
                showToast("Receita adicionada com sucesso!", "success");
            }
            resetForm();
        } catch (error) {
            console.error("Erro ao salvar receita:", error);
            showToast(`Erro ao salvar receita: ${error.message}`, "error");
        }
    };

    const confirmDelete = (incomeId) => {
        setIncomeToDelete(incomeId);
        setIsConfirmationModalOpen(true);
    };

    const handleDeleteConfirmed = async () => {
        if (!incomeToDelete) return;
        const userCollectionPath = getUserCollectionPathSegments();
        try {
            await deleteDoc(doc(db, ...userCollectionPath, userId, 'incomes', incomeToDelete));
            showToast("Receita deletada com sucesso!", "success");
        } catch (error) {
            console.error("Erro ao deletar receita:", error);
            showToast(`Erro ao deletar receita: ${error.message}`, "error");
        } finally {
            setIsConfirmationModalOpen(false);
            setIncomeToDelete(null);
        }
    };

    const handleEdit = (income) => {
        setEditingIncome(income);
        setDescription(income.description);
        setValueInput(formatCurrencyDisplay(income.value).replace('R$ ', ''));
        setDate(income.date);
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md dark:shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Gerenciar Receitas</h2>
            {/* ✅ 2. ADICIONAR a propriedade 'disabled' aos campos se o usuário não for Pro */}
            <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <input
                    type="text"
                    placeholder="Descrição (Ex: Salário)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                    required
                    disabled={!isPro}
                />
                <input
                    type="text"
                    placeholder="Valor (R$)"
                    value={valueInput}
                    onChange={handleCurrencyInputChange(setValueInput)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                    required
                    disabled={!isPro}
                />
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                    required
                    disabled={!isPro}
                />
                <div className="col-span-full md:col-span-1 flex justify-end gap-4">
                    <button type="submit" className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={!isPro}>
                        {editingIncome ? 'Atualizar' : 'Adicionar'}
                    </button>
                    {editingIncome && (
                        <button type="button" onClick={resetForm} className="w-full bg-gray-400 text-white py-3 px-6 rounded-lg hover:bg-gray-500">
                            Cancelar
                        </button>
                    )}
                </div>
            </form>

            {/* ✅ 3. RENDERIZAÇÃO CONDICIONAL DA TABELA OU DO AVISO DE UPGRADE */}
            {isPro ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Data</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Descrição</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Valor</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {incomes.map((income) => (
                                <tr key={income.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="py-3 px-4 whitespace-nowrap">{new Date(income.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{income.description}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{formatCurrencyDisplay(income.value)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap flex items-center gap-2">
                                        <button onClick={() => handleEdit(income)} className="text-blue-600 hover:text-blue-900">Editar</button>
                                        <button onClick={() => confirmDelete(income.id)} className="text-red-600 hover:text-red-900">Deletar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="mt-8">
                    <UpgradePrompt />
                </div>
            )}

            <GenericModal
                isOpen={isConfirmationModalOpen}
                onClose={() => setIsConfirmationModalOpen(false)}
                onConfirm={handleDeleteConfirmed}
                title="Confirmar Exclusão"
                message={`Tem certeza que deseja deletar a receita "${incomes.find(i => i.id === incomeToDelete)?.description}"?`}
                isConfirmation={true}
                theme={theme}
            />
        </div>
    );
}

export default IncomeManagement;