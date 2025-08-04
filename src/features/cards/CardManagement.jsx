import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';

// IMPORTANDO O NECESSÁRIO
import ClientManagement from '../clients/ClientManagement';
import { AppContext, useAppContext } from '../../context/AppContext'; // O hook useAppContext facilita o uso
import { formatCurrencyDisplay } from '../../utils/currency';
import { copyTextToClipboardFallback } from '../../utils/helpers';
import GenericModal from '../../components/GenericModal';

// Componente para gerenciar cartões
function CardManagement() {
    const { db, userId, isAuthReady, getUserCollectionPathSegments, theme, showToast } = useContext(AppContext);
    const [cards, setCards] = useState([]);
    const [cardName, setCardName] = useState('');
    const [cardLimitInput, setCardLimitInput] = useState('');
    const [closingDay, setClosingDay] = useState('');
    const [dueDay, setDueDay] = useState('');
    const [cardColor, setCardColor] = useState('#5E60CE');
    const [editingCard, setEditingCard] = useState(null);

    // State para dados adicionais necessários para o cálculo da fatura
    const [allLoans, setAllLoans] = useState([]);
    const [allSubscriptions, setAllSubscriptions] = useState([]);

    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [cardToDelete, setCardToDelete] = useState(null);

    // Efeito para carregar cartões
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();
        const cardsColRef = collection(db, ...userCollectionPath, userId, 'cards');
        const unsubscribe = onSnapshot(cardsColRef, (snapshot) => {
            const cardsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCards(cardsData);
        }, (error) => {
            console.error("Erro ao carregar cartões:", error);
        });
        return () => unsubscribe();
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    // Efeito para carregar empréstimos (compras) e assinaturas para o cálculo da fatura
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();

        const loansColRef = collection(db, ...userCollectionPath, userId, 'loans');
        const unsubscribeLoans = onSnapshot(loansColRef, (snapshot) => {
            setAllLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar compras para fatura do cartão:", error));

        const subsColRef = collection(db, ...userCollectionPath, userId, 'subscriptions');
        const unsubscribeSubs = onSnapshot(subsColRef, (snapshot) => {
            setAllSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar assinaturas para fatura do cartão:", error));

        return () => {
            unsubscribeLoans();
            unsubscribeSubs();
        };
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    /**
     * Manipulador de envio do formulário para adicionar ou atualizar um cartão.
     * @param {Event} e - O evento de envio do formulário.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!cardName.trim() || !cardLimitInput || !closingDay || !dueDay) {
            showToast('Por favor, preencha todos os campos do cartão.', 'warning');
            return;
        }

        const cardLimit = parseCurrencyInput(cardLimitInput);
        const userCollectionPath = getUserCollectionPathSegments();
        const cardData = {
            name: cardName,
            limit: cardLimit,
            closingDay: parseInt(closingDay),
            dueDay: parseInt(dueDay),
            color: cardColor,
        };

        try {
            if (editingCard) {
                // Atualiza um documento existente
                await updateDoc(doc(db, ...userCollectionPath, userId, 'cards', editingCard.id), cardData);
                showToast("Cartão atualizado com sucesso!", "success");
            } else {
                // Adiciona um novo documento
                await addDoc(collection(db, ...userCollectionPath, userId, 'cards'), {
                    ...cardData,
                    createdAt: new Date(),
                });
                showToast("Cartão adicionado com sucesso!", "success");
            }
            // Limpa os campos do formulário
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

    /**
     * Prepara e exibe o modal de confirmação para exclusão de um cartão.
     * Verifica se há compras ou assinaturas associadas antes de confirmar.
     * @param {string} cardId - O ID do cartão a ser deletado.
     */
    const confirmDeleteCard = async (cardId) => {
        const loansRef = collection(db, ...getUserCollectionPathSegments(), userId, 'loans');
        const qLoans = query(loansRef, where("cardId", "==", cardId));
        const loansSnapshot = await getDocs(qLoans);

        const subscriptionsRef = collection(db, ...getUserCollectionPathSegments(), userId, 'subscriptions');
        const qSubscriptions = query(subscriptionsRef, where("cardId", "==", cardId));
        const subscriptionsSnapshot = await getDocs(qSubscriptions);

        let confirmationMessage = "Tem certeza que deseja deletar este cartão?";
        if (!loansSnapshot.empty) {
            confirmationMessage += "\n\nAVISO: Este cartão possui compras registradas. Deletar o cartão NÃO deletará automaticamente as compras associadas.";
        }
        if (!subscriptionsSnapshot.empty) {
            confirmationMessage += "\nEste cartão também possui assinaturas registradas. Deletar o cartão NÃO deletará automaticamente as assinaturas associadas.";
        }

        setCardToDelete(cardId);
        setIsConfirmationModalOpen(true);
    };

    /**
     * Executa a exclusão de um cartão após a confirmação.
     */
    const handleDeleteCardConfirmed = async () => {
        if (!cardToDelete) return;
        const userCollectionPath = getUserCollectionPathSegments();
        try {
            await deleteDoc(doc(db, ...userCollectionPath, userId, 'cards', cardToDelete));
            showToast("Cartão deletado com sucesso!", "success");
            setCardToDelete(null);
        } catch (error) {
            console.error("Erro ao deletar cartão:", error);
            showToast(`Erro ao deletar cartão: ${error.message}`, "error");
        } finally {
            setIsConfirmationModalOpen(false);
        }
    };

    /**
     * Define o cartão a ser editado e preenche o formulário.
     * @param {object} card - O objeto cartão a ser editado.
     */
    const handleEdit = (card) => {
        setEditingCard(card);
        setCardName(card.name);
        setCardLimitInput(formatCurrencyDisplay(card.limit).replace('R$ ', ''));
        setClosingDay(card.closingDay.toString());
        setDueDay(card.dueDay.toString());
        setCardColor(card.color || '#5E60CE');
    };

    /**
     * Calcula o valor total da fatura para um cartão no mês atual.
     * Inclui parcelas de compras (normais e compartilhadas) e assinaturas ativas.
     * @param {string} cardId - O ID do cartão.
     * @returns {number} O valor total da fatura do mês atual.
     */
    const calculateCurrentMonthInvoiceForCard = (cardId) => {
        let currentMonthInvoice = 0;
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed (Janeiro = 0)

        // Calcula a partir de empréstimos (compras)
        allLoans.forEach(loan => {
            if (loan.cardId === cardId) {
                if (loan.isShared && loan.sharedDetails) {
                    // Processa parcelas da Pessoa 1
                    if (loan.sharedDetails.person1 && loan.sharedDetails.person1.installments) {
                        const p1Installments = typeof loan.sharedDetails.person1.installments === 'string' ? JSON.parse(loan.sharedDetails.person1.installments) : loan.sharedDetails.person1.installments;
                        p1Installments.forEach(inst => {
                            const instDate = new Date(inst.dueDate + "T00:00:00"); // Garante contexto UTC para comparação de data
                            if (instDate.getUTCFullYear() === currentYear && instDate.getUTCMonth() === currentMonth) {
                                currentMonthInvoice += inst.value;
                            }
                        });
                    }
                    // Processa parcelas da Pessoa 2 (apenas se houver valor de compartilhamento para P2)
                    if (loan.sharedDetails.person2 && loan.sharedDetails.person2.installments && loan.sharedDetails.person2.shareAmount > 0) {
                        const p2Installments = typeof loan.sharedDetails.person2.installments === 'string' ? JSON.parse(loan.sharedDetails.person2.installments) : loan.sharedDetails.person2.installments;
                        p2Installments.forEach(inst => {
                            const instDate = new Date(inst.dueDate + "T00:00:00");
                            if (instDate.getUTCFullYear() === currentYear && instDate.getUTCMonth() === currentMonth) {
                                currentMonthInvoice += inst.value;
                            }
                        });
                    }
                } else if (!loan.isShared && loan.installments) { // Empréstimo normal
                    const normalInstallments = typeof loan.installments === 'string' ? JSON.parse(loan.installments) : loan.installments;
                    normalInstallments.forEach(inst => {
                        const instDate = new Date(inst.dueDate + "T00:00:00");
                        if (instDate.getUTCFullYear() === currentYear && instDate.getUTCMonth() === currentMonth) {
                            currentMonthInvoice += inst.value;
                        }
                    });
                }
            }
        });

        // Calcula a partir de assinaturas
        allSubscriptions.forEach(sub => {
            if (sub.cardId === cardId && sub.status === "Ativa") {
                const subStartDate = new Date(sub.startDate + "T00:00:00");
                // Verifica se a assinatura está ativa no mês atual
                if (subStartDate.getFullYear() < currentYear || (subStartDate.getFullYear() === currentYear && subStartDate.getMonth() <= currentMonth)) {
                    currentMonthInvoice += sub.value;
                }
            }
        });
        return currentMonthInvoice;
    };


    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md dark:shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Gerenciar Cartões de Crédito</h2>
            <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
                <input
                    type="text"
                    placeholder="Nome do Cartão (Ex: Visa Platinum)"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                />
                <input
                    type="text"
                    placeholder="Limite Total (Ex: 10.000,00)"
                    value={cardLimitInput}
                    onChange={handleCurrencyInputChange(setCardLimitInput)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                />
                <input
                    type="number"
                    placeholder="Dia Fechamento Fatura"
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    min="1" max="31"
                    required
                />
                <input
                    type="number"
                    placeholder="Dia Vencimento Fatura"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    min="1" max="31"
                    required
                />
                <div className="flex flex-col">
                    <label htmlFor="cardColor" className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Cor do Cartão:</label>
                    <input
                        type="color"
                        id="cardColor"
                        value={cardColor}
                        onChange={(e) => setCardColor(e.target.value)}
                        className="p-1 h-10 w-full border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-white dark:bg-gray-700"
                    />
                </div>

                <div className="col-span-full flex justify-end gap-4 mt-4">
                    <button
                        type="submit"
                        className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md dark:bg-blue-700 dark:hover:bg-blue-800"
                    >
                        {editingCard ? 'Atualizar Cartão' : 'Adicionar Cartão'}
                    </button>
                    {editingCard && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingCard(null);
                                setCardName('');
                                setCardLimitInput('');
                                setClosingDay('');
                                setDueDay('');
                                setCardColor('#5E60CE');
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
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider rounded-tl-lg">Nome</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Limite</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Fatura Mês Atual</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Fechamento</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Vencimento</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider rounded-tr-lg">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {cards.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="py-4 px-4 text-center text-gray-500 dark:text-gray-400">Nenhum cartão cadastrado.</td>
                            </tr>
                        ) : (
                            cards.map((card) => (
                                <tr key={card.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300 flex items-center">
                                        <span
                                            className="w-4 h-4 rounded-sm mr-2 inline-block"
                                            style={{ backgroundColor: card.color || '#cccccc' }}
                                            title={`Cor: ${card.color || 'Padrão'}`}
                                        ></span>
                                        {card.name}
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{formatCurrencyDisplay(card.limit)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{formatCurrencyDisplay(calculateCurrentMonthInvoiceForCard(card.id))}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">Dia {card.closingDay}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">Dia {card.dueDay}</td>
                                    <td className="py-3 px-4 whitespace-nowrap flex items-center gap-2">
                                        <button
                                            onClick={() => handleEdit(card)}
                                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => confirmDeleteCard(card.id)}
                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                        >
                                            Deletar
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <GenericModal
                isOpen={isConfirmationModalOpen}
                onClose={() => setIsConfirmationModalOpen(false)}
                onConfirm={handleDeleteCardConfirmed}
                title="Confirmar Exclusão"
                message={cardToDelete ?
                    `Tem certeza que deseja deletar o cartão "${cards.find(c => c.id === cardToDelete)?.name}"?` +
                    `\n\nAVISO: Este cartão possui compras e/ou assinaturas registradas. Deletar o cartão NÃO deletará automaticamente as compras e assinaturas associadas.`
                    : ''}
                isConfirmation={true}
                theme={theme}
            />
        </div>
    );
}export default ClientManagement;