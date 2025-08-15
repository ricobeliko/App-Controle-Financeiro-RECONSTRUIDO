// src/features/dashboard/Dashboard.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAppContext } from '../../context/AppContext';
import { formatCurrencyDisplay } from '../../utils/currency';
import UpgradePrompt from '../../components/UpgradePrompt';
import ProAnalyticsCharts from '../../components/ProAnalyticsCharts';
import GenericModal from '../../components/GenericModal';
import ProSummary from './ProSummary'; 

function Dashboard({ selectedMonth, setSelectedMonth, selectedCardFilter, setSelectedCardFilter, selectedClientFilter, setSelectedClientFilter }) {
    const { db, userId, isAuthReady, theme, getUserCollectionPathSegments, showToast, isPro } = useAppContext(); 
    
    const [loans, setLoans] = useState([]);
    const [clients, setClients] = useState([]);
    const [cards, setCards] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [expenses, setExpenses] = useState([]);

    const [dashboardSummary, setDashboardSummary] = useState({
        totalFatura: 0,
        totalReceived: 0,
        totalBalanceDue: 0,
        totalSubscriptions: 0,
    });
    const [displayableItems, setDisplayableItems] = useState([]);
    const [isMarkAllPaidConfirmationOpen, setIsMarkAllPaidConfirmationOpen] = useState(false);

    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();
        const unsubLoans = onSnapshot(collection(db, ...userCollectionPath, userId, 'loans'), snapshot => setLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubClients = onSnapshot(collection(db, ...userCollectionPath, userId, 'clients'), snapshot => setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubCards = onSnapshot(collection(db, ...userCollectionPath, userId, 'cards'), snapshot => setCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubSubscriptions = onSnapshot(collection(db, ...userCollectionPath, userId, 'subscriptions'), snapshot => setSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubExpenses = onSnapshot(collection(db, ...userCollectionPath, userId, 'expenses'), snapshot => setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        return () => { unsubLoans(); unsubClients(); unsubCards(); unsubSubscriptions(); unsubExpenses(); };
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    const handleMarkInstallmentAsPaidDashboard = async (originalLoanId, personKeyOrNull, installmentNumber) => {
        const loanToUpdate = loans.find(loan => loan.id === originalLoanId);
        if (!loanToUpdate) { showToast("Erro: Compra não encontrada.", "error"); return; }
        const userCollectionPath = getUserCollectionPathSegments();
        const loanDocRef = doc(db, ...userCollectionPath, userId, 'loans', originalLoanId);
        let updatedFields = {};
        try {
            if (loanToUpdate.isShared && personKeyOrNull) {
                const currentSharedDetails = JSON.parse(JSON.stringify(loanToUpdate.sharedDetails));
                const personData = currentSharedDetails[personKeyOrNull];
                const personInstallments = Array.isArray(personData.installments) ? [...personData.installments] : [];
                const installmentIndex = personInstallments.findIndex(inst => inst.number === installmentNumber);
                if (installmentIndex === -1) throw new Error("Parcela compartilhada não encontrada.");
                personInstallments[installmentIndex].status = 'Paga';
                personInstallments[installmentIndex].paidDate = new Date().toISOString().split('T')[0];
                const newValuePaidPerson = personInstallments.filter(inst => inst.status === 'Paga').reduce((sum, inst) => sum + inst.value, 0);
                const newBalanceDuePerson = parseFloat((personData.shareAmount - newValuePaidPerson).toFixed(2));
                let newPersonStatus = newBalanceDuePerson <= 0.005 ? 'Pago Total' : (newValuePaidPerson > 0 ? 'Pago Parcial' : 'Pendente');
                currentSharedDetails[personKeyOrNull] = { ...personData, installments: personInstallments, valuePaid: newValuePaidPerson, balanceDue: newBalanceDuePerson, statusPayment: newPersonStatus };
                updatedFields.sharedDetails = currentSharedDetails;
            } else if (!loanToUpdate.isShared) {
                const normalInstallmentsParsed = Array.isArray(loanToUpdate.installments) ? [...loanToUpdate.installments] : [];
                const installmentIndex = normalInstallmentsParsed.findIndex(inst => inst.number === installmentNumber);
                if (installmentIndex === -1) throw new Error("Parcela não encontrada.");
                normalInstallmentsParsed[installmentIndex].status = 'Paga';
                normalInstallmentsParsed[installmentIndex].paidDate = new Date().toISOString().split('T')[0];
                const newValuePaid = normalInstallmentsParsed.filter(i => i.status === 'Paga').reduce((sum, i) => sum + i.value, 0);
                const newBalanceDue = parseFloat((loanToUpdate.totalValue - newValuePaid).toFixed(2));
                let newOverallStatus = newBalanceDue <= 0.005 ? 'Pago Total' : (newValuePaid > 0 ? 'Pago Parcial' : 'Pendente');
                updatedFields = { installments: normalInstallmentsParsed, valuePaidClient: newValuePaid, balanceDueClient: newBalanceDue, statusPaymentClient: newOverallStatus };
            }
            await updateDoc(loanDocRef, updatedFields);
            showToast("Parcela marcada como paga com sucesso!", "success");
        } catch (error) {
            console.error("Erro ao marcar parcela:", error);
            showToast(`Erro: ${error.message}`, "error");
        }
    };

    const { filteredItemsForTable, filteredLoansForChart, filteredExpensesForChart, filteredSubscriptionsForChart } = useMemo(() => {
        if (!isAuthReady || !clients.length || !cards.length) {
            return { filteredItemsForTable: [], filteredLoansForChart: [], filteredExpensesForChart: [], filteredSubscriptionsForChart: [] };
        }
        const [filterYear, filterMonth] = selectedMonth.split('-').map(Number);
        const todayAtMidnight = new Date();
        todayAtMidnight.setHours(0, 0, 0, 0);
        const allItems = [];

        loans.forEach(loan => {
            const processInstallments = (installments, personDetails) => {
                (installments || []).forEach(inst => {
                    const instDate = new Date(inst.dueDate + "T00:00:00");
                    if (instDate.getUTCFullYear() === filterYear && instDate.getUTCMonth() + 1 === filterMonth &&
                        (!selectedCardFilter || loan.cardId === selectedCardFilter) &&
                        (!selectedClientFilter || personDetails.clientId === selectedClientFilter)) {
                        let status = inst.status === 'Pendente' && instDate < todayAtMidnight ? 'Atrasado' : inst.status;
                        allItems.push({ ...loan, ...inst, id: `${loan.id}-${personDetails.key || 'main'}-${inst.number}`, type: 'Parcela', loanId: loan.id, personKey: personDetails.key, clientId: personDetails.clientId, description: personDetails.label ? `${loan.description || 'Compra'} (${personDetails.label})` : (loan.description || 'Compra'), currentStatus: status });
                    }
                });
            };
            if (loan.isShared) {
                if (loan.sharedDetails?.person1) processInstallments(loan.sharedDetails.person1.installments, { key: 'person1', clientId: loan.sharedDetails.person1.clientId, label: 'P1' });
                if (loan.sharedDetails?.person2?.shareAmount > 0) processInstallments(loan.sharedDetails.person2.installments, { key: 'person2', clientId: loan.sharedDetails.person2.clientId, label: 'P2' });
            } else {
                processInstallments(loan.installments, { key: null, clientId: loan.clientId });
            }
        });

        subscriptions.forEach(sub => {
            if (sub.status === 'Ativa' && (!selectedCardFilter || sub.cardId === selectedCardFilter) && (!selectedClientFilter || sub.clientId === selectedClientFilter)) {
                allItems.push({ ...sub, type: 'Assinatura', dueDate: selectedMonth, currentStatus: 'Pendente' });
            }
        });

        expenses.forEach(expense => {
            const expenseDate = new Date(expense.date + "T00:00:00");
            let faturaMonth = expenseDate.getMonth() + 1;
            let faturaYear = expenseDate.getFullYear();

            if (expense.cardId) {
                const card = cards.find(c => c.id === expense.cardId);
                if (card && typeof card.closingDay === 'number' && expenseDate.getDate() >= card.closingDay) {
                    faturaMonth += 1;
                    if (faturaMonth > 12) { faturaMonth = 1; faturaYear += 1; }
                }
            }
            
            if (faturaYear === filterYear && faturaMonth === filterMonth &&
                (!selectedCardFilter || expense.cardId === selectedCardFilter) &&
                (!selectedClientFilter || !expense.clientId)) { // Despesas avulsas não têm cliente
                allItems.push({ ...expense, type: 'Despesa', dueDate: expense.date, currentStatus: 'Pendente' });
            }
        });

        allItems.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        
        const loansForChart = allItems.filter(item => item.type === 'Parcela');
        const expensesForChart = allItems.filter(item => item.type === 'Despesa');
        const subscriptionsForChart = allItems.filter(item => item.type === 'Assinatura');

        return { 
            filteredItemsForTable: allItems, 
            filteredLoansForChart: loansForChart, 
            filteredExpensesForChart: expensesForChart,
            filteredSubscriptionsForChart: subscriptionsForChart
        };
    }, [loans, clients, cards, subscriptions, expenses, selectedMonth, selectedCardFilter, selectedClientFilter, isAuthReady]);

    useEffect(() => {
        setDisplayableItems(filteredItemsForTable);
        const newTotalFatura = filteredItemsForTable.reduce((sum, item) => sum + item.value, 0);
        const newTotalReceived = filteredItemsForTable.filter(item => item.type === 'Parcela' && item.currentStatus === 'Paga').reduce((sum, item) => sum + item.value, 0);
        const newTotalSubscriptions = filteredItemsForTable.filter(item => item.type === 'Assinatura').reduce((sum, item) => sum + item.value, 0);
        setDashboardSummary({ totalFatura: newTotalFatura, totalReceived: newTotalReceived, totalBalanceDue: newTotalFatura - newTotalReceived, totalSubscriptions: newTotalSubscriptions });
    }, [filteredItemsForTable]);

    const getCardDisplayInfo = (cardId) => {
        const card = cards.find(c => c.id === cardId);
        return card ? { name: card.name, color: card.color || '#cccccc' } : { name: 'N/A', color: '#cccccc' };
    };

    const confirmMarkAllPaid = () => setIsMarkAllPaidConfirmationOpen(true);
    const handleMarkAllInstallmentsAsPaid = async () => { /* ... */ };
    const paidPercentage = dashboardSummary.totalFatura > 0 ? (dashboardSummary.totalReceived / dashboardSummary.totalFatura) * 100 : 0;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md dark:shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Resumo Financeiro</h2>
            
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3">
                    <ProSummary selectedMonth={selectedMonth} totalExpenses={dashboardSummary.totalFatura} />
                </div>
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-bold mb-4">Despesas da Fatura</h3>
                        <div className="mb-2">
                            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatCurrencyDisplay(dashboardSummary.totalFatura)}</span>
                            <span className="text-gray-500 dark:text-gray-400 ml-2">Total do Mês</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-2">
                            <div className="bg-green-500 h-4 rounded-full" style={{ width: `${paidPercentage}%` }}></div>
                        </div>
                        <div className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-300">
                            <span>Pago: {formatCurrencyDisplay(dashboardSummary.totalReceived)}</span>
                            <span>Restante: {formatCurrencyDisplay(dashboardSummary.totalBalanceDue)}</span>
                        </div>
                    </div>
                    <div className="analytics-section">
                        <ProAnalyticsCharts 
                            loans={filteredLoansForChart} 
                            clients={clients} 
                            expenses={filteredExpensesForChart}
                            subscriptions={filteredSubscriptionsForChart}
                            theme={theme} 
                        />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-bold mb-4">Próximos Vencimentos</h3>
                        <ul className="space-y-3">
                            {displayableItems.filter(item => item.type === 'Parcela' && item.currentStatus !== 'Paga').slice(0, 5).map(item => (
                                <li key={item.id} className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-gray-700 dark:text-gray-200">{item.description}</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{formatCurrencyDisplay(item.value)}</span>
                                </li>
                            ))}
                            {displayableItems.filter(item => item.type === 'Parcela' && item.currentStatus !== 'Paga').length === 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma parcela pendente para este mês.</p>
                            )}
                        </ul>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-bold mb-4">Assinaturas do Mês</h3>
                        <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{formatCurrencyDisplay(dashboardSummary.totalSubscriptions)}</p>
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Itens da Fatura (Mês Filtrado)</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Tipo</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Descrição</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Pessoa</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Cartão</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Valor</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Data</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Status</th>
                                <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {displayableItems.map((item) => {
                                const cardInfo = getCardDisplayInfo(item.cardId);
                                const clientName = clients.find(c => c.id === item.clientId)?.name || 'N/A';
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="py-3 px-4">{item.type}</td>
                                        <td className="py-3 px-4">{item.description}</td>
                                        <td className="py-3 px-4">{item.clientId ? clientName : '---'}</td>
                                        <td className="py-3 px-4 flex items-center">
                                            <span className="w-4 h-4 rounded-sm mr-2" style={{ backgroundColor: cardInfo.color }}></span>{cardInfo.name}
                                        </td>
                                        <td className="py-3 px-4">{formatCurrencyDisplay(item.value)}</td>
                                        <td className="py-3 px-4">{new Date(item.dueDate + "T00:00:00").toLocaleDateString('pt-BR')}</td>
                                        <td className={`py-3 px-4 font-semibold ${item.currentStatus === 'Paga' ? 'text-green-500' : item.currentStatus === 'Atrasado' ? 'text-red-500' : 'text-yellow-500'}`}>{item.currentStatus}</td>
                                        <td className="py-3 px-4">
                                            {item.type === 'Parcela' && item.currentStatus !== 'Paga' && (
                                                <button onClick={() => handleMarkInstallmentAsPaidDashboard(item.loanId, item.personKey, item.number)} className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 text-sm">Marcar Paga</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <GenericModal isOpen={isMarkAllPaidConfirmationOpen} onClose={() => setIsMarkAllPaidConfirmationOpen(false)} onConfirm={handleMarkAllInstallmentsAsPaid} title="Confirmar Ação" message={`Tem a certeza de que deseja marcar TODAS as parcelas pendentes ou atrasadas como PAGAS?`} isConfirmation={true} theme={theme} />
        </div>
    );
}

export default Dashboard;