// src/features/dashboard/Dashboard.jsx

import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';

// 1. IMPORTAÇÃO CORRIGIDA
// Agora importa o hook useAppContext do local centralizado.
import { useAppContext } from '../../context/AppContext';
import { formatCurrencyDisplay } from '../../utils/currency';
import UpgradePrompt from '../../components/UpgradePrompt';
import ProAnalyticsCharts from '../../components/ProAnalyticsCharts';
import GenericModal from '../../components/GenericModal';

function Dashboard({ selectedMonth, setSelectedMonth, selectedCardFilter, setSelectedCardFilter, selectedClientFilter, setSelectedClientFilter }) {
    // 2. USO CORRETO DO HOOK
    const { db, userId, isAuthReady, theme, getUserCollectionPathSegments, showToast, isPro } = useAppContext(); 
    
    // O resto do componente permanece o mesmo
    const [loans, setLoans] = useState([]);
    const [clients, setClients] = useState([]);
    const [cards, setCards] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);

    const [dashboardSummary, setDashboardSummary] = useState({
        totalFatura: 0,
        totalReceived: 0,
        totalBalanceDue: 0,
        totalSubscriptions: 0,
    });
    const [displayableItems, setDisplayableItems] = useState([]);
    const [isMarkAllPaidConfirmationOpen, setIsMarkAllPaidConfirmationOpen] = useState(false);

    // Efeito para carregar todos os dados necessários para o dashboard
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();

        const loansColRef = collection(db, ...userCollectionPath, userId, 'loans');
        const unsubscribeLoans = onSnapshot(loansColRef, (snapshot) => {
            setLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar empréstimos para resumo:", error));

        const clientsColRef = collection(db, ...userCollectionPath, userId, 'clients');
        const unsubscribeClients = onSnapshot(clientsColRef, (snapshot) => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar pessoas para resumo:", error));

        const cardsColRef = collection(db, ...userCollectionPath, userId, 'cards');
        const unsubscribeCards = onSnapshot(cardsColRef, (snapshot) => {
            setCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar cartões para resumo:", error));

        const subscriptionsColRef = collection(db, ...userCollectionPath, userId, 'subscriptions');
        const unsubscribeSubscriptions = onSnapshot(subscriptionsColRef, (snapshot) => {
            setSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'subscription' })));
        }, (error) => console.error("Erro ao carregar assinaturas para resumo:", error));

        return () => {
            unsubscribeLoans();
            unsubscribeClients();
            unsubscribeCards();
            unsubscribeSubscriptions();
        };
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    const handleMarkInstallmentAsPaidDashboard = async (originalLoanId, personKeyOrNull, installmentNumber) => {
        const loanToUpdate = loans.find(loan => loan.id === originalLoanId);
        if (!loanToUpdate) {
            showToast("Erro: Compra não encontrada.", "error");
            return;
        }

        const userCollectionPath = getUserCollectionPathSegments();
        const loanDocRef = doc(db, ...userCollectionPath, userId, 'loans', originalLoanId);
        let updatedFields = {};

        try {
            if (loanToUpdate.isShared && personKeyOrNull) {
                const currentSharedDetails = JSON.parse(JSON.stringify(loanToUpdate.sharedDetails)); // Deep copy
                const personData = currentSharedDetails[personKeyOrNull];
                
                // Lida com dados antigos (string) e novos (array)
                let personInstallments;
                if (typeof personData.installments === 'string') {
                    personInstallments = JSON.parse(personData.installments);
                } else {
                    personInstallments = [...(personData.installments || [])];
                }

                const installmentIndex = personInstallments.findIndex(inst => inst.number === installmentNumber);
                if (installmentIndex === -1) throw new Error("Parcela partilhada não encontrada.");

                personInstallments[installmentIndex].status = 'Paga';
                personInstallments[installmentIndex].paidDate = new Date().toISOString().split('T')[0];

                const newValuePaidPerson = personInstallments.filter(i => i.status === 'Paga').reduce((sum, i) => sum + i.value, 0);
                const newBalanceDuePerson = parseFloat((personData.shareAmount - newValuePaidPerson).toFixed(2));
                
                let newPersonStatus = 'Pendente';
                if (newBalanceDuePerson <= 0.005) newPersonStatus = 'Pago Total'; 
                else if (newValuePaidPerson > 0) newPersonStatus = 'Pago Parcial';

                currentSharedDetails[personKeyOrNull] = {
                    ...personData,
                    installments: personInstallments, // Salva como array
                    valuePaid: newValuePaidPerson,
                    balanceDue: newBalanceDuePerson,
                    statusPayment: newPersonStatus,
                };
                updatedFields = { sharedDetails: currentSharedDetails };

            } else if (!loanToUpdate.isShared) {
                // Lida com dados antigos (string) e novos (array)
                let normalInstallmentsParsed;
                if (typeof loanToUpdate.installments === 'string') {
                    normalInstallmentsParsed = JSON.parse(loanToUpdate.installments);
                } else {
                    normalInstallmentsParsed = [...(loanToUpdate.installments || [])];
                }

                const installmentIndex = normalInstallmentsParsed.findIndex(inst => inst.number === installmentNumber);
                if (installmentIndex === -1) throw new Error("Parcela não encontrada.");

                normalInstallmentsParsed[installmentIndex].status = 'Paga';
                normalInstallmentsParsed[installmentIndex].paidDate = new Date().toISOString().split('T')[0];

                const newValuePaid = normalInstallmentsParsed.filter(i => i.status === 'Paga').reduce((sum, i) => sum + i.value, 0);
                const newBalanceDue = parseFloat((loanToUpdate.totalValue - newValuePaid).toFixed(2));
                
                let newOverallStatus = 'Pendente';
                if (newBalanceDue <= 0.005) newOverallStatus = 'Pago Total'; 
                else if (newValuePaid > 0) newOverallStatus = 'Pago Parcial';

                updatedFields = {
                    installments: normalInstallmentsParsed, // Salva como array
                    valuePaidClient: newValuePaid,
                    balanceDueClient: newBalanceDue,
                    statusPaymentClient: newOverallStatus,
                };
            } else {
                throw new Error("Tentativa de atualização inválida.");
            }

            await updateDoc(loanDocRef, updatedFields);
            showToast("Parcela marcada como paga com sucesso!", "success");

        } catch (error) {
            console.error("Erro ao marcar parcela como paga no dashboard:", error);
            showToast(`Erro ao marcar parcela como paga: ${error.message}`, "error");
        }
    };

    useEffect(() => {
        if (!isAuthReady || !clients.length || !cards.length) return; 

        const [filterYear, filterMonth] = selectedMonth ? selectedMonth.split('-').map(Number) : [null, null];
        const currentFilterDate = filterYear && filterMonth ? new Date(Date.UTC(filterYear, filterMonth - 1, 1)) : null;
        const todayAtMidnight = new Date();
        todayAtMidnight.setHours(0, 0, 0, 0);

        const allItems = [];

        const getInstallmentProgressDisplay = (installmentsArray, totalCount, currentFilterDate) => {
            if (!installmentsArray || installmentsArray.length === 0) return '0/0';
            let currentInstallmentNumber = 0;
            let foundNextPendingOrOverdue = false; 
            const filterYearNum = currentFilterDate ? currentFilterDate.getUTCFullYear() : null;
            const filterMonthNum = currentFilterDate ? currentFilterDate.getUTCMonth() : null;

            for (let i = 0; i < installmentsArray.length; i++) {
                const inst = installmentsArray[i];
                const instDueDate = new Date(inst.dueDate + "T00:00:00");
                instDueDate.setHours(0, 0, 0, 0);

                if (inst.status === 'Pendente') {
                    if (currentFilterDate) {
                        if (instDueDate.getUTCFullYear() > filterYearNum || 
                           (instDueDate.getUTCFullYear() === filterYearNum && instDueDate.getUTCMonth() >= filterMonthNum)) {
                            currentInstallmentNumber = inst.number;
                            foundNextPendingOrOverdue = true;
                            break; 
                        }
                    } else { 
                        currentInstallmentNumber = inst.number;
                        foundNextPendingOrOverdue = true;
                        break;
                    }
                }
            }

            if (!foundNextPendingOrOverdue) {
                const lastPaid = installmentsArray.filter(inst => inst.status === 'Paga').pop();
                return lastPaid ? `${lastPaid.number}/${totalCount}` : (totalCount > 0 ? `1/${totalCount}` : `0/${totalCount}`);
            } else {
                return `${currentInstallmentNumber}/${totalCount}`;
            }
        };

        loans.forEach(loan => {
            const processInstallments = (installments, personDetails) => {
                // ✅ CORRIGIDO E ROBUSTO: Lida com dados antigos (string) e novos (array)
                let parsedInstallments;
                if (typeof installments === 'string') {
                    try {
                        parsedInstallments = JSON.parse(installments);
                    } catch (e) {
                        console.error("Falha ao analisar string de parcelas:", installments, e);
                        parsedInstallments = []; // Usa array vazio em caso de erro de análise
                    }
                } else {
                    parsedInstallments = installments || [];
                }

                // Garante que é sempre um array antes de chamar forEach
                if (!Array.isArray(parsedInstallments)) {
                    console.error("'parsedInstallments' não é um array após o processamento:", parsedInstallments);
                    return; // Pula o processamento para este item se não for um array
                }
                
                parsedInstallments.forEach(inst => {
                    const instDate = new Date(inst.dueDate + "T00:00:00");
                    if ((!filterYear || (instDate.getUTCFullYear() === filterYear && instDate.getUTCMonth() + 1 === filterMonth)) &&
                        (!selectedCardFilter || loan.cardId === selectedCardFilter) &&
                        (!selectedClientFilter || personDetails.clientId === selectedClientFilter)) {
                        
                        let status = inst.status;
                        if (status === 'Pendente' && instDate < todayAtMidnight) status = 'Atrasado';

                        allItems.push({
                            id: `${loan.id}-${personDetails.key || 'main'}-${inst.number}`, type: 'purchase_installment', loanId: loan.id, personKey: personDetails.key,
                            cardId: loan.cardId, clientId: personDetails.clientId,
                            description: personDetails.label ? `${loan.description || 'Compra'} (${personDetails.label})` : (loan.description || 'Compra'),
                            number: inst.number,
                            value: inst.value, dueDate: inst.dueDate, currentStatus: status, paidDate: inst.paidDate,
                            originalLoanStatus: personDetails.statusPayment,
                            installmentsProgress: getInstallmentProgressDisplay(parsedInstallments, loan.installmentsCount, currentFilterDate)
                        });
                    }
                });
            };

            if (loan.isShared && loan.sharedDetails) {
                if (loan.sharedDetails.person1?.clientId) {
                    processInstallments(loan.sharedDetails.person1.installments, { key: 'person1', clientId: loan.sharedDetails.person1.clientId, label: 'P1', statusPayment: loan.sharedDetails.person1.statusPayment });
                }
                if (loan.sharedDetails.person2?.clientId && loan.sharedDetails.person2.shareAmount > 0) {
                    processInstallments(loan.sharedDetails.person2.installments, { key: 'person2', clientId: loan.sharedDetails.person2.clientId, label: 'P2', statusPayment: loan.sharedDetails.person2.statusPayment });
                }
            } else if (!loan.isShared) {
                processInstallments(loan.installments, { key: null, clientId: loan.clientId, label: '', statusPayment: loan.statusPaymentClient });
            }
        });

        subscriptions.forEach(sub => {
            if (sub.status !== 'Ativa') return;
            const subStartDate = new Date(sub.startDate + "T00:00:00");
            if (filterYear && filterMonth) {
                const filterDateEndOfMonth = new Date(Date.UTC(filterYear, filterMonth, 0));
                if (subStartDate > filterDateEndOfMonth) return; 
            }
            if ((selectedCardFilter && sub.cardId !== selectedCardFilter) || (selectedClientFilter && sub.clientId !== selectedClientFilter)) return;

            const paymentStatusForMonth = sub.paymentHistory?.[selectedMonth] || 'Pendente';
            let displayDueDate = `Mensal`;
            let sortDate = new Date(Date.UTC(filterYear || new Date().getUTCFullYear(), (filterMonth || new Date().getUTCMonth() + 1) - 1, 1));
            
            if (filterYear && filterMonth) {
                const card = cards.find(c => c.id === sub.cardId);
                const dayToDisplay = card ? card.closingDay : 1; 
                displayDueDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-${String(dayToDisplay).padStart(2, '0')}`;
                sortDate = new Date(Date.UTC(filterYear, filterMonth - 1, dayToDisplay));
            }

            allItems.push({
                id: sub.id, type: 'subscription_charge', cardId: sub.cardId, clientId: sub.clientId,
                description: sub.name, value: sub.value, dueDate: displayDueDate, currentStatus: paymentStatusForMonth,
                sortDate: sortDate, installmentsProgress: 'N/A' 
            });
        });

        allItems.sort((a, b) => {
            const dateA = a.type === 'subscription_charge' ? a.sortDate : new Date(a.dueDate + "T00:00:00");
            const dateB = b.type === 'subscription_charge' ? b.sortDate : new Date(b.dueDate + "T00:00:00");
            return dateA - dateB;
        });

        setDisplayableItems(allItems);

        const newTotalFatura = allItems.reduce((sum, item) => sum + item.value, 0);
        const newTotalReceived = allItems.filter(item => item.currentStatus === 'Paga').reduce((sum, item) => sum + item.value, 0);
        const newTotalBalanceDue = newTotalFatura - newTotalReceived;
        const newTotalSubscriptions = allItems.filter(item => item.type === 'subscription_charge').reduce((sum, item) => sum + item.value, 0);
        setDashboardSummary({ totalFatura: newTotalFatura, totalReceived: newTotalReceived, totalBalanceDue: newTotalBalanceDue, totalSubscriptions: newTotalSubscriptions });

    }, [loans, clients, cards, subscriptions, selectedMonth, selectedCardFilter, selectedClientFilter, isAuthReady]);

    const getCardDisplayInfo = (cardId) => {
        const card = cards.find(c => c.id === cardId);
        return card ? { name: card.name, color: card.color || '#cccccc' } : { name: 'N/A', color: '#cccccc' };
    };

    const confirmMarkAllPaid = () => setIsMarkAllPaidConfirmationOpen(true);

    const handleMarkAllInstallmentsAsPaid = async () => {
        const pendingInstallmentsToMark = displayableItems.filter(item =>
            item.type === 'purchase_installment' && (item.currentStatus === 'Pendente' || item.currentStatus === 'Atrasado')
        );

        if (pendingInstallmentsToMark.length === 0) {
            showToast("Nenhuma parcela pendente ou atrasada para marcar como paga.", "info");
            setIsMarkAllPaidConfirmationOpen(false);
            return;
        }

        const promises = pendingInstallmentsToMark.map(item => 
            handleMarkInstallmentAsPaidDashboard(item.loanId, item.personKey, item.number)
        );
        
        try {
            await Promise.all(promises);
            showToast(`🎉 ${pendingInstallmentsToMark.length} parcela(s) marcada(s) como paga(s)!`, "success");
        } catch (error) {
            showToast(`Ocorreu um erro ao marcar as parcelas como pagas.`, "error");
        } finally {
            setIsMarkAllPaidConfirmationOpen(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md dark:shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Resumo Financeiro</h2>
            
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="flex flex-col">
                    <label htmlFor="month-filter" className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Mês:</label>
                    <input type="month" id="month-filter" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md" />
                </div>
                <div className="flex flex-col">
                    <label htmlFor="card-filter" className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Cartão:</label>
                    <select id="card-filter" value={selectedCardFilter} onChange={(e) => setSelectedCardFilter(e.target.value)} className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                        <option value="">Todos os Cartões</option>
                        {cards.map(card => (<option key={card.id} value={card.id} style={{ backgroundColor: card.color, color: theme === 'dark' ? '#FFF' : '#000' }}>{card.name}</option>))}
                    </select>
                </div>
                <div className="flex flex-col">
                    <label htmlFor="client-filter" className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Pessoa:</label>
                    <select id="client-filter" value={selectedClientFilter} onChange={(e) => setSelectedClientFilter(e.target.value)} className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                        <option value="">Todas as Pessoas</option>
                        {clients.map(client => (<option key={client.id} value={client.id}>{client.name}</option>))}
                    </select>
                </div>
            </div>

            {/* Secção de Resumo */}
            <div className="flex flex-wrap gap-4 mb-8">
                <div className="flex-1 min-w-[200px] bg-blue-50 dark:bg-blue-900 p-4 rounded-lg shadow-sm border border-blue-200 dark:border-blue-700">
                    <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200">Total Fatura (Mês)</h3>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrencyDisplay(dashboardSummary.totalFatura)}</p>
                </div>
                <div className="flex-1 min-w-[200px] bg-purple-50 dark:bg-purple-900 p-4 rounded-lg shadow-sm border border-purple-200 dark:border-purple-700">
                    <h3 className="text-lg font-medium text-purple-800 dark:text-purple-200">Total Assinaturas (Mês)</h3>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrencyDisplay(dashboardSummary.totalSubscriptions)}</p>
                </div>
                <div className="flex-1 min-w-[200px] bg-green-50 dark:bg-green-900 p-4 rounded-lg shadow-sm border border-green-200 dark:border-green-700">
                    <h3 className="text-lg font-medium text-green-800 dark:text-green-200">Total Recebido (Parcelas)</h3>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrencyDisplay(dashboardSummary.totalReceived)}</p>
                </div>
                <div className="flex-1 min-w-[200px] bg-red-50 dark:bg-red-900 p-4 rounded-lg shadow-sm border border-red-200 dark:border-red-700">
                    <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Saldo Devedor (Parcelas)</h3>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrencyDisplay(dashboardSummary.totalBalanceDue)}</p>
                </div>
            </div>
            
            <div className="analytics-section">
                {isPro ? <ProAnalyticsCharts loans={loans} clients={clients} theme={theme} /> : <UpgradePrompt />}
            </div>
            
            <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Itens da Fatura (Mês Filtrado)</h3>
                {displayableItems.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400">Nenhum item encontrado para os filtros.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Tipo</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Descrição</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Pessoa</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Cartão</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Valor</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Vencimento</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Parcelas</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider flex items-center justify-between">
                                        <span>Ações</span>
                                        <button type="button" onClick={confirmMarkAllPaid} className="ml-2 bg-purple-500 text-white px-2 py-1 rounded-md hover:bg-purple-600 text-xs" title="Marcar todas as parcelas pendentes/atrasadas como pagas">Marcar Tudo Pago</button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {displayableItems.map((item) => {
                                    const cardInfo = getCardDisplayInfo(item.cardId);
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="py-3 px-4">{item.type === 'purchase_installment' ? 'Parcela' : 'Assinatura'}</td>
                                            <td className="py-3 px-4">{item.description}</td>
                                            <td className="py-3 px-4">{clients.find(c => c.id === item.clientId)?.name || 'N/A'}</td>
                                            <td className="py-3 px-4 flex items-center">
                                                <span className="w-4 h-4 rounded-sm mr-2" style={{ backgroundColor: cardInfo.color }}></span>{cardInfo.name}
                                            </td>
                                            <td className="py-3 px-4">{formatCurrencyDisplay(item.value)}</td>
                                            <td className="py-3 px-4">{item.dueDate}</td>
                                            <td className="py-3 px-4">{item.installmentsProgress}</td>
                                            <td className={`py-3 px-4 font-semibold ${item.currentStatus === 'Paga' ? 'text-green-500' : item.currentStatus === 'Atrasado' ? 'text-red-500' : 'text-yellow-500'}`}>{item.currentStatus}</td>
                                            <td className="py-3 px-4">
                                                {item.type === 'purchase_installment' && item.currentStatus !== 'Paga' && (
                                                    <button onClick={() => handleMarkInstallmentAsPaidDashboard(item.loanId, item.personKey, item.number)} className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 text-sm">Marcar Paga</button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <GenericModal isOpen={isMarkAllPaidConfirmationOpen} onClose={() => setIsMarkAllPaidConfirmationOpen(false)} onConfirm={handleMarkAllInstallmentsAsPaid} title="Confirmar Ação" message={`Tem a certeza de que deseja marcar TODAS as parcelas pendentes ou atrasadas como PAGAS?`} isConfirmation={true} theme={theme} />
        </div>
    );
}

export default Dashboard;
