import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';

// Importando o contexto e as funções de utilidade dos novos arquivos
import { AppContext } from '../../context/AppContext'; // Ajuste o caminho se necessário
import { formatCurrencyDisplay } from '../../utils/currency'; // Ajuste o caminho se necessário
import { copyTextToClipboardFallback } from '../../utils/helpers'; // Ajuste o caminho se necessário
import GenericModal from '../../components/GenericModal'; // Ajuste o caminho se necessário


// Componente para gerenciar clientes
function ClientManagement() {
    const { db, userId, isAuthReady, getUserCollectionPathSegments, theme, showToast } = useContext(AppContext);
    const [clients, setClients] = useState([]);
    const [clientName, setClientName] = useState('');
    const [editingClient, setEditingClient] = useState(null);

    const [currentReportingClient, setCurrentReportingClient] = useState(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    
    // ESTADO DO RELATÓRIO ATUALIZADO (sai reportText, entra reportData)
    const [reportData, setReportData] = useState(null);
    
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState(null);
    const [allCards, setAllCards] = useState([]); // Usado para obter nomes de cartões no relatório

    // Efeito para carregar clientes e cartões (inalterado)
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();

        const clientsColRef = collection(db, ...userCollectionPath, userId, 'clients');
        const unsubscribeClients = onSnapshot(clientsColRef, (snapshot) => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar pessoas:", error));

        const cardsColRef = collection(db, ...userCollectionPath, userId, 'cards');
        const unsubscribeCards = onSnapshot(cardsColRef, (snapshot) => {
            setAllCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar cartões:", error));

        return () => {
            unsubscribeClients();
            unsubscribeCards();
        };
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    const handleSubmit = async (e) => {
        e.preventDefault();
    
        // 1. Validação (Guard Clause)
        const trimmedName = clientName.trim();
        if (!trimmedName) {
            showToast('O nome da pessoa não pode ser vazio.', 'warning');
            return;
        }
    
        // 2. Preparação dos dados e referências
        const userCollectionPath = getUserCollectionPathSegments();
        const clientsCollectionRef = collection(db, ...userCollectionPath, userId, 'clients');
        
        try {
            if (editingClient) {
                // Lógica de ATUALIZAÇÃO
                const clientDocRef = doc(clientsCollectionRef, editingClient.id);
                await updateDoc(clientDocRef, { name: trimmedName });
                showToast("Pessoa atualizada com sucesso!", "success");
            } else {
                // Lógica de CRIAÇÃO
                await addDoc(clientsCollectionRef, {
                    name: trimmedName,
                    createdAt: new Date(),
                });
                showToast("Pessoa adicionada com sucesso!", "success");
            }
    
            // 3. Limpeza do formulário (executa apenas em caso de sucesso)
            setClientName('');
            setEditingClient(null);
    
        } catch (error) {
            console.error("Erro ao salvar pessoa:", error);
            showToast(`Erro ao salvar pessoa: ${error.message}`, "error");
        }
    };

    const confirmDeleteClient = async (clientId) => {
        // ... (lógica de confirmação de exclusão inalterada)
        const loansRef = collection(db, ...getUserCollectionPathSegments(), userId, 'loans');
        const qNormalLoans = query(loansRef, where("clientId", "==", clientId), where("isShared", "==", false));
        const qSharedLoansP1 = query(loansRef, where("sharedDetails.person1.clientId", "==", clientId), where("isShared", "==", true));
        const qSharedLoansP2 = query(loansRef, where("sharedDetails.person2.clientId", "==", clientId), where("isShared", "==", true));
        const subscriptionsRef = collection(db, ...getUserCollectionPathSegments(), userId, 'subscriptions');
        const qSubscriptions = query(subscriptionsRef, where("clientId", "==", clientId));
        const [normalSnapshot, sharedP1Snapshot, sharedP2Snapshot, subsSnapshot] = await Promise.all([
            getDocs(qNormalLoans), getDocs(qSharedLoansP1), getDocs(qSharedLoansP2), getDocs(qSubscriptions)
        ]);
        setClientToDelete(clientId);
        setIsConfirmationModalOpen(true);
    };

    const handleDeleteClientConfirmed = async () => {
        if (!clientToDelete) return;
        const userCollectionPath = getUserCollectionPathSegments();
        try {
            await deleteDoc(doc(db, ...userCollectionPath, userId, 'clients', clientToDelete));
            showToast("Pessoa deletada com sucesso!", "success");
            setClientToDelete(null);
        } catch (error) {
            console.error("Erro ao deletar pessoa:", error);
            showToast(`Erro ao deletar pessoa: ${error.message}`, "error");
        } finally {
            setIsConfirmationModalOpen(false);
        }
    };

    const handleEdit = (client) => {
        setEditingClient(client);
        setClientName(client.name);
    };
    
    // Função de exportar PDF original (inalterada)
    const exportReportAsPDF = (text, clientName) => {
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            showToast("Erro: A biblioteca para gerar PDF (jsPDF) não está carregada.", "error");
            return;
        }
        const { jsPDF } = window.jspdf;
        const docPDF = new jsPDF();
        docPDF.setProperties({
            title: `Relatório Financeiro - ${clientName}`,
            subject: `Detalhes financeiros para ${clientName}`,
            author: 'Controle Financeiro de Cartões',
        });
        docPDF.setFont('helvetica', 'normal');
        docPDF.setFontSize(10);
        const lines = docPDF.splitTextToSize(text, 180);
        docPDF.text(lines, 15, 15);
        docPDF.save(`Relatorio_Financeiro_${clientName.replace(/\s+/g, '_')}.pdf`);
    };

    // FUNÇÃO DE GERAR RELATÓRIO ATUALIZADA PARA INCLUIR DETALHES DA PARCELA ATUAL
const generateClientFinancialReport = async (client) => {
    setCurrentReportingClient(client);
    setIsGeneratingReport(true);
    setReportData(null);
    const userCollectionPath = getUserCollectionPathSegments();

    // ... (a coleta de dados inicial continua a mesma) ...
    const loansRef = collection(db, ...userCollectionPath, userId, 'loans');
    const qNormalLoans = query(loansRef, where("clientId", "==", client.id), where("isShared", "==", false));
    const qSharedLoansP1 = query(loansRef, where("sharedDetails.person1.clientId", "==", client.id), where("isShared", "==", true));
    const qSharedLoansP2 = query(loansRef, where("sharedDetails.person2.clientId", "==", client.id), where("isShared", "==", true));
    const subsRef = collection(db, ...userCollectionPath, userId, 'subscriptions');
    const qSubs = query(subsRef, where("clientId", "==", client.id), where("status", "==", "Ativa"));
    const [normalSnapshot, sharedP1Snapshot, sharedP2Snapshot, subsSnapshot] = await Promise.all([
        getDocs(qNormalLoans), getDocs(qSharedLoansP1), getDocs(qSharedLoansP2), getDocs(qSubs)
    ]);

    const clientLoansData = [];
    normalSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        clientLoansData.push({ ...data, id: docSnap.id, isSharedPart: false, shareAmount: data.totalValue, balanceDue: data.balanceDueClient, installments: typeof data.installments === 'string' ? JSON.parse(data.installments) : (data.installments || []) });
    });
    sharedP1Snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        clientLoansData.push({ ...data, id: docSnap.id + "-p1", isSharedPart: true, shareAmount: data.sharedDetails.person1.shareAmount, balanceDue: data.sharedDetails.person1.balanceDue, installments: typeof data.sharedDetails.person1.installments === 'string' ? JSON.parse(data.sharedDetails.person1.installments) : (data.sharedDetails.person1.installments || []) });
    });
    sharedP2Snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        clientLoansData.push({ ...data, id: docSnap.id + "-p2", isSharedPart: true, shareAmount: data.sharedDetails.person2.shareAmount, balanceDue: data.sharedDetails.person2.balanceDue, installments: typeof data.sharedDetails.person2.installments === 'string' ? JSON.parse(data.sharedDetails.person2.installments) : (data.sharedDetails.person2.installments || []) });
    });

    const clientSubscriptions = subsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

    // ✨ NOVA LÓGICA PARA PROCESSAR AS COMPRAS E ENCONTRAR A PARCELA ATUAL ✨
    const purchasesWithDetails = clientLoansData
        .filter(loan => loan.balanceDue > 0) // Filtra apenas as que ainda têm saldo devedor
        .map(loan => {
            const pendingInstallments = loan.installments.filter(inst => inst.status === 'Pendente');
            const currentInstallment = pendingInstallments.length > 0 ? pendingInstallments[0] : null;

            return {
                ...loan,
                remainingInstallmentsCount: pendingInstallments.length,
                currentInstallmentInfo: currentInstallment // Adiciona o objeto da parcela atual
            };
        });

    const totalDueFromPurchases = purchasesWithDetails.reduce((sum, loan) => sum + (loan.balanceDue || 0), 0);
    const totalMonthlySubscriptions = clientSubscriptions.reduce((sum, sub) => sum + sub.value, 0);

    // ... (cálculo de parcelas futuras continua o mesmo) ...
    const futureInstallments = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    clientLoansData.forEach(loan => {
        if (loan.installments && Array.isArray(loan.installments)) {
            loan.installments.forEach(inst => {
                const dueDate = new Date(inst.dueDate + "T00:00:00");
                if (inst.status === 'Pendente' && dueDate >= today) {
                    const monthKey = dueDate.toISOString().slice(0, 7);
                    if (!futureInstallments[monthKey]) {
                        futureInstallments[monthKey] = 0;
                    }
                    futureInstallments[monthKey] += inst.value;
                }
            });
        }
    });
    const upcomingInstallments = Object.keys(futureInstallments).sort().map(monthKey => ({ month: monthKey, total: futureInstallments[monthKey] }));

    setReportData({
        clientName: client.name,
        generationDate: new Date(),
        summary: { totalDueFromPurchases, totalMonthlySubscriptions },
        purchases: purchasesWithDetails, // Usa a nova lista com detalhes
        subscriptions: clientSubscriptions,
        upcomingInstallments
    });

    setIsGeneratingReport(false);
    setIsReportModalOpen(true);
};

    // =========================================================================
    // FUNÇÕES DE EXPORTAÇÃO ADICIONADAS AQUI
    // =========================================================================
    /**
 * Gera uma string de texto formatada a partir do objeto de dados do relatório.
 * @param {object} data - O objeto reportData do estado.
 * @returns {string} O relatório completo como uma string de texto.
 */
