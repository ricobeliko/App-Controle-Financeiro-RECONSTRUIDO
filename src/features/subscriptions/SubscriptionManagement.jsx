// src/features/subscriptions/SubscriptionManagement.jsx

import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, FieldValue } from 'firebase/firestore';

// IMPORTANDO O NECESSÁRIO
import { AppContext, useAppContext } from '../../context/AppContext';
import { formatCurrencyDisplay, parseCurrencyInput, handleCurrencyInputChange } from '../../utils/currency';
import GenericModal from '../../components/GenericModal';


// COMPONENTE PARA GERENCIAR ASSINATURAS - ATUALIZADO
function SubscriptionManagement({ selectedMonth, setSelectedMonth }) {
    const { db, userId, isAuthReady, getUserCollectionPathSegments, theme, showToast } = useContext(AppContext);
    const [subscriptions, setSubscriptions] = useState([]);
    const [cards, setCards] = useState([]);
    const [clients, setClients] = useState([]);

    const [subscriptionName, setSubscriptionName] = useState('');
    const [subscriptionValueInput, setSubscriptionValueInput] = useState('');
    const [selectedCardId, setSelectedCardId] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [subscriptionStatus, setSubscriptionStatus] = useState('Ativa');
    const [startDate, setStartDate] = useState('');
    const [editingSubscription, setEditingSubscription] = useState(null);

    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [subToDelete, setSubToDelete] = useState(null);

    // Efeito para carregar cartões (para o dropdown de seleção)
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();
        const cardsColRef = collection(db, ...userCollectionPath, userId, 'cards');
        const unsubscribeCards = onSnapshot(cardsColRef, (snapshot) => {
            setCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar cartões para assinaturas:", error));

        return () => unsubscribeCards();
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    // Efeito para carregar pessoas (clientes, para o dropdown de seleção)
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();
        const clientsColRef = collection(db, ...userCollectionPath, userId, 'clients');
        const unsubscribeClients = onSnapshot(clientsColRef, (snapshot) => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar pessoas para assinaturas:", error));

        return () => unsubscribeClients();
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);


    // Efeito para carregar assinaturas
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();
        const subsColRef = collection(db, ...userCollectionPath, userId, 'subscriptions');
        const unsubscribe = onSnapshot(subsColRef, (snapshot) => {
            const subsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSubscriptions(subsData);
        }, (error) => console.error("Erro ao carregar assinaturas:", error));

        return () => unsubscribe();
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    /**
     * Manipulador de envio do formulário para adicionar ou atualizar uma assinatura.
     * @param {Event} e - O evento de envio do formulário.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        // Agora selectedClientId é obrigatório
        if (!subscriptionName.trim() || !subscriptionValueInput || !selectedCardId || !selectedClientId || !startDate) {
            showToast("Por favor, preencha todos os campos obrigatórios: Nome, Valor, Cartão, Pessoa e Início.", "warning");
            return;
        }

        const subscriptionValue = parseCurrencyInput(subscriptionValueInput);
        const userCollectionPath = getUserCollectionPathSegments();
        const subscriptionData = {
            name: subscriptionName,
            value: subscriptionValue,
            cardId: selectedCardId,
            clientId: selectedClientId, // Agora obrigatório
            status: subscriptionStatus,
            startDate: startDate,
        };

        try {
            if (editingSubscription) {
                // Atualiza um documento existente
                await updateDoc(doc(db, ...userCollectionPath, userId, 'subscriptions', editingSubscription.id), subscriptionData);
                showToast("Assinatura atualizada com sucesso!", "success");
            } else {
                // Adiciona um novo documento
                await addDoc(collection(db, ...userCollectionPath, userId, 'subscriptions'), {
                    ...subscriptionData,
                    paymentHistory: {},
                    createdAt: new Date(),
                });
                showToast("Assinatura adicionada com sucesso!", "success");
            }
            // Limpa os campos do formulário
            setSubscriptionName('');
            setSubscriptionValueInput('');
            setSelectedCardId('');
            setSelectedClientId('');
            setSubscriptionStatus('Ativa');
            setStartDate('');
            setEditingSubscription(null);
        } catch (error) {
            console.error("Erro ao salvar assinatura:", error);
            showToast(`Erro ao salvar assinatura: ${error.message}`, "error");
        }
    };

    /**
     * Prepara e exibe o modal de confirmação para exclusão de uma assinatura.
     * @param {string} id - O ID da assinatura a ser deletada.
     */
    const confirmDeleteSubscription = (id) => {
        setSubToDelete(id);
        setIsConfirmationModalOpen(true);
    };

    /**
     * Executa a exclusão de uma assinatura após a confirmação.
     */
    const handleDeleteSubscriptionConfirmed = async () => {
        if (!subToDelete) return;
        const userCollectionPath = getUserCollectionPathSegments();
        try {
            await deleteDoc(doc(db, ...userCollectionPath, userId, 'subscriptions', subToDelete));
            showToast("Assinatura deletada com sucesso!", "success");
            setSubToDelete(null);
        } catch (error) {
            console.error("Erro ao deletar assinatura:", error);
            showToast(`Erro ao deletar assinatura: ${error.message}`, "error");
        } finally {
            setIsConfirmationModalOpen(false);
        }
    };

    /**
     * Define a assinatura a ser editada e preenche o formulário.
     * @param {object} sub - O objeto assinatura a ser editado.
     */
    const handleEditSubscription = (sub) => {
        setEditingSubscription(sub);
        setSubscriptionName(sub.name);
        setSubscriptionValueInput(formatCurrencyDisplay(sub.value).replace('R$ ', ''));
        setSelectedCardId(sub.cardId);
        setSelectedClientId(sub.clientId || ''); // Garante que o clientId é preenchido
        setSubscriptionStatus(sub.status);
        setStartDate(sub.startDate);
    };

    /**
     * Retorna o nome e a cor de um cartão com base no seu ID.
     * @param {string} cardId - O ID do cartão.
     * @returns {{name: string, color: string}} Um objeto com o nome e a cor do cartão.
     */
    const getCardName = (cardId) => {
        const card = cards.find(c => c.id === cardId);
        return card ? { name: card.name, color: card.color } : { name: 'N/A', color: '#cccccc' };
    };

    /**
     * Retorna o nome de um cliente com base no seu ID.
     * @param {string} clientId - O ID do cliente.
     * @returns {string} O nome do cliente ou 'N/A' se não encontrado.
     */
    const getClientName = (clientId) => clients.find(c => c.id === clientId)?.name || 'N/A';

    const handleUpdateSubscriptionPayment = async (subscriptionId, month, currentStatus) => {
        // Importe FieldValue do firebase/firestore no topo do seu arquivo se ainda não o fez
        const { FieldValue } = await import('firebase/firestore');
    
        const subDocRef = doc(db, ...getUserCollectionPathSegments(), userId, 'subscriptions', subscriptionId);
        // Se o status atual é 'Paga', nós vamos deletar o campo, senão, vamos setar para 'Paga'.
        const newStatus = currentStatus === 'Paga' ? FieldValue.delete() : 'Paga';
        const fieldPath = `paymentHistory.${month}`;
    
        try {
            await updateDoc(subDocRef, { [fieldPath]: newStatus });
            const message = newStatus === 'Paga' ? "Assinatura marcada como paga!" : "Pagamento desmarcado.";
            showToast(message, newStatus === 'Paga' ? "success" : "info");
        } catch (error) {
            console.error("Erro ao atualizar pagamento da assinatura:", error);
            showToast(`Erro ao atualizar pagamento: ${error.message}`, "error");
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md dark:shadow-lg">
           <div className="flex flex-col md:flex-row justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Gerenciar Assinaturas</h2>
                    <div className="mt-4 md:mt-0">
                    <label htmlFor="sub-month-filter" className="text-sm font-medium mr-2">Mês de Referência:</label>
                    <input
                    type="month"
                    id="sub-month-filter"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                </div>
            </div>
            <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 items-end">
                <input
                    type="text"
                    placeholder="Nome da Assinatura (Ex: Netflix)"
                    value={subscriptionName}
                    onChange={(e) => setSubscriptionName(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                />
                <input
                    type="text"
                    placeholder="Valor Mensal (Ex: 39,90)"
                    value={subscriptionValueInput}
                    onChange={handleCurrencyInputChange(setSubscriptionValueInput)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                />
                <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                >
                    <option value="">Selecione a Pessoa *</option>
                    {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                </select>
                <select
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                >
                    <option value="">Selecione o Cartão *</option>
                    {cards.map(card => (
                        <option key={card.id} value={card.id} style={{ backgroundColor: card.color, color: theme === 'dark' ? (['#000000', '#5E60CE'].includes(card.color) ? 'white' : 'black') : (['#FFFFFF', '#FFFFFF'].includes(card.color) ? 'black' : 'inherit') }}>
                            {card.name}
                        </option>
                    ))}
                </select>
                <input
                    type="date"
                    placeholder="Data de Início da Assinatura"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                />
                <select
                    value={subscriptionStatus}
                    onChange={(e) => setSubscriptionStatus(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                    <option value="Ativa">Ativa</option>
                    <option value="Cancelada">Cancelada</option>
                    <option value="Pausada">Pausada</option>
                </select>
                <div className="col-span-full flex justify-end gap-4 mt-2">
                    <button
                        type="submit"
                        className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md dark:bg-blue-700 dark:hover:bg-blue-800"
                    >
                        {editingSubscription ? 'Atualizar Assinatura' : 'Adicionar Assinatura'}
                    </button>
                    {editingSubscription && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingSubscription(null);
                                setSubscriptionName('');
                                setSubscriptionValueInput('');
                                setSelectedCardId('');
                                setSelectedClientId('');
                                setSubscriptionStatus('Ativa');
                                setStartDate('');
                            }}
                            className="bg-gray-400 text-white py-3 px-6 rounded-lg hover:bg-gray-500 transition duration-300 shadow-md dark:bg-gray-600 dark:hover:bg-gray-700"
                        >
                            Cancelar Edição
                        </button>
                    )}
                </div>
            </form>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="py-3 px-4 text-left ...">Status (Mês)</th>
                            <th className="py-3 px-4 text-left ...">Nome</th>
                            <th className="py-3 px-4 text-left ...">Valor</th>
                            <th className="py-3 px-4 text-left ...">Pessoa</th>
                            <th className="py-3 px-4 text-left ...">Status Geral</th>
                            <th className="py-3 px-4 text-left ... rounded-tr-lg">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {subscriptions.map((sub) => {
                            const paymentStatusForMonth = sub.paymentHistory?.[selectedMonth] || 'Pendente';
                            const isSubscriptionActiveForMonth = new Date(sub.startDate) <= new Date(selectedMonth + '-28');

                            return (
                                <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="py-3 px-4 whitespace-nowrap">
                                        {sub.status === 'Ativa' && isSubscriptionActiveForMonth && (
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                paymentStatusForMonth === 'Paga' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                            }`}>
                                                {paymentStatusForMonth}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 ...">{sub.name}</td>
                                    <td className="py-3 px-4 ...">{formatCurrencyDisplay(sub.value)}</td>
                                    <td className="py-3 px-4 ...">{getClientName(sub.clientId)}</td>
                                    <td className="py-3 px-4 ...">{sub.status}</td>
                                    <td className="py-3 px-4 ... flex items-center gap-2 flex-wrap">
                                        {sub.status === 'Ativa' && isSubscriptionActiveForMonth && (
                                            <button
                                                onClick={() => handleUpdateSubscriptionPayment(sub.id, selectedMonth, paymentStatusForMonth)}
                                                className={`text-sm py-1 px-2 rounded-md transition-colors ${
                                                    paymentStatusForMonth === 'Paga' ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500' : 'bg-green-500 text-white hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800'
                                                }`}
                                            >
                                                {paymentStatusForMonth === 'Paga' ? 'Desmarcar' : 'Pagar Mês'}
                                            </button>
                                        )}
                                        <button onClick={() => handleEditSubscription(sub)} className="...">Editar</button>
                                        <button onClick={() => confirmDeleteSubscription(sub.id)} className="...">Deletar</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <GenericModal
                isOpen={isConfirmationModalOpen}
                onClose={() => setIsConfirmationModalOpen(false)}
                onConfirm={handleDeleteSubscriptionConfirmed}
                title="Confirmar Exclusão"
                message={subToDelete ? `Tem certeza que deseja deletar a assinatura "${subscriptions.find(s => s.id === subToDelete)?.name}"?` : ''}
                isConfirmation={true}
                theme={theme}
            />
        </div>
    );
}
export default SubscriptionManagement;