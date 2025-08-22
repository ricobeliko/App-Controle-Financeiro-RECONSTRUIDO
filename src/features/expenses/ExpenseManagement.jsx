// src/features/expenses/ExpenseManagement.jsx

import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useAppContext } from '../../context/AppContext';
import { formatCurrencyDisplay, parseCurrencyInput, handleCurrencyInputChange } from '../../utils/currency';
import GenericModal from '../../components/GenericModal';
import UpgradePrompt from '../../components/UpgradePrompt';

const expenseCategories = [
    "Moradia", "Transporte", "Alimentação", "Saúde", "Educação", 
    "Lazer", "Vestuário", "Cuidados Pessoais", "Dívidas", "Investimentos", "Outros"
];

function ExpenseManagement() {
    const { db, userId, isAuthReady, getUserCollectionPathSegments, theme, showToast, isPro } = useAppContext();
    const [expenses, setExpenses] = useState([]);
    const [cards, setCards] = useState([]);
    const [clients, setClients] = useState([]);
    
    const [description, setDescription] = useState('');
    const [valueInput, setValueInput] = useState('');
    const [date, setDate] = useState('');
    const [category, setCategory] = useState('');
    const [selectedCardId, setSelectedCardId] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [editingExpense, setEditingExpense] = useState(null);

    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState(null);
    
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();

        const unsubCards = onSnapshot(collection(db, ...userCollectionPath, userId, 'cards'), (snapshot) => {
            setCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubClients = onSnapshot(collection(db, ...userCollectionPath, userId, 'clients'), (snapshot) => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        
        const expensesColRef = collection(db, ...userCollectionPath, userId, 'expenses');
        const q = query(expensesColRef, orderBy("date", "desc"));
        const unsubExpenses = onSnapshot(q, (snapshot) => {
            setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubCards(); unsubClients(); unsubExpenses(); };
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    const resetForm = () => {
        setDescription('');
        setValueInput('');
        setDate('');
        setCategory('');
        setSelectedCardId('');
        setSelectedClientId('');
        setEditingExpense(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isPro) {
            showToast('Este é um recurso exclusivo para assinantes Pro.', 'warning');
            return;
        }
        if (!description.trim() || !valueInput || !date || !category || !selectedClientId) {
            showToast('Por favor, preencha todos os campos obrigatórios.', 'warning');
            return;
        }
        const value = parseCurrencyInput(valueInput);
        const userCollectionPath = getUserCollectionPathSegments();
        
        const expenseData = { 
            description, 
            value, 
            date, 
            category,
            clientId: selectedClientId,
            cardId: selectedCardId || null,
            // ✅ 1. ADICIONANDO O CAMPO 'status' AO CRIAR/ATUALIZAR UMA DESPESA
            status: editingExpense ? editingExpense.status : 'Pendente' // Mantém o status ao editar, ou define como pendente ao criar
        };

        try {
            if (editingExpense) {
                await updateDoc(doc(db, ...userCollectionPath, userId, 'expenses', editingExpense.id), expenseData);
                showToast("Despesa atualizada com sucesso!", "success");
            } else {
                await addDoc(collection(db, ...userCollectionPath, userId, 'expenses'), { ...expenseData, createdAt: new Date() });
                showToast("Despesa adicionada com sucesso!", "success");
            }
            resetForm();
        } catch (error) {
            console.error("Erro ao salvar despesa:", error);
            showToast(`Erro ao salvar despesa: ${error.message}`, "error");
        }
    };
    
    // ✅ 2. NOVA FUNÇÃO PARA ALTERAR O STATUS DA DESPESA
    const handleToggleExpenseStatus = async (expense) => {
        const newStatus = expense.status === 'Paga' ? 'Pendente' : 'Paga';
        const expenseDocRef = doc(db, ...getUserCollectionPathSegments(), userId, 'expenses', expense.id);
        try {
            await updateDoc(expenseDocRef, { status: newStatus });
            showToast(`Despesa marcada como ${newStatus.toLowerCase()}!`, 'success');
        } catch (error) {
            console.error("Erro ao atualizar status da despesa:", error);
            showToast("Erro ao atualizar o status.", "error");
        }
    };


    const confirmDelete = (expenseId) => {
        setExpenseToDelete(expenseId);
        setIsConfirmationModalOpen(true);
    };

    const handleDeleteConfirmed = async () => {
        if (!expenseToDelete) return;
        const userCollectionPath = getUserCollectionPathSegments();
        try {
            await deleteDoc(doc(db, ...userCollectionPath, userId, 'expenses', expenseToDelete));
            showToast("Despesa deletada com sucesso!", "success");
        } catch (error) {
            console.error("Erro ao deletar despesa:", error);
            showToast(`Erro ao deletar despesa: ${error.message}`, "error");
        } finally {
            setIsConfirmationModalOpen(false);
            setExpenseToDelete(null);
        }
    };

    const handleEdit = (expense) => {
        setEditingExpense(expense);
        setDescription(expense.description);
        setValueInput(formatCurrencyDisplay(expense.value).replace('R$ ', ''));
        setDate(expense.date);
        setCategory(expense.category);
        setSelectedCardId(expense.cardId || '');
        setSelectedClientId(expense.clientId);
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md dark:shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Gerenciar Despesas Avulsas</h2>
            
            <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <input type="text" placeholder="Descrição (Ex: Jantar)" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isPro} required className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50" />
                <input type="text" placeholder="Valor (R$)" value={valueInput} onChange={handleCurrencyInputChange(setValueInput)} disabled={!isPro} required className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50" />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!isPro} required className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50" />
                
                <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} disabled={!isPro} required className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50">
                    <option value="">Selecione uma Pessoa</option>
                    {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>

                <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={!isPro} required className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50">
                    <option value="">Selecione uma Categoria</option>
                    {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                
                <select value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)} disabled={!isPro} className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50">
                    <option value="">Pagar com... (Opcional)</option>
                    {cards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}
                </select>

                <div className="col-span-full flex justify-end gap-4">
                    <button type="submit" className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={!isPro}>
                        {editingExpense ? 'Atualizar' : 'Adicionar'}
                    </button>
                    {editingExpense && ( <button type="button" onClick={resetForm} className="w-full bg-gray-400 text-white py-3 px-6 rounded-lg hover:bg-gray-500">Cancelar</button> )}
                </div>
            </form>

            {isPro ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Data</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Descrição</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Pessoa</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Cartão</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Valor</th>
                                {/* ✅ 3. NOVA COLUNA PARA STATUS */}
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Status</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {expenses.map((expense) => {
                                const cardName = expense.cardId ? cards.find(c => c.id === expense.cardId)?.name : 'N/A';
                                const clientName = clients.find(c => c.id === expense.clientId)?.name || 'N/A';
                                const status = expense.status || 'Pendente'; // Garante um valor padrão
                                return (
                                    <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="py-3 px-4 whitespace-nowrap">{new Date(expense.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                        <td className="py-3 px-4 whitespace-nowrap">{expense.description}</td>
                                        <td className="py-3 px-4 whitespace-nowrap">{clientName}</td>
                                        <td className="py-3 px-4 whitespace-nowrap">{cardName}</td>
                                        <td className="py-3 px-4 whitespace-nowrap">{formatCurrencyDisplay(expense.value)}</td>
                                        <td className={`py-3 px-4 whitespace-nowrap font-semibold ${status === 'Paga' ? 'text-green-500' : 'text-yellow-500'}`}>{status}</td>
                                        <td className="py-3 px-4 whitespace-nowrap flex items-center gap-2">
                                            {/* ✅ 4. NOVO BOTÃO DE AÇÃO PARA PAGAR/DESMARCAR */}
                                            <button onClick={() => handleToggleExpenseStatus(expense)} className={`text-white px-3 py-1 rounded-md text-sm transition-colors ${status === 'Paga' ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
                                                {status === 'Paga' ? 'Desmarcar' : 'Pagar'}
                                            </button>
                                            <button onClick={() => handleEdit(expense)} className="text-blue-600 hover:text-blue-900">Editar</button>
                                            <button onClick={() => confirmDelete(expense.id)} className="text-red-600 hover:text-red-900">Deletar</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="mt-8"><UpgradePrompt /></div>
            )}
            <GenericModal isOpen={isConfirmationModalOpen} onClose={() => setIsConfirmationModalOpen(false)} onConfirm={handleDeleteConfirmed} title="Confirmar Exclusão" message={`Tem certeza que deseja deletar a despesa "${expenses.find(e => e.id === expenseToDelete)?.description}"?`} isConfirmation={true} theme={theme} />
        </div>
    );
}

export default ExpenseManagement;