// FUNÇÃO DE GERAR TEXTO ATUALIZADA
const generateTextReport = (data) => {
    if (!data) return "Erro: Dados do relatório não encontrados.";

    let text = `RELATÓRIO FINANCEIRO - ${data.clientName.toUpperCase()}\n`;
    text += `Gerado em: ${data.generationDate.toLocaleString('pt-BR')}\n`;
    text += "================================================\n\n";

    text += "--- RESUMO GERAL ---\n";
    text += `> Saldo Devedor (Compras): ${formatCurrencyDisplay(data.summary.totalDueFromPurchases)}\n`;
    text += `> Compromisso Mensal (Assinaturas): ${formatCurrencyDisplay(data.summary.totalMonthlySubscriptions)}\n\n`;
    
    if (data.upcomingInstallments.length > 0) {
        text += "--- PRÓXIMAS PARCELAS A VENCER ---\n";
        data.upcomingInstallments.forEach(item => {
            const monthName = new Date(item.month + '-02').toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            text += `> ${monthName}: ${formatCurrencyDisplay(item.total)}\n`;
        });
        text += "\n";
    }

    text += "--- COMPRAS EM ABERTO ---\n";
    if (data.purchases.length > 0) {
        data.purchases.forEach(loan => {
            text += `> ${loan.description || 'Compra sem descrição'}\n`;
            
            // LÓGICA ATUALIZADA AQUI
            if (loan.currentInstallmentInfo) {
                const { number, value } = loan.currentInstallmentInfo;
                text += `  - Próxima Parcela: ${number}/${loan.installmentsCount} no valor de ${formatCurrencyDisplay(value)}\n`;
            }
            text += `  - Saldo devedor total: ${formatCurrencyDisplay(loan.balanceDue)}\n\n`;
        });
    } else {
        text += "Nenhuma compra com saldo devedor.\n\n";
    }

    text += "--- ASSINATURAS ATIVAS ---\n";
    if (data.subscriptions.length > 0) {
        data.subscriptions.forEach(sub => {
            text += `> ${sub.name}: ${formatCurrencyDisplay(sub.value)}/mês\n`;
        });
    } else {
        text += "Nenhuma assinatura ativa encontrada.\n";
    }

    return text;

    };
    const handleCopyText = () => {
        const textToCopy = generateTextReport(reportData);
        if (copyTextToClipboardFallback(textToCopy)) {
            showToast('Relatório copiado para a área de transferência!', 'success');
        } else {
            showToast('Falha ao copiar o relatório.', 'error');
        }
    };
    const handleExportPDF = () => {
        const textContent = generateTextReport(reportData);
        exportReportAsPDF(textContent, reportData.clientName);
    };
    const handleExportTXT = () => {
        const textContent = generateTextReport(reportData);
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Relatorio_${reportData.clientName.replace(/\s+/g, '_')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Download do arquivo .txt iniciado!', 'success');
    };
    const handleShareWhatsApp = () => {
        const textContent = generateTextReport(reportData);
        const encodedText = encodeURIComponent(textContent);
        const whatsappUrl = `https://wa.me/?text=${encodedText}`;
        window.open(whatsappUrl, '_blank');
    };
    const handleShareEmail = () => {
        const textContent = generateTextReport(reportData);
        const subject = `Relatório Financeiro - ${reportData.clientName}`;
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(textContent);
        const mailtoLink = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
        window.location.href = mailtoLink;
    };


    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md dark:shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Gerenciar Pessoas</h2>
            <form onSubmit={handleSubmit} className="mb-6 flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    placeholder="Nome da Pessoa"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="flex-grow p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                />
                <button
                    type="submit"
                    className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md dark:bg-blue-700 dark:hover:bg-blue-800"
                >
                    {editingClient ? 'Atualizar Pessoa' : 'Adicionar Pessoa'}
                </button>
                {editingClient && (
                    <button
                        type="button"
                        onClick={() => { setEditingClient(null); setClientName(''); }}
                        className="bg-gray-400 text-white py-3 px-6 rounded-lg hover:bg-gray-500 transition duration-300 shadow-md dark:bg-gray-600 dark:hover:bg-gray-700"
                    >
                        Cancelar Edição
                    </button>
                )}
            </form>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider rounded-tl-lg">Nome</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider rounded-tr-lg">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {clients.length === 0 ? (
                            <tr>
                                <td colSpan="2" className="py-4 px-4 text-center text-gray-500 dark:text-gray-400">Nenhuma pessoa cadastrada.</td>
                            </tr>
                        ) : (
                            clients.map((client) => (
                                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{client.name}</td>
                                    <td className="py-3 px-4 whitespace-nowrap flex items-center gap-2 flex-wrap">
                                        <button onClick={() => handleEdit(client)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Editar</button>
                                        <button onClick={() => confirmDeleteClient(client.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Deletar</button>
                                        <button onClick={() => generateClientFinancialReport(client)} className="bg-teal-500 text-white px-3 py-1 rounded-md hover:bg-teal-600 transition duration-300 text-xs flex items-center justify-center dark:bg-teal-700 dark:hover:bg-teal-800" disabled={isGeneratingReport}>
                                            {isGeneratingReport && currentReportingClient?.id === client.id ? 'Gerando...' : '📊 Relatório'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL DO RELATÓRIO COMPLETAMENTE ATUALIZADO */}
            {isReportModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        {isGeneratingReport ? (
                            <div className="flex justify-center items-center h-64">
                                <svg className="animate-spin h-8 w-8 text-teal-500 dark:text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="ml-3 text-gray-600 dark:text-gray-300">Gerando relatório...</span>
                            </div>
                        ) : reportData && (
                            <>
                                <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Relatório Financeiro</h3>
                                        <p className="text-lg text-teal-600 dark:text-teal-400">{reportData.clientName}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Gerado em: {reportData.generationDate.toLocaleString('pt-BR')}</p>
                                    </div>
                                    <button onClick={() => setIsReportModalOpen(false)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                                       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                    </button>
                                </div>
                                <div className="overflow-y-auto flex-grow pr-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <div className="bg-red-50 dark:bg-red-900/50 p-4 rounded-lg border border-red-200 dark:border-red-800">
                                            <h4 className="text-md font-semibold text-red-700 dark:text-red-300">Saldo Devedor (Compras)</h4>
                                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrencyDisplay(reportData.summary.totalDueFromPurchases)}</p>
                                        </div>
                                        <div className="bg-purple-50 dark:bg-purple-900/50 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                                            <h4 className="text-md font-semibold text-purple-700 dark:text-purple-300">Compromisso Mensal (Assinaturas)</h4>
                                            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrencyDisplay(reportData.summary.totalMonthlySubscriptions)}</p>
                                        </div>
                                    </div>
                                    {reportData.upcomingInstallments.length > 0 && (
                                        <div className="mb-6">
                                            <h4 className="text-xl font-semibold mb-2 text-gray-700 dark:text-gray-300">📊 Próximas Parcelas a Vencer</h4>
                                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg space-y-2">
                                                {reportData.upcomingInstallments.map(item => (
                                                    <div key={item.month} className="flex justify-between items-center text-gray-800 dark:text-gray-200">
                                                        <span>{new Date(item.month + '-02').toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}:</span>
                                                        <span className="font-bold text-lg">{formatCurrencyDisplay(item.total)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="mb-6">
                                        <h4 className="text-xl font-semibold mb-2 text-gray-700 dark:text-gray-300">🛒 Compras em Aberto</h4>
                                            <div className="space-y-3">
                                                {reportData.purchases.length > 0 ? reportData.purchases.map(loan => (
                                                    <div key={loan.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                                                        <p className="font-semibold text-gray-800 dark:text-gray-100">{loan.description || 'Compra sem descrição'}</p>
                                                        
                                                        {/* LÓGICA DE EXIBIÇÃO ATUALIZADA */}
                                                        {loan.currentInstallmentInfo && (
                                                            <div className="mt-2 p-2 bg-teal-50 dark:bg-teal-900/50 rounded-md border border-teal-200 dark:border-teal-800">
                                                                <div className="flex justify-between items-center text-teal-800 dark:text-teal-200">
                                                                    <span className="text-sm font-medium">Próxima Parcela ({loan.currentInstallmentInfo.number}/{loan.installmentsCount})</span>
                                                                    <span className="text-lg font-bold">{formatCurrencyDisplay(loan.currentInstallmentInfo.value)}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex justify-between">
                                                            <span>Saldo devedor total:</span>
                                                            <span className="font-semibold">{formatCurrencyDisplay(loan.balanceDue)}</span>
                                                        </div>
                                                    </div>
                                                )) : <p className="text-gray-500 dark:text-gray-400 italic">Nenhuma compra com saldo devedor.</p>}
                                            </div>
                                        </div>
                                    <div>
                                        <h4 className="text-xl font-semibold mb-2 text-gray-700 dark:text-gray-300">🔁 Assinaturas Ativas</h4>
                                         <div className="space-y-3">
                                            {reportData.subscriptions.length > 0 ? reportData.subscriptions.map(sub => (
                                                 <div key={sub.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                                                    <div className="flex justify-between items-center">
                                                        <p className="font-semibold text-gray-800 dark:text-gray-100">{sub.name}</p>
                                                        <p className="font-bold text-gray-800 dark:text-gray-200">{formatCurrencyDisplay(sub.value)}<span className="font-normal text-sm">/mês</span></p>
                                                    </div>
                                                </div>
                                            )) : <p className="text-gray-500 dark:text-gray-400 italic">Nenhuma assinatura ativa encontrada.</p>}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-end gap-3">
                                    <button onClick={handleCopyText} className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition duration-300">Copiar Texto</button>
                                    <button onClick={handleExportTXT} className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition duration-300">Baixar .TXT</button>
                                    <button onClick={handleExportPDF} className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition duration-300">Exportar PDF</button>
                                    <button onClick={handleShareEmail} className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-lg transition duration-300">Enviar por Email</button>
                                    <button onClick={handleShareWhatsApp} className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition duration-300">Compartilhar no WhatsApp</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            
            <GenericModal
                isOpen={isConfirmationModalOpen}
                onClose={() => setIsConfirmationModalOpen(false)}
                onConfirm={handleDeleteClientConfirmed}
                title="Confirmar Exclusão"
                message={clientToDelete ?
                    `Tem certeza que deseja deletar a pessoa "${clients.find(c => c.id === clientToDelete)?.name}"?` +
                    `\n\nAVISO: As compras e assinaturas associadas a esta pessoa NÃO serão deletadas.`
                    : ''}
                isConfirmation={true}
                theme={theme}
            />
        </div>
    );
}
export default ClientManagement;