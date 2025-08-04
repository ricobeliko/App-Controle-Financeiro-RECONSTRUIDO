// src/features/dashboard/Dashboard.jsx

import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';

// IMPORTAÇÕES NECESSÁRIAS
import { AppContext } from '../../App'; // Ajuste o caminho se o AppContext estiver em App.jsx
import { formatCurrencyDisplay } from '../../utils/currency';
import UpgradePrompt from '../../components/UpgradePrompt';
import ProAnalyticsCharts from '../../components/ProAnalyticsCharts';
import GenericModal from '../../components/GenericModal';

function Dashboard({ selectedMonth, setSelectedMonth, selectedCardFilter, setSelectedCardFilter, selectedClientFilter, setSelectedClientFilter }) {
    const { db, userId, isAuthReady, theme, getUserCollectionPathSegments, showToast, isPro } = useContext(AppContext); 
    const [loans, setLoans] = useState([]); // Armazena os documentos de empréstimo originais
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

        // Listeners para coleções: loans, clients, cards, subscriptions
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
            // Limpa todos os listeners ao desmontar o componente
            unsubscribeLoans();
            unsubscribeClients();
            unsubscribeCards();
            unsubscribeSubscriptions();
        };
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    /**
     * Atualiza o status de uma parcela diretamente do dashboard.
     */
    const handleMarkInstallmentAsPaidDashboard = async (originalLoanId, personKeyOrNull, installmentNumber) => {
        const loanToUpdate = loans.find(loan => loan.id === originalLoanId);
        if (!loanToUpdate) return;

        const userCollectionPath = getUserCollectionPathSegments();
        const loanDocRef = doc(db, ...userCollectionPath, userId, 'loans', originalLoanId);
        let updatedFields = {};

        if (loanToUpdate.isShared && personKeyOrNull) {
            const currentSharedDetails = JSON.parse(JSON.stringify(loanToUpdate.sharedDetails));
            const personData = currentSharedDetails[personKeyOrNull];
            const personInstallments = typeof personData.installments === 'string' ?
                JSON.parse(personData.installments) :
                [...(personData.installments || [])];

            const installmentIndex = personInstallments.findIndex(inst => inst.number === installmentNumber);
            if (installmentIndex === -1) {
                console.error("Parcela não encontrada para atualização no dashboard.");
                return;
            }

            personInstallments[installmentIndex] = {
                ...personInstallments[installmentIndex],
                status: 'Paga',
                paidDate: new Date().toISOString().split('T')[0],
            };

            const newValuePaidPerson = personInstallments.filter(i => i.status === 'Paga').reduce((sum, i) => sum + i.value, 0);
            const newBalanceDuePerson = parseFloat((personData.shareAmount - newValuePaidPerson).toFixed(2));
            let newPersonStatus = 'Pendente';
            if (newBalanceDuePerson <= 0.005) newPersonStatus = 'Pago Total'; 
            else if (newValuePaidPerson > 0) newPersonStatus = 'Pago Parcial';

            currentSharedDetails[personKeyOrNull] = {
                ...personData,
                installments: JSON.stringify(personInstallments),
                valuePaid: newValuePaidPerson,
                balanceDue: newBalanceDuePerson,
                statusPayment: newPersonStatus,
            };
            updatedFields = { sharedDetails: currentSharedDetails };

        } else if (!loanToUpdate.isShared) {
            const normalInstallmentsRaw = loanToUpdate.installments;
            let normalInstallmentsParsed = [];
            try {
                normalInstallmentsParsed = typeof normalInstallmentsRaw === 'string' ?
                    JSON.parse(normalInstallmentsRaw) :
                    [...(normalInstallmentsRaw || [])];
            } catch (e) {
                console.error("Erro ao parsear parcelas normais no dashboard", e);
                return;
            }

            const installmentIndex = normalInstallmentsParsed.findIndex(inst => inst.number === installmentNumber);
            if (installmentIndex === -1) {
                console.error("Parcela não encontrada para atualização no dashboard (normal).");
                return;
            }

            normalInstallmentsParsed[installmentIndex] = {
                ...normalInstallmentsParsed[installmentIndex],
                status: 'Paga',
                paidDate: new Date().toISOString().split('T')[0],
            };
            const newValuePaid = normalInstallmentsParsed.filter(i => i.status === 'Paga').reduce((sum, i) => sum + i.value, 0);
            const newBalanceDue = parseFloat((loanToUpdate.totalValue - newValuePaid).toFixed(2));
            let newOverallStatus = 'Pendente';
            if (newBalanceDue <= 0.005) newOverallStatus = 'Pago Total'; 
            else if (newValuePaid > 0) newOverallStatus = 'Pago Parcial';

            updatedFields = {
                installments: JSON.stringify(normalInstallmentsParsed),
                valuePaidClient: newValuePaid,
                balanceDueClient: newBalanceDue,
                statusPaymentClient: newOverallStatus,
            };
        } else {
            console.error("Tentativa de atualizar parcela de forma inválida no dashboard.");
            return;
        }

        try {
            await updateDoc(loanDocRef, updatedFields);
            console.log(`Parcela ${installmentNumber} da compra ${originalLoanId} marcada como paga no dashboard.`);
        } catch (error) {
            console.error("Erro ao marcar parcela como paga no dashboard:", error);
        }
    };


    // Efeito para filtrar e sumarizar os dados
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
                if (lastPaid) {
                    return `${lastPaid.number}/${totalCount}`;
                } else {
                    return totalCount > 0 ? `1/${totalCount}` : `0/${totalCount}`;
                }
            } else {
                return `${currentInstallmentNumber}/${totalCount}`;
            }
        };

        loans.forEach(loan => {
            if (loan.isShared && loan.sharedDetails) {
                if (loan.sharedDetails.person1 && loan.sharedDetails.person1.clientId) {
                    const p1Installments = typeof loan.sharedDetails.person1.installments === 'string' ? JSON.parse(loan.sharedDetails.person1.installments) : loan.sharedDetails.person1.installments || [];
                    p1Installments.forEach(inst => {
                        const instDate = new Date(inst.dueDate + "T00:00:00");
                        if (!filterYear || (instDate.getUTCFullYear() === filterYear && instDate.getUTCMonth() + 1 === filterMonth)) {
                            if (!selectedCardFilter || loan.cardId === selectedCardFilter) {
                                if (!selectedClientFilter || loan.sharedDetails.person1.clientId === selectedClientFilter) {
                                    let status = inst.status;
                                    if (status === 'Pendente' && instDate < todayAtMidnight) status = 'Atrasado';
                                    allItems.push({
                                        id: `${loan.id}-p1-${inst.number}`, type: 'purchase_installment', loanId: loan.id, personKey: 'person1',
                                        cardId: loan.cardId, clientId: loan.sharedDetails.person1.clientId,
                                        description: `${loan.description || 'Compra Comp.'} (P1)`, number: inst.number,
                                        value: inst.value, dueDate: inst.dueDate, currentStatus: status, paidDate: inst.paidDate,
                                        originalLoanStatus: loan.sharedDetails.person1.statusPayment,
                                        installmentsProgress: getInstallmentProgressDisplay(p1Installments, loan.installmentsCount, currentFilterDate)
                                    });
                                }
                            }
                        }
                    });
                }
                if (loan.sharedDetails.person2 && loan.sharedDetails.person2.clientId && loan.sharedDetails.person2.shareAmount > 0) {
                    const p2Installments = typeof loan.sharedDetails.person2.installments === 'string' ? JSON.parse(loan.sharedDetails.person2.installments) : loan.sharedDetails.person2.installments || [];
                    p2Installments.forEach(inst => {
                        const instDate = new Date(inst.dueDate + "T00:00:00");
                        if (!filterYear || (instDate.getUTCFullYear() === filterYear && instDate.getUTCMonth() + 1 === filterMonth)) {
                            if (!selectedCardFilter || loan.cardId === selectedCardFilter) {
                                if (!selectedClientFilter || loan.sharedDetails.person2.clientId === selectedClientFilter) {
                                    let status = inst.status;
                                    if (status === 'Pendente' && instDate < todayAtMidnight) status = 'Atrasado';
                                    allItems.push({
                                        id: `${loan.id}-p2-${inst.number}`, type: 'purchase_installment', loanId: loan.id, personKey: 'person2',
                                        cardId: loan.cardId, clientId: loan.sharedDetails.person2.clientId,
                                        description: `${loan.description || 'Compra Comp.'} (P2)`, number: inst.number,
                                        value: inst.value, dueDate: inst.dueDate, currentStatus: status, paidDate: inst.paidDate,
                                        originalLoanStatus: loan.sharedDetails.person2.statusPayment,
                                        installmentsProgress: getInstallmentProgressDisplay(p2Installments, loan.installmentsCount, currentFilterDate)
                                    });
                                }
                            }
                        }
                    });
                }
            } else if (!loan.isShared) {
                const normalInstallments = typeof loan.installments === 'string' ? JSON.parse(loan.installments) : loan.installments || [];
                normalInstallments.forEach(inst => {
                    const instDate = new Date(inst.dueDate + "T00:00:00");
                    if (!filterYear || (instDate.getUTCFullYear() === filterYear && instDate.getUTCMonth() + 1 === filterMonth)) {
                        if (!selectedCardFilter || loan.cardId === selectedCardFilter) {
                            if (!selectedClientFilter || loan.clientId === selectedClientFilter) {
                                let status = inst.status;
                                if (status === 'Pendente' && instDate < todayAtMidnight) status = 'Atrasado';
                                allItems.push({
                                    id: `${loan.id}-${inst.number}`, type: 'purchase_installment', loanId: loan.id, personKey: null,
                                    cardId: loan.cardId, clientId: loan.clientId,
                                    description: loan.description || 'Compra', number: inst.number,
                                    value: inst.value, dueDate: inst.dueDate, currentStatus: status, paidDate: inst.paidDate,
                                    originalLoanStatus: loan.statusPaymentClient,
                                    installmentsProgress: getInstallmentProgressDisplay(normalInstallments, loan.installmentsCount, currentFilterDate)
                                });
                            }
                        }
                    }
                });
            }
        });

        subscriptions.forEach(sub => {
            if (sub.status !== 'Ativa') return;
            const paymentStatusForMonth = sub.paymentHistory?.[selectedMonth] || 'Pendente';
            const subStartDate = new Date(sub.startDate + "T00:00:00");
            if (filterYear && filterMonth) {
                const filterDateEndOfMonth = new Date(Date.UTC(filterYear, filterMonth, 0));
                if (subStartDate > filterDateEndOfMonth) return; 
            }
            if (selectedCardFilter && sub.cardId !== selectedCardFilter) return;
            if (selectedClientFilter && sub.clientId !== selectedClientFilter) return;

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
                sortDate: sortDate, 
                installmentsProgress: 'N/A' 
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

    const confirmMarkAllPaid = () => {
        setIsMarkAllPaidConfirmationOpen(true);
    };

    const handleMarkAllInstallmentsAsPaid = async () => {
        const pendingInstallmentsToMark = displayableItems.filter(item =>
            item.type === 'purchase_installment' &&
            (item.currentStatus === 'Pendente' || item.currentStatus === 'Atrasado')
        );

        if (pendingInstallmentsToMark.length === 0) {
            showToast("Nenhuma parcela pendente ou atrasada para marcar como paga no mês selecionado.", "info");
            setIsMarkAllPaidConfirmationOpen(false);
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const item of pendingInstallmentsToMark) {
            try {
                await handleMarkInstallmentAsPaidDashboard(item.loanId, item.personKey, item.number);
                successCount++;
            } catch (error) {
                console.error(`Erro ao atualizar a compra ${item.loanId} para marcar parcela ${item.number} como paga:`, error);
                errorCount++;
            }
        }
        setIsMarkAllPaidConfirmationOpen(false); 
        if (successCount > 0) {
            showToast(`🎉 ${successCount} parcela(s) marcada(s) como paga(s)!`, "success");
        }
        if (errorCount > 0) {
            showToast(`${errorCount} parcela(s) não puderam ser marcadas como pagas. Verifique o console para detalhes.`, "error");
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md dark:shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Resumo Financeiro</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="flex flex-col">
                    <label htmlFor="month-filter" className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Filtrar por Mês:</label>
                    <input type="month" id="month-filter" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md" />
                </div>
                <div className="flex flex-col">
                    <label htmlFor="card-filter" className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Filtrar por Cartão:</label>
                    <select id="card-filter" value={selectedCardFilter} onChange={(e) => setSelectedCardFilter(e.target.value)} className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                        <option value="">Todos os Cartões</option>
                        {cards.map(card => (<option key={card.id} value={card.id} style={{ backgroundColor: card.color, color: theme === 'dark' ? (['#000000', '#5E60CE'].includes(card.color) ? 'white' : 'black') : (['#FFFFFF', '#FFFFFF'].includes(card.color) ? 'black' : 'inherit') }}>{card.name}</option>))}
                    </select>
                </div>
                <div className="flex flex-col">
                    <label htmlFor="client-filter" className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Filtrar por Pessoa:</label>
                    <select id="client-filter" value={selectedClientFilter} onChange={(e) => setSelectedClientFilter(e.target.value)} className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                        <option value="">Todas as Pessoas</option>
                        {clients.map(client => (<option key={client.id} value={client.id}>{client.name}</option>))}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg shadow-sm border border-blue-200 dark:border-blue-700">
                    <h3 className="text-lg font-medium text-blue-800 dark:text-blue-200">Total Fatura (Mês)</h3>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrencyDisplay(dashboardSummary.totalFatura)}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg shadow-sm border border-purple-200 dark:border-purple-700">
                    <h3 className="text-lg font-medium text-purple-800 dark:text-purple-200">Total Assinaturas (Mês)</h3>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrencyDisplay(dashboardSummary.totalSubscriptions)}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg shadow-sm border border-green-200 dark:border-green-700">
                    <h3 className="text-lg font-medium text-green-800 dark:text-green-200">Total Recebido (Parcelas)</h3>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrencyDisplay(dashboardSummary.totalReceived)}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg shadow-sm border border-red-200 dark:border-red-700">
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
                    <p className="text-center text-gray-500 dark:text-gray-400">Nenhum item encontrado para os filtros selecionados.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider rounded-tl-lg">Tipo</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Descrição</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Pessoa/Origem</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Cartão</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Valor</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Venc./Cobrança</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Parcelas</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                    <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider flex items-center justify-between rounded-tr-lg">
                                        <span>Ações</span>
                                        <button type="button" onClick={confirmMarkAllPaid} className="ml-2 bg-purple-500 text-white px-2 py-1 rounded-md hover:bg-purple-600 transition duration-300 text-xs dark:bg-purple-700 dark:hover:bg-purple-800 whitespace-nowrap" title="Marcar todas as parcelas pendentes/atrasadas deste mês como pagas">Marcar Tudo Pago</button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {displayableItems.map((item) => {
                                    const cardInfo = getCardDisplayInfo(item.cardId);
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{item.type === 'purchase_installment' ? 'Parcela Compra' : 'Assinatura'}</td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{item.description}</td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{item.clientId ? (clients.find(c => c.id === item.clientId)?.name || 'N/A') : 'N/A'}</td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300 flex items-center">
                                                <span className="w-4 h-4 rounded-sm mr-2 inline-block" style={{ backgroundColor: cardInfo.color }} title={`Cor: ${cardInfo.color}`}></span>
                                                {cardInfo.name}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{formatCurrencyDisplay(item.value)}</td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{item.dueDate}</td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{item.installmentsProgress}</td>
                                            <td className={`py-3 px-4 whitespace-nowrap font-semibold ${item.currentStatus === 'Paga' ? 'text-green-600 dark:text-green-400' : item.currentStatus === 'Atrasado' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>{item.currentStatus}</td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {item.type === 'purchase_installment' && item.currentStatus !== 'Paga' && item.originalLoanStatus !== 'Pago Total' && (
                                                    <button onClick={() => handleMarkInstallmentAsPaidDashboard(item.loanId, item.personKey, item.number)} className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition duration-300 text-sm dark:bg-blue-700 dark:hover:bg-blue-800">Marcar Paga</button>
                                                )}
                                                {item.type === 'subscription_charge' && (<span className="text-sm text-gray-500 dark:text-gray-400 italic">Gerenciar na aba Assinaturas</span>)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <GenericModal isOpen={isMarkAllPaidConfirmationOpen} onClose={() => setIsMarkAllPaidConfirmationOpen(false)} onConfirm={handleMarkAllInstallmentsAsPaid} title="Confirmar Ação" message={`Tem certeza que deseja marcar TODAS as parcelas pendentes ou atrasadas do mês ${selectedMonth} como PAGAS? Esta ação é irreversível.`} isConfirmation={true} theme={theme} />
        </div>
    );
}

export default Dashboard;
