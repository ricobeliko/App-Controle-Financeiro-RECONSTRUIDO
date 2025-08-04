// src/features/cards/CardManagement.jsx

import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';

// IMPORTAÇÕES NECESSÁRIAS
import { AppContext } from '../../context/AppContext';
import { formatCurrencyDisplay, parseCurrencyInput, handleCurrencyInputChange } from '../../utils/currency';
import GenericModal from '../../components/GenericModal';

function CardManagement() {
    const { db, userId, isAuthReady, getUserCollectionPathSegments, theme, showToast } = useContext(AppContext);
    const [cards, setCards] = useState([]);
    const [cardName, setCardName] = useState('');
    const [cardLimitInput, setCardLimitInput] = useState('');
    const [closingDay, setClosingDay] = useState('');
    const [dueDay, setDueDay] = useState('');
    const [cardColor, setCardColor] = useState('#5E60CE');
    const [editingCard, setEditingCard] = useState(null);
    const [allLoans, setAllLoans] = useState([]);
    const [allSubscriptions, setAllSubscriptions] = useState([]);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [cardToDelete, setCardToDelete] = useState(null);

    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();
        const cardsColRef = collection(db, ...userCollectionPath, userId, 'cards');
        const unsubscribe = onSnapshot(cardsColRef, (snapshot) => {
            setCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar cartões:", error));
        return () => unsubscribe();
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();
        const loansColRef = collection(db, ...userCollectionPath, userId, 'loans');
        const unsubscribeLoans = onSnapshot(loansColRef, (snapshot) => {
            setAllLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar compras para fatura:", error));

        const subsColRef = collection(db, ...userCollectionPath, userId, 'subscriptions');
        const unsubscribeSubs = onSnapshot(subsColRef, (snapshot) => {
            setAllSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar assinaturas para fatura:", error));

        return () => {
            unsubscribeLoans();
            unsubscribeSubs();
        };
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!cardName.trim() || !cardLimitInput || !closingDay || !dueDay) {
            showToast('Por favor, preencha todos os campos do cartão.', 'warning');
            return;
        }
        const cardLimit = parseCurrencyInput(cardLimitInput);
        const userCollectionPath = getUserCollectionPathSegments();
        const cardData = { name: cardName, limit: cardLimit, closingDay: parseInt(closingDay), dueDay: parseInt(dueDay), color: cardColor };
        try {
            if (editingCard) {
                await updateDoc(doc(db, ...userCollectionPath, userId, 'cards', editingCard.id), cardData);
                showToast("Cartão atualizado com sucesso!", "success");
            } else {
                await addDoc(collection(db, ...userCollectionPath, userId, 'cards'), { ...cardData, createdAt: new Date() });
                showToast("Cartão adicionado com sucesso!", "success");
            }
            setCardName('');
            setCardLimitInput('');
            setClosingDay('');
            setDueDay('');
            setCardColor('#5E60CE');
            setEditingCard(null);
        } catch (error) {
            console.error("Erro ao salvar cartão:", error);
            showToast(`Erro ao salvar cartão: ${error.message}`, "error");
        }
    };

    const confirmDeleteCard = (cardId) => {
        setCardToDelete(cardId);
        setIsConfirmationModalOpen(true);
    };

    const handleDeleteCardConfirmed = async () => {
        if (!cardToDelete) return;
        const userCollectionPath = getUserCollectionPathSegments();
        try {
            await deleteDoc(doc(db, ...userCollectionPath, userId, 'cards', cardToDelete));
            showToast("Cartão deletado com sucesso!", "success");
        } catch (error) {
            console.error("Erro ao deletar cartão:", error);
            showToast(`Erro ao deletar cartão: ${error.message}`, "error");
        } finally {
            setIsConfirmationModalOpen(false);
            setCardToDelete(null);
        }
    };

    const handleEdit = (card) => {
        setEditingCard(card);
        setCardName(card.name);
        setCardLimitInput(formatCurrencyDisplay(card.limit).replace('R$ ', ''));
        setClosingDay(card.closingDay.toString());
        setDueDay(card.dueDay.toString());
        setCardColor(card.color || '#5E60CE');
    };
    
    const calculateCurrentMonthInvoiceForCard = (cardId) => {
        // Esta função precisa ser implementada ou ajustada conforme a sua lógica de negócio
        return 0;
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md dark:shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Gerenciar Cartões de Crédito</h2>
            <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
                <input type="text" placeholder="Nome do Cartão" value={cardName} onChange={(e) => setCardName(e.target.value)} className="p-3 border border-gray-300 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                <input type="text" placeholder="Limite Total" value={cardLimitInput} onChange={handleCurrencyInputChange(setCardLimitInput)} className="p-3 border border-gray-300 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                <input type="number" placeholder="Dia Fechamento" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className="p-3 border border-gray-300 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" min="1" max="31" required />
                <input type="number" placeholder="Dia Vencimento" value={dueDay} onChange={(e) => setDueDay(e.target.value)} className="p-3 border border-gray-300 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white" min="1" max="31" required />
                <input type="color" value={cardColor} onChange={(e) => setCardColor(e.target.value)} className="p-1 h-12 w-full border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-white dark:bg-gray-700" />
                <div className="col-span-full flex justify-end gap-4 mt-4">
                    <button type="submit" className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700">{editingCard ? 'Atualizar Cartão' : 'Adicionar Cartão'}</button>
                    {editingCard && (<button type="button" onClick={() => { setEditingCard(null); setCardName(''); setCardLimitInput(''); setClosingDay(''); setDueDay(''); setCardColor('#5E60CE'); }} className="bg-gray-400 text-white py-3 px-6 rounded-lg hover:bg-gray-500">Cancelar</button>)}
                </div>
            </form>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Nome</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Limite</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Fatura (Mês)</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Fechamento</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Vencimento</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {cards.map((card) => (
                            <tr key={card.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="py-3 px-4 whitespace-nowrap flex items-center"><span className="w-4 h-4 rounded-sm mr-2" style={{ backgroundColor: card.color }}></span>{card.name}</td>
                                <td className="py-3 px-4 whitespace-nowrap">{formatCurrencyDisplay(card.limit)}</td>
                                <td className="py-3 px-4 whitespace-nowrap">{formatCurrencyDisplay(calculateCurrentMonthInvoiceForCard(card.id))}</td>
                                <td className="py-3 px-4 whitespace-nowrap">Dia {card.closingDay}</td>
                                <td className="py-3 px-4 whitespace-nowrap">Dia {card.dueDay}</td>
                                <td className="py-3 px-4 whitespace-nowrap flex items-center gap-2">
                                    <button onClick={() => handleEdit(card)} className="text-blue-600 hover:text-blue-900">Editar</button>
                                    <button onClick={() => confirmDeleteCard(card.id)} className="text-red-600 hover:text-red-900">Deletar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <GenericModal isOpen={isConfirmationModalOpen} onClose={() => setIsConfirmationModalOpen(false)} onConfirm={handleDeleteCardConfirmed} title="Confirmar Exclusão" message={`Tem certeza que deseja deletar o cartão "${cards.find(c => c.id === cardToDelete)?.name}"?`} isConfirmation={true} theme={theme} />
        </div>
    );
}

export default CardManagement;
