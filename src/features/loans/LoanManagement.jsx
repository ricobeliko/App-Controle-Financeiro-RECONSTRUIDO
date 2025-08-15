// src/features/loans/LoanManagement.jsx

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

// IMPORTANDO O NECESSÁRIO
import { AppContext } from '../../context/AppContext';
import { formatCurrencyDisplay, parseCurrencyInput, handleCurrencyInputChange } from '../../utils/currency';
import GenericModal from '../../components/GenericModal';

function LoanManagement() {
    const { db, userId, isAuthReady, getUserCollectionPathSegments, theme, showToast } = useContext(AppContext);
    const [loans, setLoans] = useState([]); // Armazena os documentos originais do Firestore
    const [displayableLoans, setDisplayableLoans] = useState([]); // Armazena os empréstimos transformados para exibição (antes de ordenar)
    const [clients, setClients] = useState([]);
    const [cards, setCards] = useState([]);
    const [showInstallments, setShowInstallments] = useState({});
    const [purchaseType, setPurchaseType] = useState('normal'); // 'normal' ou 'shared'

    // Estado para compra normal
    const [selectedClient, setSelectedClient] = useState('');
    // Estado para compra compartilhada
    const [selectedClient1, setSelectedClient1] = useState('');
    const [selectedClient2, setSelectedClient2] = useState('');
    const [person1ShareInput, setPerson1ShareInput] = useState('');
    const [person2ShareDisplay, setPerson2ShareDisplay] = useState('R$ 0,00');

    const [selectedCard, setSelectedCard] = useState('');
    const [loanDate, setLoanDate] = useState('');
    const [description, setDescription] = useState('');
    const [totalValueInput, setTotalValueInput] = useState('');
    const [installmentsCount, setInstallmentsCount] = useState('');
    const [firstDueDate, setFirstDueDate] = useState('');
    const [editingLoan, setEditingLoan] = useState(null);

    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [loanToDelete, setLoanToDelete] = useState(null);

    const [sortConfig, setSortConfig] = useState({ key: 'loanDate', direction: 'descending' });

    const getClientName = (clientId) => clients.find(c => c.id === clientId)?.name || 'N/A';
    const getCardInfo = (cardId) => {
        const card = cards.find(c => c.id === cardId);
        return card ? { name: card.name, color: card.color || '#cccccc' } : { name: 'Cartão Desconhecido', color: '#cccccc' };
    };

    useEffect(() => {
        if (purchaseType === 'shared') {
            const totalVal = parseCurrencyInput(totalValueInput);
            const person1Val = parseCurrencyInput(person1ShareInput);
            if (totalVal > 0 && person1Val >= 0 && person1Val <= totalVal) {
                setPerson2ShareDisplay(formatCurrencyDisplay(totalVal - person1Val));
            } else if (totalVal > 0 && person1Val > totalVal) {
                setPerson1ShareInput(formatCurrencyDisplay(totalVal).replace('R$ ', ''));
                setPerson2ShareDisplay(formatCurrencyDisplay(0));
            } else {
                setPerson2ShareDisplay('R$ 0,00');
            }
        }
    }, [totalValueInput, person1ShareInput, purchaseType]);

    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();
        const clientsColRef = collection(db, ...userCollectionPath, userId, 'clients');
        const cardsColRef = collection(db, ...userCollectionPath, userId, 'cards');

        const unsubscribeClients = onSnapshot(clientsColRef, (snapshot) => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar pessoas para empréstimos:", error));

        const unsubscribeCards = onSnapshot(cardsColRef, (snapshot) => {
            setCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro ao carregar cartões para empréstimos:", error));
        
        return () => {
            unsubscribeClients();
            unsubscribeCards();
        };
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const userCollectionPath = getUserCollectionPathSegments();
        const loansColRef = collection(db, ...userCollectionPath, userId, 'loans');
        
        const q = query(loansColRef, orderBy("loanDate", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedLoans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLoans(fetchedLoans);

            const transformedForDisplay = fetchedLoans.flatMap(loan => {
                if (loan.isShared && loan.sharedDetails) {
                    const p1Installments = Array.isArray(loan.sharedDetails.person1.installments) ? loan.sharedDetails.person1.installments : [];
                    const p2Installments = Array.isArray(loan.sharedDetails.person2.installments) ? loan.sharedDetails.person2.installments : [];
                    
                    const getInstallmentProgressDisplay = (installmentsArray, totalCount) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        let currentInstallmentNumber = 0;
                        let foundNextPendingOrOverdue = false; 
                        
                        for (let i = 0; i < installmentsArray.length; i++) {
                            const inst = installmentsArray[i];
                            if (inst.status === 'Pendente') {
                                const dueDate = new Date(inst.dueDate + "T00:00:00");
                                dueDate.setHours(0, 0, 0, 0);
                                
                                if (dueDate >= today) {
                                    currentInstallmentNumber = inst.number;
                                    foundNextPendingOrOverdue = true;
                                    break;
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

                    const parts = [];
                    if (loan.sharedDetails.person1 && loan.sharedDetails.person1.clientId) {
                        parts.push({
                            displayId: `${loan.id}-p1`, originalLoanId: loan.id, personKey: 'person1', isSharedPart: true,
                            clientId: loan.sharedDetails.person1.clientId, cardId: loan.cardId, description: loan.description,
                            totalValue: loan.sharedDetails.person1.shareAmount, installmentsCount: loan.installmentsCount,
                            totalToPayClient: loan.sharedDetails.person1.shareAmount, valuePaidClient: loan.sharedDetails.person1.valuePaid,
                            statusPaymentClient: loan.sharedDetails.person1.statusPayment, installments: p1Installments,
                            firstDueDate: loan.firstDueDate, loanDate: loan.loanDate, originalSharedPurchaseTotalValue: loan.totalItemValue,
                            createdAt: loan.createdAt,
                            installmentsProgress: getInstallmentProgressDisplay(p1Installments, loan.installmentsCount)
                        });
                    }
                    if (loan.sharedDetails.person2 && loan.sharedDetails.person2.clientId && loan.sharedDetails.person2.shareAmount > 0) {
                        parts.push({
                            displayId: `${loan.id}-p2`, originalLoanId: loan.id, personKey: 'person2', isSharedPart: true,
                            clientId: loan.sharedDetails.person2.clientId, cardId: loan.cardId, description: loan.description,
                            totalValue: loan.sharedDetails.person2.shareAmount, installmentsCount: loan.installmentsCount,
                            totalToPayClient: loan.sharedDetails.person2.shareAmount, valuePaidClient: loan.sharedDetails.person2.valuePaid,
                            statusPaymentClient: loan.sharedDetails.person2.statusPayment, installments: p2Installments,
                            firstDueDate: loan.firstDueDate, loanDate: loan.loanDate, originalSharedPurchaseTotalValue: loan.totalItemValue,
                            createdAt: loan.createdAt,
                            installmentsProgress: getInstallmentProgressDisplay(p2Installments, loan.installmentsCount)
                        });
                    }
                    return parts;
                } else {
                    const normalInstallmentsParsed = Array.isArray(loan.installments) ? loan.installments : [];
                    
                    const getInstallmentProgressDisplay = (installmentsArray, totalCount) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        let currentInstallmentNumber = 0;
                        let foundNextPendingOrOverdue = false; 

                        for (let i = 0; i < installmentsArray.length; i++) {
                            const inst = installmentsArray[i];
                            if (inst.status === 'Pendente') {
                                const dueDate = new Date(inst.dueDate + "T00:00:00");
                                dueDate.setHours(0, 0, 0, 0);
                                
                                if (dueDate >= today) {
                                    currentInstallmentNumber = inst.number;
                                    foundNextPendingOrOverdue = true;
                                    break;
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

                    return {
                        ...loan, displayId: loan.id, originalLoanId: loan.id, personKey: null, isSharedPart: false,
                        installments: normalInstallmentsParsed, totalToPayClient: loan.totalValue,
                        valuePaidClient: loan.valuePaidClient || 0, statusPaymentClient: loan.statusPaymentClient || 'Pendente',
                        firstDueDate: loan.firstDueDateClient,
                        installmentsProgress: getInstallmentProgressDisplay(normalInstallmentsParsed, loan.installmentsCount)
                    };
                }
            });
            setDisplayableLoans(transformedForDisplay);
        }, (error) => console.error("Erro ao carregar compras:", error));

        return () => unsubscribe();
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    useEffect(() => {
        if (selectedCard && cards.length > 0 && loanDate && !editingLoan) {
            const card = cards.find(c => c.id === selectedCard);
            if (card) {
                const purchaseDate = new Date(loanDate + "T00:00:00");
                const closingDay = card.closingDay;
                const dueDay = card.dueDay;
                let closingDate = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), closingDay);
                if (purchaseDate.getDate() >= closingDay) {
                    closingDate.setMonth(closingDate.getMonth() + 1);
                }
                let firstDueDt = new Date(closingDate.getFullYear(), closingDate.getMonth(), dueDay);
                if (dueDay < closingDay) {
                    firstDueDt.setMonth(firstDueDt.getMonth() + 1);
                }
                const year = firstDueDt.getFullYear();
                const month = (firstDueDt.getMonth() + 1).toString().padStart(2, '0');
                const day = firstDueDt.getDate().toString().padStart(2, '0');
                const formattedDate = `${year}-${month}-${day}`;
                setFirstDueDate(formattedDate);
            }
        } else if (!selectedCard || !loanDate || editingLoan) {
            if (!editingLoan) setFirstDueDate('');
        }
    }, [selectedCard, cards, loanDate, editingLoan]);

    const sortedDisplayableLoans = React.useMemo(() => {
        let sortableItems = [...displayableLoans];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;

                switch (sortConfig.key) {
                    case 'pessoa':
                        aValue = getClientName(a.clientId);
                        bValue = getClientName(b.clientId);
                        break;
                    case 'cartao':
                        aValue = getCardInfo(a.cardId).name;
                        bValue = getCardInfo(b.cardId).name;
                        break;
                    case 'totalValue': 
                        aValue = a.totalToPayClient;
                        bValue = b.totalToPayClient;
                        break;
                    case 'status':
                        aValue = a.statusPaymentClient;
                        bValue = b.statusPaymentClient;
                        break;
                    default: 
                        aValue = new Date(a.loanDate);
                        bValue = new Date(b.loanDate);
                        break;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [displayableLoans, sortConfig, clients, cards]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    const calculateInstallments = (personShareAmount, numInstallments, firstDueDtStr) => {
        const installments = [];
        if (numInstallments <= 0 || personShareAmount <= 0) return installments;

        const baseValuePerInstallment = parseFloat((personShareAmount / numInstallments).toFixed(2));

        let sumOfOtherInstallments = 0;
        if (numInstallments > 1) {
            for (let i = 1; i < numInstallments; i++) {
                sumOfOtherInstallments += baseValuePerInstallment;
            }
            sumOfOtherInstallments = parseFloat(sumOfOtherInstallments.toFixed(2));
        }
        
        const firstInstallmentValue = parseFloat((personShareAmount - sumOfOtherInstallments).toFixed(2));

        const [year, month, day] = firstDueDtStr.split('-').map(Number);
        let currentDueDate = new Date(Date.UTC(year, month - 1, day));

        for (let i = 0; i < numInstallments; i++) {
            installments.push({
                number: i + 1,
                value: (i === 0) ? firstInstallmentValue : baseValuePerInstallment,
                dueDate: currentDueDate.toISOString().split('T')[0],
                status: 'Pendente',
                paidDate: null,
            });
            currentDueDate.setUTCMonth(currentDueDate.getUTCMonth() + 1);
        }
        return installments;
    };

    const resetForm = () => {
        setSelectedClient('');
        setSelectedClient1('');
        setSelectedClient2('');
        setPerson1ShareInput('');
        setPerson2ShareDisplay('R$ 0,00');
        setSelectedCard('');
        setLoanDate('');
        setDescription('');
        setTotalValueInput('');
        setInstallmentsCount('');
        setFirstDueDate('');
        setEditingLoan(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const userCollectionPath = getUserCollectionPathSegments();
        const instCount = parseInt(installmentsCount);

        if (!selectedCard || !loanDate || !totalValueInput || !installmentsCount || !firstDueDate) {
            showToast("Preencha Cartão, Data da Compra, Valor Total, Nº Parcelas e 1º Vencimento.", "warning");
            return;
        }

        if (purchaseType === 'normal') {
            if (!selectedClient) {
                showToast("Compra Normal: Selecione a Pessoa.", "warning");
                return;
            }
            const totalLoanValue = parseCurrencyInput(totalValueInput);
            const loanInstallments = calculateInstallments(totalLoanValue, instCount, firstDueDate);
            const loanData = {
                clientId: selectedClient,
                cardId: selectedCard,
                loanDate: loanDate,
                description: description,
                totalValue: totalLoanValue,
                installmentsCount: instCount,
                firstDueDateClient: firstDueDate,
                statusPaymentClient: 'Pendente',
                valuePaidClient: 0,
                balanceDueClient: totalLoanValue,
                installments: loanInstallments,
                isShared: false,
                createdAt: new Date(),
                sharedDetails: null,
                totalItemValue: null,
            };
            try {
                if (editingLoan) {
                    if (editingLoan.hasOwnProperty('plan')) {
                        loanData.plan = editingLoan.plan;
                    }
                    await updateDoc(doc(db, ...userCollectionPath, userId, 'loans', editingLoan.id), loanData);
                    showToast("Compra normal atualizada com sucesso!", "success");
                } else {
                    await addDoc(collection(db, ...userCollectionPath, userId, 'loans'), loanData);
                    showToast("Compra normal adicionada com sucesso!", "success");
                }
                resetForm();
            } catch (error) {
                console.error("Erro ao salvar compra normal:", error);
                showToast(`Erro ao salvar compra normal: ${error.message}`, "error");
            }

        } else if (purchaseType === 'shared') {
            const totalItemVal = parseCurrencyInput(totalValueInput);
            const person1ShareVal = parseCurrencyInput(person1ShareInput);

            if (!selectedClient1 || !selectedClient2 || !person1ShareInput) {
                showToast("Compra Compartilhada: Selecione Pessoa 1, Pessoa 2 e informe o Valor da Pessoa 1.", "warning");
                return;
            }
            if (selectedClient1 === selectedClient2) {
                showToast("As Pessoa 1 e Pessoa 2 devem ser diferentes.", "warning");
                return;
            }
            if (person1ShareVal <= 0 || person1ShareVal > totalItemVal) {
                showToast("Valor da Pessoa 1 inválido ou excede o valor total do item.", "warning");
                return;
            }

            const person2ShareVal = totalItemVal - person1ShareVal;

            const installmentsP1 = calculateInstallments(person1ShareVal, instCount, firstDueDate);
            const installmentsP2 = (person2ShareVal > 0) ? calculateInstallments(person2ShareVal, instCount, firstDueDate) : [];

            const sharedPurchaseData = {
                cardId: selectedCard,
                loanDate: loanDate,
                description: description,
                totalItemValue: totalItemVal,
                installmentsCount: instCount,
                firstDueDate: firstDueDate,
                isShared: true,
                sharedDetails: {
                    person1: {
                        clientId: selectedClient1,
                        shareAmount: person1ShareVal,
                        installments: installmentsP1,
                        statusPayment: 'Pendente',
                        valuePaid: 0,
                        balanceDue: person1ShareVal
                    },
                    person2: {
                        clientId: selectedClient2,
                        shareAmount: person2ShareVal,
                        installments: installmentsP2,
                        statusPayment: person2ShareVal > 0 ? 'Pendente' : 'N/A',
                        valuePaid: 0,
                        balanceDue: person2ShareVal
                    }
                },
                createdAt: new Date(),
                clientId: null,
                totalValue: null,
                totalToPayClient: null,
                firstDueDateClient: null,
                statusPaymentClient: null,
                valuePaidClient: null,
                balanceDueClient: null,
                installments: null,
            };

            try {
                if (editingLoan) {
                     if (editingLoan.hasOwnProperty('plan')) {
                        sharedPurchaseData.plan = editingLoan.plan;
                    }
                    await updateDoc(doc(db, ...userCollectionPath, userId, 'loans', editingLoan.id), sharedPurchaseData);
                    showToast("Compra compartilhada atualizada com sucesso!", "success");
                } else {
                    await addDoc(collection(db, ...userCollectionPath, userId, 'loans'), sharedPurchaseData);
                    showToast("Compra compartilhada adicionada com sucesso!", "success");
                }
                resetForm();
            } catch (error) {
                console.error("Erro ao salvar compra compartilhada:", error);
                showToast(`Erro ao salvar compra compartilhada: ${error.message}`, "error");
            }
        }
    };

    const confirmDeleteLoan = (loanOrPartToDelete) => {
        setLoanToDelete(loanOrPartToDelete);
        setIsConfirmationModalOpen(true);
    };

    const handleDeleteLoanConfirmed = async () => {
        if (!loanToDelete) return;
        const actualLoanId = loanToDelete.isSharedPart ? loanToDelete.originalLoanId : loanToDelete.id;
        const loanDocRef = doc(db, ...getUserCollectionPathSegments(), userId, 'loans', actualLoanId);
        try {
            await deleteDoc(loanDocRef);
            showToast("Compra (ou compra compartilhada inteira) deletada com sucesso!", "success");
            setLoanToDelete(null);
        } catch (error) {
            console.error("Erro ao deletar compra:", error);
            showToast(`Erro ao deletar compra: ${error.message}`, "error");
        } finally {
            setIsConfirmationModalOpen(false);
        }
    };

    const handleEdit = (loanOrPartToEdit) => {
        const actualLoanId = loanOrPartToEdit.isSharedPart ? loanOrPartToEdit.originalLoanId : loanOrPartToEdit.id;
        const originalLoanDocument = loans.find(l => l.id === actualLoanId);

        if (!originalLoanDocument) {
            console.error("Documento original da compra não encontrado para edição.");
            showToast("Erro: Documento da compra não encontrado para edição.", "error");
            return;
        }
        setEditingLoan(originalLoanDocument);

        if (originalLoanDocument.isShared) {
            setPurchaseType('shared');
            setSelectedClient1(originalLoanDocument.sharedDetails.person1.clientId);
            setSelectedClient2(originalLoanDocument.sharedDetails.person2.clientId);
            setPerson1ShareInput(formatCurrencyDisplay(originalLoanDocument.sharedDetails.person1.shareAmount).replace('R$ ', ''));
            setTotalValueInput(formatCurrencyDisplay(originalLoanDocument.totalItemValue).replace('R$ ', ''));
        } else {
            setPurchaseType('normal');
            setSelectedClient(originalLoanDocument.clientId);
            setTotalValueInput(formatCurrencyDisplay(originalLoanDocument.totalValue).replace('R$ ', ''));
            setSelectedClient1('');
            setSelectedClient2('');
            setPerson1ShareInput('');
        }
        setSelectedCard(originalLoanDocument.cardId);
        setLoanDate(originalLoanDocument.loanDate);
        setDescription(originalLoanDocument.description);
        setInstallmentsCount(originalLoanDocument.installmentsCount.toString());
        setFirstDueDate(originalLoanDocument.isShared ? originalLoanDocument.firstDueDate : originalLoanDocument.firstDueDateClient);
    };

    const toggleInstallmentsVisibility = (displayId) => {
        setShowInstallments(prevState => ({
            ...prevState,
            [displayId]: !prevState[displayId]
        }));
    };

    // ✅✅✅ LÓGICA ANTIGA RESTAURADA ✅✅✅
    const handleUpdateInstallmentStatusLoan = async (originalLoanId, personKey, installmentNumber, newStatus) => {
        const loanToUpdate = loans.find(l => l.id === originalLoanId);
        if (!loanToUpdate) {
            console.error("Documento da compra original não encontrado para atualizar parcela.");
            showToast("Erro: Compra original não encontrada para atualizar parcela.", "error");
            return;
        }

        const userCollectionPath = getUserCollectionPathSegments();
        const loanDocRef = doc(db, ...userCollectionPath, userId, 'loans', originalLoanId);
        let updatedFields = {};

        try {
            if (loanToUpdate.hasOwnProperty('plan')) {
                updatedFields.plan = loanToUpdate.plan;
            }

            if (loanToUpdate.isShared && personKey) {
                const currentSharedDetails = JSON.parse(JSON.stringify(loanToUpdate.sharedDetails));
                const personData = currentSharedDetails[personKey];
                
                const personInstallments = Array.isArray(personData.installments) ? [...personData.installments] : [];

                const installmentIndex = personInstallments.findIndex(inst => inst.number === installmentNumber);
                if (installmentIndex === -1) {
                    throw new Error("Parcela não encontrada para atualização (compartilhada).");
                }

                personInstallments[installmentIndex] = {
                    ...personInstallments[installmentIndex],
                    status: newStatus,
                    paidDate: newStatus === 'Paga' ? new Date().toISOString().split('T')[0] : null,
                };

                const newValuePaidPerson = personInstallments
                    .filter(inst => inst.status === 'Paga')
                    .reduce((sum, inst) => sum + inst.value, 0);

                const newBalanceDuePerson = parseFloat((personData.shareAmount - newValuePaidPerson).toFixed(2));

                let newPersonStatus = 'Pendente';
                if (newBalanceDuePerson <= 0.005) { 
                    newPersonStatus = 'Pago Total';
                } else if (newValuePaidPerson > 0) {
                    newPersonStatus = 'Pago Parcial';
                }

                currentSharedDetails[personKey] = {
                    ...personData,
                    installments: personInstallments,
                    valuePaid: newValuePaidPerson,
                    balanceDue: newBalanceDuePerson,
                    statusPayment: newPersonStatus,
                };
                updatedFields.sharedDetails = currentSharedDetails;

            } else if (!loanToUpdate.isShared) {
                const normalInstallmentsParsed = Array.isArray(loanToUpdate.installments) ? [...loanToUpdate.installments] : [];

                const installmentIndex = normalInstallmentsParsed.findIndex(inst => inst.number === installmentNumber);
                if (installmentIndex === -1) {
                    throw new Error("Índice da parcela inválido para atualização (normal).");
                }

                normalInstallmentsParsed[installmentIndex] = {
                    ...normalInstallmentsParsed[installmentIndex],
                    status: newStatus,
                    paidDate: newStatus === 'Paga' ? new Date().toISOString().split('T')[0] : null,
                };
                const newValuePaid = normalInstallmentsParsed.filter(i => i.status === 'Paga').reduce((sum, i) => sum + i.value, 0);
                const newBalanceDue = parseFloat((loanToUpdate.totalValue - newValuePaid).toFixed(2));
                let newOverallStatus = 'Pendente';
                if (newBalanceDue <= 0.005) newOverallStatus = 'Pago Total';
                else if (newValuePaid > 0) newOverallStatus = 'Pago Parcial';

                updatedFields.installments = normalInstallmentsParsed;
                updatedFields.valuePaidClient = newValuePaid;
                updatedFields.balanceDueClient = newBalanceDue;
                updatedFields.statusPaymentClient = newOverallStatus;
            } else {
                throw new Error("Tentativa de atualizar parcela de forma inválida.");
            }

            await updateDoc(loanDocRef, updatedFields);
            showToast(`Parcela ${installmentNumber} atualizada com sucesso!`, "success");
        } catch (error) {
            console.error("Erro ao atualizar status da parcela:", error);
            showToast(`Erro ao atualizar status da parcela: ${error.message}`, "error");
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md dark:shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Gerenciar Compras</h2>
            <div className="mb-6 flex justify-center gap-4">
                <button
                    onClick={() => { setPurchaseType('normal'); resetForm(); }}
                    className={`py-2 px-4 rounded-lg transition-colors duration-300 ${purchaseType === 'normal' ? 'bg-blue-600 text-white dark:bg-blue-700' : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                >
                    Compra Normal
                </button>
                <button
                    onClick={() => { setPurchaseType('shared'); resetForm(); }}
                    className={`py-2 px-4 rounded-lg transition-colors duration-300 ${purchaseType === 'shared' ? 'bg-green-600 text-white dark:bg-green-700' : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                >
                    Compra Compartilhada
                </button>
            </div>

            <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {purchaseType === 'normal' && (
                    <select
                        value={selectedClient}
                        onChange={(e) => setSelectedClient(e.target.value)}
                        className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        required={purchaseType === 'normal'}
                    >
                        <option value="">Selecione a Pessoa</option>
                        {clients.map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                    </select>
                )}
                {purchaseType === 'shared' && (
                    <>
                        <select
                            value={selectedClient1}
                            onChange={(e) => setSelectedClient1(e.target.value)}
                            className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            required={purchaseType === 'shared'}
                        >
                            <option value="">Selecione a Pessoa 1</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                        <select
                            value={selectedClient2}
                            onChange={(e) => setSelectedClient2(e.target.value)}
                            className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            required={purchaseType === 'shared'}
                        >
                            <option value="">Selecione a Pessoa 2</option>
                            {clients.filter(c => c.id !== selectedClient1).map(client => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                    </>
                )}
                <select
                    value={selectedCard}
                    onChange={(e) => setSelectedCard(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                >
                    <option value="">Selecione o Cartão</option>
                    {cards.map(card => (
                        <option key={card.id} value={card.id} style={{ backgroundColor: card.color, color: theme === 'dark' ? (['#000000', '#5E60CE'].includes(card.color) ? 'white' : 'black') : (['#FFFFFF', '#FFFFFF'].includes(card.color) ? 'black' : 'inherit') }}>
                            {card.name}
                        </option>
                    ))}
                </select>
                <input
                    type="date"
                    placeholder="Data em que a compra foi realizada"
                    value={loanDate}
                    onChange={(e) => setLoanDate(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                />
                <div className="relative col-span-full md:col-span-1 lg:col-span-1">
                    <input
                        type="text"
                        placeholder="Descrição (Opcional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                </div>
                <input
                    type="text"
                    placeholder={purchaseType === 'normal' ? "Valor Total da Compra (R$)" : "Valor Total do Item (R$)"}
                    value={totalValueInput}
                    onChange={handleCurrencyInputChange(setTotalValueInput)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                />
                {purchaseType === 'shared' && (
                    <>
                        <input
                            type="text"
                            placeholder="Valor da Pessoa 1 (R$)"
                            value={person1ShareInput}
                            onChange={handleCurrencyInputChange(setPerson1ShareInput)}
                            className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            required={purchaseType === 'shared'}
                        />
                        <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            Valor Pessoa 2: <span className="font-semibold">{person2ShareDisplay}</span>
                        </div>
                    </>
                )}
                <input
                    type="number"
                    placeholder="Número de Parcelas (Ex: 1, 3, 10)"
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    min="1"
                    required
                />
                <input
                    type="date"
                    placeholder="Data de vencimento da primeira parcela"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                    readOnly={!editingLoan && selectedCard && loanDate}
                />
                <div className="col-span-full flex justify-end gap-4">
                    <button
                        type="submit"
                        className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md dark:bg-blue-700 dark:hover:bg-blue-800"
                    >
                        {editingLoan ? 'Atualizar Compra' : 'Adicionar Compra'}
                    </button>
                    {editingLoan && (
                        <button
                            type="button"
                            onClick={resetForm}
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
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider rounded-tl-lg">
                                <button onClick={() => requestSort('pessoa')} className="flex items-center gap-1">
                                    Pessoa
                                    {sortConfig.key === 'pessoa' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                                </button>
                            </th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                <button onClick={() => requestSort('cartao')} className="flex items-center gap-1">
                                    Cartão
                                    {sortConfig.key === 'cartao' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                                </button>
                            </th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                <button onClick={() => requestSort('totalValue')} className="flex items-center gap-1">
                                    Valor da Parcela
                                    {sortConfig.key === 'totalValue' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                                </button>
                            </th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Nº de Parcelas</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">Valor (Parte/Total)</th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                <button onClick={() => requestSort('status')} className="flex items-center gap-1">
                                    Status
                                    {sortConfig.key === 'status' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                                </button>
                            </th>
                            <th className="py-3 px-4 text-left text-sm font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider rounded-tr-lg">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedDisplayableLoans.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="py-4 px-4 text-center text-gray-500 dark:text-gray-400">Nenhuma compra registrada.</td>
                            </tr>
                        ) : (
                            sortedDisplayableLoans.map((loanItem) => {
                                const cardDetails = getCardInfo(loanItem.cardId);
                                const clientName = getClientName(loanItem.clientId);
                                
                                const installmentValue = loanItem.installments[0]?.value || 0;

                                return (
                                    <React.Fragment key={loanItem.displayId}>
                                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                {clientName}
                                                {loanItem.isSharedPart && <span className="ml-1 text-xs text-green-600 dark:text-green-400">(Comp.)</span>}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300 flex items-center">
                                                <span
                                                    className="w-4 h-4 rounded-sm mr-2 inline-block"
                                                    style={{ backgroundColor: cardDetails.color }}
                                                    title={`Cor: ${cardDetails.color}`}
                                                ></span>
                                                {cardDetails.name}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{formatCurrencyDisplay(installmentValue)}</td>
                                            
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                {loanItem.installmentsProgress}
                                            </td>
                                            
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{formatCurrencyDisplay(loanItem.totalToPayClient)}</td>
                                            
                                            <td className={`py-3 px-4 whitespace-nowrap font-semibold ${
                                                loanItem.statusPaymentClient === 'Pago Total' ? 'text-green-600 dark:text-green-400' :
                                                    loanItem.statusPaymentClient === 'Pendente' ? 'text-yellow-600 dark:text-yellow-400' :
                                                        loanItem.statusPaymentClient === 'Pago Parcial' ? 'text-blue-600 dark:text-blue-400' :
                                                            'text-red-600 dark:text-red-400'
                                                        }`}>
                                                {loanItem.statusPaymentClient}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(loanItem)}
                                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => confirmDeleteLoan(loanItem)}
                                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                >
                                                    Deletar
                                                </button>
                                                <button
                                                    onClick={() => toggleInstallmentsVisibility(loanItem.displayId)}
                                                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition duration-300"
                                                    title={showInstallments[loanItem.displayId] ? 'Esconder Parcelas' : 'Mostrar Parcelas'}
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="24"
                                                        height="24"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        className={`lucide lucide-chevron-down transform transition-transform ${showInstallments[loanItem.displayId] ? 'rotate-180' : ''}`}
                                                    >
                                                        <path d="m6 9 6 6 6-6" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                        {showInstallments[loanItem.displayId] && loanItem.installments && loanItem.installments.length > 0 && (
                                            <tr className="bg-gray-50 dark:bg-gray-700">
                                                <td colSpan="7" className="p-0">
                                                    <div className="p-4 border-t border-gray-200 dark:border-gray-600">
                                                        <h4 className="text-md font-semibold mb-2 text-gray-800 dark:text-gray-200">
                                                            Parcelas {loanItem.isSharedPart ? `(Ref. Compra Total: ${formatCurrencyDisplay(loanItem.originalSharedPurchaseTotalValue)})` : ''}:
                                                        </h4>
                                                        <ul className="list-disc list-inside space-y-1">
                                                            {loanItem.installments.map((installment) => (
                                                                <li key={`${loanItem.displayId}-inst-${installment.number}`} className="text-gray-700 dark:text-gray-300 flex justify-between items-center">
                                                                    <div>
                                                                        Parcela {installment.number}: {formatCurrencyDisplay(installment.value)} - Vencimento: {installment.dueDate} - Status:
                                                                        <span className={`ml-2 font-semibold ${
                                                                            installment.status === 'Paga' ? 'text-green-600 dark:text-green-400' :
                                                                                (new Date(installment.dueDate + "T00:00:00") < new Date(new Date().setHours(0, 0, 0, 0)) && installment.status === 'Pendente' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400')
                                                                                }`}>
                                                                            {new Date(installment.dueDate + "T00:00:00") < new Date(new Date().setHours(0, 0, 0, 0)) && installment.status === 'Pendente' ? 'Atrasada' : installment.status}
                                                                        </span>
                                                                        {installment.status === 'Paga' && installment.paidDate && (
                                                                            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                                                                                (Pago em: {installment.paidDate})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {installment.status === 'Pendente' && (
                                                                        <button
                                                                            onClick={() => handleUpdateInstallmentStatusLoan(loanItem.originalLoanId, loanItem.personKey, installment.number, 'Paga')}
                                                                            className="ml-3 text-sm bg-green-500 text-white px-2 py-1 rounded-md hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-800"
                                                                        >
                                                                            Marcar Paga
                                                                        </button>
                                                                    )}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            <GenericModal
                isOpen={isConfirmationModalOpen}
                onClose={() => setIsConfirmationModalOpen(false)}
                onConfirm={handleDeleteLoanConfirmed}
                title="Confirmar Exclusão"
                message={loanToDelete ?
                    `Tem certeza que deseja deletar esta compra? ${loanToDelete.isSharedPart ? 'Isso deletará a compra compartilhada inteira para ambas as pessoas.' : ''}`
                    : ''}
                isConfirmation={true}
                theme={theme}
            />
        </div>
    );
}
export default LoanManagement;