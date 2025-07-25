import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification, setPersistence, browserLocalPersistence, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import {
    BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';


const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};
// Contexto para compartilhar o estado do Firebase e do usuário em toda a aplicação
const AppContext = createContext();

/**
 * Função de utilidade para formatar números para exibição em moeda BRL.
 * @param {number} value - O valor numérico a ser formatado.
 * @returns {string} O valor formatado como string BRL (Ex: R$ 1.234,56).
 */
const formatCurrencyDisplay = (value) => {
    if (typeof value !== 'number' || isNaN(value)) {
        return 'R$ 0,00';
    }
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Função de utilidade para analisar uma string de entrada de moeda BRL para um número.
 * @param {string} inputString - A string de entrada da moeda (Ex: "1.234,56" ou "R$ 1.234,56").
 * @returns {number} O valor numérico analisado.
 */
const parseCurrencyInput = (inputString) => {
    if (typeof inputString !== 'string') {
        return 0;
    }
    // Remove "R$", espaços, separadores de milhares (ponto). Substitui vírgula decimal por ponto.
    const cleanedString = inputString.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
    const parsed = parseFloat(cleanedString);
    return isNaN(parsed) ? 0 : parsed;
};

/**
 * Função de ordem superior para lidar com mudanças na entrada de moeda.
 * Garante que apenas dígitos, vírgulas e pontos sejam permitidos e formata a entrada.
 * @param {function} setter - A função setState do React para atualizar o valor da entrada.
 * @returns {function} Um manipulador de eventos onChange para campos de entrada.
 */
const handleCurrencyInputChange = (setter) => (e) => {
    let value = e.target.value;
    // Permite apenas dígitos, vírgulas e pontos para digitação
    value = value.replace(/[^\d,.]/g, '');

    // Garante apenas uma vírgula (separador decimal)
    const commaIndex = value.indexOf(',');
    const lastCommaIndex = value.lastIndexOf(',');
    if (commaIndex !== -1 && commaIndex !== lastCommaIndex) {
        value = value.substring(0, commaIndex + 1) + value.substring(lastCommaIndex + 1);
    }
    setter(value);
};

/**
 * Função de fallback para copiar texto para a área de transferência usando document.execCommand.
 * Necessário porque navigator.clipboard.writeText pode não funcionar em iframes.
 * @param {string} textToCopy - O texto a ser copiado.
 * @returns {boolean} True se a cópia foi bem-sucedida, false caso contrário.
 */
const copyTextToClipboardFallback = (textToCopy) => {
    if (!textToCopy) return false;
    const textArea = document.createElement('textarea');
    textArea.value = textToCopy;
    // Torna a textarea invisível e impede a rolagem
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    let successful = false;
    try {
        successful = document.execCommand('copy');
    } catch (err) {
        console.error('Fallback: Não foi possível copiar', err);
        successful = false;
    }
    document.body.removeChild(textArea);
    return successful;
};

// =========================================================================
// Novos Componentes de Modal para substituir document.createElement
// =========================================================================

/**
 * Componente de Modal Genérico para confirmação ou informação.
 * @param {object} props - As propriedades do componente.
 * @param {boolean} props.isOpen - Se o modal está aberto.
 * @param {function} props.onClose - Função para fechar o modal.
 * @param {string} props.title - Título do modal.
 * @param {string} props.message - Mensagem a ser exibida.
 * @param {boolean} [props.isConfirmation=false] - Se é um modal de confirmação (com botões Sim/Não).
 * @param {function} [props.onConfirm] - Função a ser chamada se for um modal de confirmação e o usuário confirmar.
 * @param {string} props.theme - Tema atual ('light' ou 'dark') para estilização.
 * @returns {JSX.Element|null} O elemento modal ou null se não estiver aberto.
 */
const GenericModal = ({ isOpen, onClose, title, message, isConfirmation = false, onConfirm, theme }) => {
    if (!isOpen) return null;

    const bgColor = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
    const textColor = theme === 'dark' ? 'text-gray-100' : 'text-gray-900';
    const buttonPrimaryBg = theme === 'dark' ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-600 hover:bg-blue-700';
    const buttonDangerBg = theme === 'dark' ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700';
    const buttonSecondaryBg = theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-400 hover:bg-gray-500';

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className={`${bgColor} p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 ${textColor}`}>
                <h3 className="text-xl font-semibold mb-4 text-center">{title}</h3>
                <p className="mb-6 text-center whitespace-pre-line">{message}</p>
                <div className="flex justify-end gap-3">
                    {isConfirmation && (
                        <button
                            onClick={() => { onConfirm(); onClose(); }}
                            className={`${buttonDangerBg} text-white py-2 px-4 rounded-md transition duration-300`}
                        >
                            Sim
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className={`${isConfirmation ? buttonSecondaryBg : buttonPrimaryBg} text-white py-2 px-4 rounded-md transition duration-300`}
                    >
                        {isConfirmation ? 'Não' : 'Fechar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Componente de Toast para exibir mensagens temporárias (sucesso, erro, info).
 * @param {object} props - As propriedades do componente.
 * @param {object|null} props.message - Objeto da mensagem: { type: 'success'|'error'|'info'|'warning', text: string }.
 * @param {function} props.onClose - Função para fechar o toast.
 * @returns {JSX.Element|null} O elemento toast ou null se não houver mensagem.
 */
const Toast = ({ message, onClose }) => {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000); // Fecha automaticamente após 5 segundos
            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

    if (!message) return null;

    let bgColorClass, textColorClass, borderColorClass;
    switch (message.type) {
        case 'success':
            bgColorClass = 'bg-green-100 dark:bg-green-900';
            textColorClass = 'text-green-700 dark:text-green-300';
            borderColorClass = 'border-green-400 dark:border-green-700';
            break;
        case 'error':
            bgColorClass = 'bg-red-100 dark:bg-red-900';
            textColorClass = 'text-red-700 dark:text-red-300';
            borderColorClass = 'border-red-400 dark:border-red-700';
            break;
        case 'warning':
            bgColorClass = 'bg-yellow-100 dark:bg-yellow-900';
            textColorClass = 'text-yellow-700 dark:text-yellow-300';
            borderColorClass = 'border-yellow-400 dark:border-yellow-700';
            break;
        case 'info':
        default:
            bgColorClass = 'bg-blue-100 dark:bg-blue-900';
            textColorClass = 'text-blue-700 dark:text-blue-300';
            borderColorClass = 'border-blue-400 dark:border-blue-700';
            break;
    }

    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1001] px-4 py-3 rounded-lg shadow-lg flex items-center justify-between transition-all duration-300 transform ${bgColorClass} ${textColorClass} border ${borderColorClass}`}>
            <p className="text-sm font-medium">{message.text}</p>
            <button onClick={onClose} className="ml-4 p-1 rounded-full hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

// =========================================================================
// Fim dos Componentes de Modal
// =========================================================================

// Componente principal do aplicativo
function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [activeTab, setActiveTab] = useState('resumo');
    const [theme, setTheme] = useState('dark');
    const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    });
    const [selectedCardFilter, setSelectedCardFilter] = useState('');
    const [selectedClientFilter, setSelectedClientFilter] = useState('');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [userName, setUserName] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [authError, setAuthError] = useState('');
    const [authMessage, setAuthMessage] = useState('');
    const [postRegistrationMessage, setPostRegistrationMessage] = useState(null);
    const [rememberMe, setRememberMe] = useState(false);
    const rememberMeCheckboxRef = useRef(null);
    const [loginSuggestion, setLoginSuggestion] = useState(''); // Estado para a sugestão de login

    // Estado para o Toast (mensagens temporárias)
    const [toastMessage, setToastMessage] = useState(null);
    const showToast = (text, type = 'info') => {
        setToastMessage({ text, type });
    };
    const clearToast = () => setToastMessage(null);

    const showAuthError = (message) => {
        setAuthError(message);
        setTimeout(() => {
            setAuthError('');
        }, 5000); // 5000 milissegundos = 5 segundos
    };

    // Efeito para inicializar o Firebase e gerenciar o estado de autenticação.
    // Adaptação para o ambiente Canvas, utilizando __firebase_config e __initial_auth_token.
    useEffect(() => {
        try {
            // Usa a configuração do Firebase fornecida pelo ambiente Canvas, se disponível.
            // Caso contrário, usa a configuração original do usuário (útil para desenvolvimento local).
            const canvasFirebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
            const app = initializeApp(canvasFirebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Carrega o email lembrado do localStorage
            const savedEmail = localStorage.getItem('rememberedEmail');
            if (savedEmail) {
                setEmail(savedEmail);
                setRememberMe(true);
            } else {
                setRememberMe(false);
            }
            
            const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
                setCurrentUser(user); // Atualiza o estado do usuário atual
                if (user) {
                    setUserId(user.uid); // Define o userId se o usuário estiver logado
                    setAuthError('');
                    setAuthMessage('');
                } else {
                    setUserId(null);    
                }
                setIsAuthReady(true);    
            });

            return () => unsubscribe(); // Limpa o listener ao desmontar o componente
        } catch (error) {
            console.error("Erro na inicialização do Firebase:", error);
            showAuthError(`Erro na inicialização do Firebase: ${error.message}. Verifique sua configuração.`);
            setIsAuthReady(true); // Garante que a tela de erro seja exibida mesmo se a inicialização falhar
        }
    }, []); // Array de dependências vazio para rodar apenas uma vez na montagem

    // Efeito para limpar a mensagem pós-registro após um tempo
    useEffect(() => {
        if (postRegistrationMessage) {
            const timer = setTimeout(() => {
                setPostRegistrationMessage(null);
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [postRegistrationMessage]);

    /**
     * Constrói o caminho da coleção de dados do usuário no Firestore.
     * Utiliza __app_id para isolar dados por aplicação no ambiente Canvas.
     * @returns {string[]} Segmentos do caminho da coleção.
     */
    const getUserCollectionPathSegments = () => {
        if (typeof __app_id !== 'undefined') {
            return ['artifacts', __app_id, 'users'];
        } else {
            console.warn("AVISO: __app_id não está definido. Usando um caminho de fallback 'users_fallback'. Isso pode não funcionar corretamente ou de forma segura fora do ambiente Canvas. Certifique-se de que __app_id esteja configurado corretamente se for implantar no Canvas.");
            return ['users_fallback'];
        }
    };

    // Efeito para aplicar o tema 'dark' ou 'light' à classe 'html'
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    // Alterna entre os temas 'light' e 'dark'
    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    /**
     * Manipulador de registro de novos usuários.
     * Cria um novo usuário com e-mail e senha, envia e-mail de verificação
     * e salva o perfil básico no Firestore.
     * @param {Event} e - O evento de envio do formulário.
     */
    const handleRegister = async (e) => {
        e.preventDefault();
        setAuthError('');
        setAuthMessage('');
        setPostRegistrationMessage(null);

        if (password.length < 8) {
            showAuthError('A senha deve ter no mínimo 8 caracteres.');
            return;
        }
        if (password !== confirmPassword) {
            showAuthError('As senhas não coincidem.');
            return;
        }

        try {
            console.log("Tentando registrar com:", email, password);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log("Usuário Firebase criado:", userCredential.user.uid);

            await sendEmailVerification(userCredential.user);
            console.log("E-mail de verificação enviado.");

            const userCollectionPath = getUserCollectionPathSegments();
            const userDocRef = doc(db, ...userCollectionPath, userCredential.user.uid);
            console.log("Tentando salvar perfil do usuário no Firestore em:", userDocRef.path);
            await setDoc(userDocRef, {
                name: userName,
                email: email,
                createdAt: new Date(),
            }, { merge: true });
            console.log("Perfil do usuário salvo no Firestore.");

            setAuthMessage('🎉 Quase lá! Enviamos um e-mail de verificação para você. Em instantes, você será redirecionado para a tela de login. 🚀');

            setTimeout(async () => {
                await signOut(auth); // Desloga para forçar o login com verificação de e-mail
                setAuthMessage('');
                setIsRegistering(false);
                setPostRegistrationMessage('🎉 Falta Pouco! Por favor, verifique sua caixa de entrada e spam para fazer login e aproveitar todos os recursos! 🚀');
            }, 25000);

            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setUserName('');

        } catch (error) {
            console.error("Erro no cadastro:", error);
            if (error.code === 'auth/operation-not-allowed') {
                showAuthError('O registro com e-mail/senha não está ativado. Por favor, ative-o nas configurações de autenticação do seu projeto Firebase.');
            } else if (error.code === 'auth/invalid-argument') {
                showAuthError('Argumento inválido. Verifique se o e-mail está formatado corretamente e a senha atende aos requisitos.');
            } else if (error.code === 'auth/email-already-in-use') {
                showAuthError('Este e-mail já está em uso. Tente fazer login ou use outro e-mail.');
            } else if (error.code === 'permission-denied') {
                showAuthError('Erro de permissão ao salvar dados do usuário. Por favor, verifique as regras de segurança do seu Firestore no Firebase Console.');
            }
            else {
                showAuthError(`Erro no cadastro: ${error.message}`);
            }
        }
    };

    /**
     * Manipulador de login de usuários.
     * Tenta fazer login com e-mail ou nome de usuário, verificando a autenticação.
     * @param {Event} e - O evento de envio do formulário.
     */
    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthError('');
        setAuthMessage('');
        setPostRegistrationMessage(null);

        let authIdentifier = email;
        let authEmailResolved = '';

        const isEmailFormat = /\S+@\S+\.\S+/.test(authIdentifier);

        try {
            if (!isEmailFormat) {
                console.log("A entrada não parece um e-mail. Tentando procurar por login (nome de utilizador):", authIdentifier);

                const userCollectionPathPrefix = getUserCollectionPathSegments();
                const usersRef = collection(db, ...userCollectionPathPrefix);
                const q = query(usersRef, where('name', '==', authIdentifier));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    showAuthError('Utilizador (login) não encontrado. Verifique o seu login ou utilize o seu e-mail.');
                    return;
                }

                const userData = querySnapshot.docs[0].data();
                authEmailResolved = userData.email;
                console.log("Login (nome de utilizador) encontrado, utilizando e-mail:", authEmailResolved);
            } else {
                authEmailResolved = authIdentifier;
            }

            // Define a persistência da sessão
            await setPersistence(auth, browserLocalPersistence);
            console.log("Tentando iniciar sessão com e-mail:", authEmailResolved, "e palavra-passe.");
            const userCredential = await signInWithEmailAndPassword(auth, authEmailResolved, password);

            // Verifica se o e-mail foi verificado
            if (!userCredential.user.emailVerified) {
                return;
            }

            // Gerencia o "Lembrar meu e-mail"
            const currentRememberMeValue = rememberMeCheckboxRef.current ? rememberMeCheckboxRef.current.checked : rememberMe;

            if (currentRememberMeValue) {
                localStorage.setItem('rememberedEmail', authEmailResolved);
            } else {
                localStorage.removeItem('rememberedEmail');
            }

            setAuthMessage('Sessão iniciada com sucesso!');
            setPassword('');
            setLoginSuggestion(''); // Limpa sugestão após login
        } catch (error) {
            console.error("Erro no login:", error);
            if (error.code === 'auth/operation-not-allowed') {
                showAuthError('O início de sessão com e-mail/palavra-passe não está ativado. Por favor, ative-o nas configurações de autenticação do seu projeto Firebase.');
            } else if (error.code === 'auth/invalid-argument') {
                showAuthError('Argumento inválido. Verifique se o e-mail/login está formatado corretamente e a palavra-passe atende aos requisitos.');
            } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                showAuthError('E-mail/Login ou palavra-passe inválidos.');
            } else if (error.code === 'permission-denied') {
                showAuthError('Erro de permissão ao procurar utilizador. As regras de segurança do Firestore não permitem a procura de utilizadores por login antes da autenticação. Consulte o console para mais detalhes.');
            }
            else {
                showAuthError(`Erro no início de sessão: ${error.message}`);
            }
        }
    };

    /**
     * Manipulador de logout.
     * Encerra a sessão do usuário.
     */
    const handleLogout = async (suppressMessage = false) => {
        try {
            await signOut(auth);
    
            // Limpa TODAS as mensagens
            setAuthError('');
            setAuthMessage('');
            setPostRegistrationMessage(null);
    
            if (!suppressMessage) {
                // Define a mensagem de logout apenas se não for suprimida
                setAuthMessage('Sessão terminada com sucesso.');
            }
    
            setActiveTab('resumo'); // Redireciona para o resumo após logout
            setPassword('');
            setShowSettingsDropdown(false);
            // Restaura o campo de e-mail se "Lembrar meu e-mail" estiver ativado
            const savedEmail = localStorage.getItem('rememberedEmail');
            if (savedEmail) {
                setEmail(savedEmail);
                setRememberMe(true);
                if (rememberMeCheckboxRef.current) {
                    rememberMeCheckboxRef.current.checked = true;
                }
            } else {
                setEmail('');
                setRememberMe(false);
                if (rememberMeCheckboxRef.current) {
                    rememberMeCheckboxRef.current.checked = false;
                }
            }
            setPassword(''); // Limpa a senha ao fazer logout
            setShowSettingsDropdown(false); // Fecha o dropdown de configurações
        } catch (error) {
            console.error("Erro ao terminar a sessão:", error);
            showAuthError(`Erro ao terminar a sessão: ${error.message}`);
            showAuthError('Erro ao sair.');
        }
    };

    // Manipulador para o campo de email/login para mostrar sugestões de preenchimento
    const handleEmailInputChange = (e) => {
        const typedValue = e.target.value;
        setEmail(typedValue);
        const remembered = localStorage.getItem('rememberedEmail');
        if (remembered && typedValue && remembered.toLowerCase().startsWith(typedValue.toLowerCase()) && remembered !== typedValue) {
            setLoginSuggestion(remembered);
        } else {
            setLoginSuggestion('');
        }
    };

    // Manipulador para clicar na sugestão de login
    const handleSuggestionClick = () => {
        if (loginSuggestion) {
            setEmail(loginSuggestion);
            setLoginSuggestion(''); // Limpa a sugestão após o clique
        }
    };

    // Exibe tela de carregamento enquanto o estado de autenticação está sendo verificado
    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">A carregar aplicação...</div>
            </div>
        );
    }

    // Exibe a tela de Login/Registro se o usuário não estiver logado ou o e-mail não estiver verificado
    if (!userId || (currentUser && !currentUser.emailVerified)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
                    <h2 className="text-3xl font-bold text-center mb-6 text-gray-800 dark:text-gray-100">
                        {isRegistering ? 'Registar' : 'Entrar'}
                    </h2>
                    {authError && (
                        <div className="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
                            {authError}
                        </div>
                    )}
                    {authMessage && (
                        <div className="bg-green-100 border border-green-400 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">
                            {authMessage}
                        </div>
                    )}
                    {postRegistrationMessage && (
                        <div className="bg-green-100 border border-green-400 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">
                            {postRegistrationMessage}
                        </div>
                    )}

                     {currentUser && !currentUser.emailVerified && !isRegistering && !authMessage && (
                        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                            O seu e-mail (<span className="font-semibold">{currentUser.email}</span>) ainda não foi verificado. Por favor, verifique a sua caixa de entrada e spam para ativar a sua conta e começar a usar a aplicação!
                            <button
                                onClick={async () => {
                                    try {
                                        await sendEmailVerification(currentUser);
                                
                                        // 1. Mostra uma mensagem persistente em vez de um toast
                                        setAuthMessage('🚀 Novo e-mail de verificação enviado!');
                                
                                        // 2. Inicia um temporizador de 10 segundos
                                        setTimeout(() => {
                                            handleLogout(true); // 3. Desloga o usuário após 10s para limpar a tela
                                        }, 5000);
                                
                                    } catch (error) {
                                        // 4. Melhora a mensagem de erro para o caso de muitas tentativas
                                        if (error.code === 'auth/too-many-requests') {
                                            showAuthError('Muitas tentativas de reenvio. Por favor, aguarde um momento antes de tentar novamente.');
                                        } else {
                                            showAuthError(`Erro ao reenviar e-mail: ${error.message}`);
                                        }
                                    }
                                }}
                                className="block w-full mt-3 bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition duration-300 shadow-md dark:bg-yellow-700 dark:hover:bg-yellow-800"
                            >
                                Reenviar E-mail de Verificação
                            </button>
                            <button
                                onClick={handleLogout}
                                className="block w-full mt-2 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 transition duration-300 shadow-md dark:bg-gray-600 dark:hover:bg-gray-700"
                            >
                                Sair
                            </button>
                        </div>
                    )} 

                    {!(currentUser && !currentUser.emailVerified) && (
                        <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
                            {isRegistering && (
                                <input
                                    type="text"
                                    placeholder="Seu Login (nome de utilizador)"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    required
                                />
                            )}
                            <div className="relative"> {/* Container para input e sugestão */}
                                <input
                                    type="text"
                                    placeholder="Seu E-mail ou Login"
                                    value={email}
                                    onChange={handleEmailInputChange} // Atualizado para usar o novo handler
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    required
                                    autoComplete="username" // Ajuda navegadores a oferecerem seus próprios autocompletions
                                />
                                {loginSuggestion && (
                                    <div
                                        onClick={handleSuggestionClick}
                                        className="absolute z-10 w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-b-lg shadow-lg cursor-pointer"
                                    >
                                        <div className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 text-sm text-gray-700 dark:text-gray-200">
                                            {loginSuggestion}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <input
                                type="password"
                                placeholder="Sua Palavra-passe (mínimo 8 caracteres)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                required
                                autoComplete={isRegistering ? "new-password" : "current-password"}
                            />
                            {isRegistering && (
                                <input
                                    type="password"
                                    placeholder="Repita a Palavra-passe"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    required
                                    autoComplete="new-password"
                                />
                            )}
                            {!isRegistering && (
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="rememberMe"
                                        ref={rememberMeCheckboxRef}
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                                    />
                                    <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-900 dark:text-gray-300">
                                        Lembrar meu e-mail
                                    </label>
                                </div>
                            )}
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md dark:bg-blue-700 dark:hover:bg-blue-800"
                            >
                                {isRegistering ? 'Registar' : 'Entrar'}
                            </button>
                        </form>
                    )}

                    {!(currentUser && !currentUser.emailVerified) && (
                        <p className="mt-6 text-center text-gray-600 dark:text-gray-300">
                            {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}
                            <button
                                onClick={() => {
                                    setIsRegistering(prev => !prev);
                                    setAuthError('');
                                    setAuthMessage('');
                                    setPostRegistrationMessage(null);
                                    const savedEmail = localStorage.getItem('rememberedEmail'); // Mantém o email lembrado ao alternar
                                    if (savedEmail && !isRegistering) { // Só preenche se estiver a ir para o login
                                        setEmail(savedEmail);
                                    } else if (!savedEmail && !isRegistering) {
                                        setEmail('');
                                    }
                                    setPassword('');
                                    setConfirmPassword('');
                                    setUserName('');
                                    setLoginSuggestion(''); // Limpa sugestão ao alternar
                                }}
                                className="text-blue-600 hover:underline ml-2 dark:text-blue-400"
                            >
                                {isRegistering ? 'Iniciar Sessão' : 'Registe-se'}
                            </button>
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <AppContext.Provider value={{ db, auth, userId, isAuthReady, theme, getUserCollectionPathSegments, showToast }}>
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-inter text-gray-900 dark:text-gray-100 transition-colors duration-300">
                <header className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-gray-800 dark:to-gray-900 text-white p-4 shadow-md rounded-b-lg">
                    <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
                        <h1 className="text-3xl font-bold mb-2 sm:mb-0">Controle Financeiro de Cartões</h1>
                        <nav className="flex flex-wrap space-x-2 sm:space-x-4 items-center">
                            <button
                                onClick={() => setActiveTab('resumo')}
                                className={`py-2 px-3 sm:px-4 rounded-lg transition duration-300 ${activeTab === 'resumo' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700 dark:hover:text-white'}`}
                            >
                                Resumo
                            </button>
                            <button
                                onClick={() => setActiveTab('pessoas')}
                                className={`py-2 px-3 sm:px-4 rounded-lg transition duration-300 ${activeTab === 'pessoas' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700 dark:hover:text-white'}`}
                            >
                                Pessoas
                            </button>
                            <button
                                onClick={() => setActiveTab('cards')}
                                className={`py-2 px-3 sm:px-4 rounded-lg transition duration-300 ${activeTab === 'cards' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700 dark:hover:text-white'}`}
                            >
                                Cartões
                            </button>
                            <button
                                onClick={() => setActiveTab('purchases')}
                                className={`py-2 px-3 sm:px-4 rounded-lg transition duration-300 ${activeTab === 'purchases' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700 dark:hover:text-white'}`}
                            >
                                Compras
                            </button>
                            <button
                                onClick={() => setActiveTab('subscriptions')}
                                className={`py-2 px-3 sm:px-4 rounded-lg transition duration-300 ${activeTab === 'subscriptions' ? 'bg-blue-700 dark:bg-gray-700 text-white shadow-lg' : 'hover:bg-blue-700 hover:text-white dark:hover:bg-gray-700 dark:hover:text-white'}`}
                            >
                                Assinaturas
                            </button>

                            <div className="relative">
                                <button
                                    onClick={() => setShowSettingsDropdown(prev => !prev)}
                                    className="ml-2 sm:ml-4 p-2 rounded-full text-white hover:bg-blue-700 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-800 dark:focus:ring-offset-gray-900 focus:ring-white transition duration-300"
                                    title="Configurações"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                                </button>
                                {showSettingsDropdown && (
                                    <div
                                        className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5"
                                        onMouseLeave={() => setShowSettingsDropdown(false)}
                                    >
                                        <button
                                            onClick={() => { toggleTheme(); setShowSettingsDropdown(false); }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center"
                                        >
                                            {theme === 'light' ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-moon mr-2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sun mr-2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.93 4.93l1.41 1.41" /><path d="M17.66 17.66l1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M6.34 17.66l-1.41 1.41" /><path d="M19.07 4.93l-1.41 1.41" /></svg>
                                            )}
                                            Alternar Tema
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-800 dark:hover:text-red-300 flex items-center"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-out mr-2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                                            Sair
                                        </button>
                                    </div>
                                )}
                            </div>
                        </nav>
                    </div>
                </header>

                <main className="container mx-auto p-4 mt-4">
                    {activeTab === 'resumo' && <Dashboard
                        selectedMonth={selectedMonth}
                        setSelectedMonth={setSelectedMonth}
                        selectedCardFilter={selectedCardFilter}
                        setSelectedCardFilter={setSelectedCardFilter}
                        selectedClientFilter={selectedClientFilter}
                        setSelectedClientFilter={setSelectedClientFilter}
                    />}
                    {activeTab === 'pessoas' && <ClientManagement />}
                    {activeTab === 'cards' && <CardManagement />}
                    {activeTab === 'purchases' && <LoanManagement />}
                    {activeTab === 'subscriptions' && <SubscriptionManagement 
                                    selectedMonth={selectedMonth} 
                                    setSelectedMonth={setSelectedMonth}  />}
                </main>
                <Toast message={toastMessage} onClose={clearToast} />
            </div>
        </AppContext.Provider>
    );
}

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

    // Funções de CRUD de cliente (inalteradas)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!clientName.trim()) {
            showToast('O nome da pessoa não pode ser vazio.', 'warning');
            return;
        }
        const userCollectionPath = getUserCollectionPathSegments();
        try {
            if (editingClient) {
                const clientDocRef = doc(db, ...userCollectionPath, userId, 'clients', editingClient.id);
                await updateDoc(clientDocRef, { name: clientName });
                setEditingClient(null);
                showToast("Pessoa atualizada com sucesso!", "success");
            } else {
                await addDoc(collection(db, ...userCollectionPath, userId, 'clients'), {
                    name: clientName,
                    createdAt: new Date(),
                });
                showToast("Pessoa adicionada com sucesso!", "success");
            }
            setClientName('');
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
}

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


// ####################################################################################
// ## INÍCIO DO COMPONENTE LoanManagement COM AS ALTERAÇÕES SOLICITADAS
// ####################################################################################
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

    // NOVO ESTADO: Para controlar a ordenação da tabela
    const [sortConfig, setSortConfig] = useState({ key: 'loanDate', direction: 'descending' });

    // Funções de busca de nome (para usar na ordenação)
    const getClientName = (clientId) => clients.find(c => c.id === clientId)?.name || 'N/A';
    const getCardInfo = (cardId) => {
        const card = cards.find(c => c.id === cardId);
        return card ? { name: card.name, color: card.color || '#cccccc' } : { name: 'Cartão Desconhecido', color: '#cccccc' };
    };

    // Efeito para calcular a parte da Pessoa 2
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

    // Efeitos para carregar dados (clientes, cartões, empréstimos)
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
            setLoans(fetchedLoans); // Armazena os originais

            // Transforma para exibição (expande compras compartilhadas)
            const transformedForDisplay = fetchedLoans.flatMap(loan => {
                if (loan.isShared && loan.sharedDetails) {
                    const p1Installments = typeof loan.sharedDetails.person1.installments === 'string' ? JSON.parse(loan.sharedDetails.person1.installments) : loan.sharedDetails.person1.installments || [];
                    const p2Installments = typeof loan.sharedDetails.person2.installments === 'string' ? JSON.parse(loan.sharedDetails.person2.installments) : loan.sharedDetails.person2.installments || [];
                    
                    // --- NOVA LÓGICA DE CÁLCULO DA PARCELA ATUAL PARA EXIBIÇÃO ---
                    const getInstallmentProgressDisplay = (installmentsArray, totalCount) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0); // Zera hora para comparação de data pura
                        
                        let currentInstallmentNumber = 0;
                        let foundNextPendingOrOverdue = false; 
                        
                        // Encontra a primeira parcela pendente ou atrasada
                        for (let i = 0; i < installmentsArray.length; i++) {
                            const inst = installmentsArray[i];
                            if (inst.status === 'Pendente') {
                                const dueDate = new Date(inst.dueDate + "T00:00:00");
                                dueDate.setHours(0, 0, 0, 0); // Zera hora
                                
                                if (dueDate >= today) { // Se a parcela ainda vai vencer ou vence hoje
                                    currentInstallmentNumber = inst.number;
                                    foundNextPendingOrOverdue = true;
                                    break;
                                } else { // Se a parcela está atrasada
                                    currentInstallmentNumber = inst.number;
                                    foundNextPendingOrOverdue = true;
                                    break;
                                }
                            }
                        }

                        if (!foundNextPendingOrOverdue) {
                            // Se não encontrou nenhuma pendente ou atrasada,
                            // significa que todas as parcelas anteriores foram pagas.
                            // Verifica se existe alguma parcela paga e, se sim, pega o número da última paga.
                            // Se nenhuma foi paga (totalCount = 0 ou tudo futuro), mostra 0/totalCount.
                            const lastPaid = installmentsArray.filter(inst => inst.status === 'Paga').pop();
                            if (lastPaid) {
                                return `${lastPaid.number}/${totalCount}`;
                            } else {
                                // Se nenhuma foi paga e nenhuma pendente/atrasada, significa que a compra é nova
                                // ou todas as parcelas são futuras. Mostra 0 ou 1 se houver parcelas.
                                return totalCount > 0 ? `1/${totalCount}` : `0/${totalCount}`; // Se tem parcelas mas nenhuma paga/pendente atual, mostra 1/Total
                            }
                        } else {
                            // Retorna o número da parcela atual a ser paga ou a atrasada, sobre o total
                            return `${currentInstallmentNumber}/${totalCount}`;
                        }
                    };
                    // --- FIM NOVA LÓGICA ---

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
                            installmentsProgress: getInstallmentProgressDisplay(p1Installments, loan.installmentsCount) // ATUALIZADO
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
                            installmentsProgress: getInstallmentProgressDisplay(p2Installments, loan.installmentsCount) // ATUALIZADO
                        });
                    }
                    return parts;
                } else {
                    const normalInstallmentsParsed = typeof loan.installments === 'string' ? JSON.parse(loan.installments) : (loan.installments || []);
                    
                    // --- NOVA LÓGICA DE CÁLCULO DA PARCELA ATUAL PARA EXIBIÇÃO ---
                    const getInstallmentProgressDisplay = (installmentsArray, totalCount) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0); // Zera hora para comparação de data pura
                        
                        let currentInstallmentNumber = 0;
                        let foundNextPendingOrOverdue = false; 

                        for (let i = 0; i < installmentsArray.length; i++) {
                            const inst = installmentsArray[i];
                            if (inst.status === 'Pendente') {
                                const dueDate = new Date(inst.dueDate + "T00:00:00");
                                dueDate.setHours(0, 0, 0, 0); // Zera hora
                                
                                if (dueDate >= today) { // Se a parcela ainda vai vencer ou vence hoje
                                    currentInstallmentNumber = inst.number;
                                    foundNextPendingOrOverdue = true;
                                    break;
                                } else { // Se a parcela está atrasada
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
                    // --- FIM NOVA LÓGICA ---

                    return {
                        ...loan, displayId: loan.id, originalLoanId: loan.id, personKey: null, isSharedPart: false,
                        installments: normalInstallmentsParsed, totalToPayClient: loan.totalValue,
                        valuePaidClient: loan.valuePaidClient || 0, statusPaymentClient: loan.statusPaymentClient || 'Pendente',
                        firstDueDate: loan.firstDueDateClient,
                        installmentsProgress: getInstallmentProgressDisplay(normalInstallmentsParsed, loan.installmentsCount) // ATUALIZADO
                    };
                }
            });
            setDisplayableLoans(transformedForDisplay);
        }, (error) => console.error("Erro ao carregar compras:", error));

        return () => unsubscribe();
    }, [db, userId, isAuthReady, getUserCollectionPathSegments]);

    // Efeito para cálculo da primeira parcela (já corrigido)
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
                if (dueDay < closingDay) { // Se o dia de vencimento é menor que o dia de fechamento
                    firstDueDt.setMonth(firstDueDt.getMonth() + 1); // A primeira parcela vence no mês seguinte ao fechamento
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

    // NOVA LÓGICA DE ORDENAÇÃO
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
                installments: JSON.stringify(loanInstallments),
                isShared: false,
                createdAt: new Date(),
                sharedDetails: null,
                totalItemValue: null,
            };
            try {
                if (editingLoan && !editingLoan.isShared) {
                    await updateDoc(doc(db, ...userCollectionPath, userId, 'loans', editingLoan.id), loanData);
                    showToast("Compra normal atualizada com sucesso!", "success");
                } else if (!editingLoan) {
                    await addDoc(collection(db, ...userCollectionPath, userId, 'loans'), loanData);
                    showToast("Compra normal adicionada com sucesso!", "success");
                } else {
                    showToast("Não é possível converter uma compra compartilhada para normal desta forma.", "error");
                    return;
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
                        installments: JSON.stringify(installmentsP1),
                        statusPayment: 'Pendente',
                        valuePaid: 0,
                        balanceDue: person1ShareVal
                    },
                    person2: {
                        clientId: selectedClient2,
                        shareAmount: person2ShareVal,
                        installments: JSON.stringify(installmentsP2),
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
                if (editingLoan && editingLoan.isShared) {
                    await updateDoc(doc(db, ...userCollectionPath, userId, 'loans', editingLoan.id), sharedPurchaseData);
                    showToast("Compra compartilhada atualizada com sucesso!", "success");
                } else if (!editingLoan) {
                    await addDoc(collection(db, ...userCollectionPath, userId, 'loans'), sharedPurchaseData);
                    showToast("Compra compartilhada adicionada com sucesso!", "success");
                } else {
                    showToast("Não é possível converter uma compra normal para compartilhada desta forma.", "error");
                    return;
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

        if (loanToUpdate.isShared && personKey) {
            const currentSharedDetails = JSON.parse(JSON.stringify(loanToUpdate.sharedDetails));
            const personData = currentSharedDetails[personKey];
            const personInstallments = typeof personData.installments === 'string' ?
                JSON.parse(personData.installments) :
                [...(personData.installments || [])];

            const installmentIndex = personInstallments.findIndex(inst => inst.number === installmentNumber);
            if (installmentIndex === -1) {
                console.error("Parcela não encontrada para atualização (compartilhada).", { installmentIndex, length: personInstallments.length });
                showToast("Erro: Parcela não encontrada.", "error");
                return;
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
                console.error("Erro ao fazer parse das parcelas para compra normal:", e, normalInstallmentsRaw);
                showToast("Erro ao processar parcelas da compra.", "error");
                return;
            }

            const installmentIndex = normalInstallmentsParsed.findIndex(inst => inst.number === installmentNumber);
            if (installmentIndex === -1) {
                console.error("Índice da parcela inválido para atualização (normal).", { installmentIndex, length: normalInstallmentsParsed.length });
                showToast("Erro: Parcela não encontrada.", "error");
                return;
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

            updatedFields = {
                installments: JSON.stringify(normalInstallmentsParsed),
                valuePaidClient: newValuePaid,
                balanceDueClient: newBalanceDue,
                statusPaymentClient: newOverallStatus,
            };
        } else {
            console.error("Tentativa de atualizar parcela de forma inválida (nem shared com personKey, nem normal).", { isShared: loanToUpdate.isShared, personKey });
            showToast("Erro: Tentativa de atualizar parcela inválida.", "error");
            return;
        }

        try {
            await updateDoc(loanDocRef, updatedFields);
            showToast(`Parcela ${installmentNumber} marcada como paga!`, "success");
            console.log(`Parcela da compra ${originalLoanId} (parte: ${personKey || 'normal'}) atualizada para ${newStatus}.`);
        } catch (error) {
            console.error("Erro ao atualizar status da parcela:", error);
            showToast(`Erro ao marcar parcela como paga: ${error.message}`, "error");
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
                            {clients.filter(c => c.id !== selectedClient1).map(client => ( // Evita selecionar o mesmo cliente
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
                    readOnly={!editingLoan && selectedCard && loanDate} // Torna somente leitura se não estiver editando e as dependências estiverem preenchidas
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
                            onClick={() => {
                                resetForm();
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
                                                            {loanItem.installments.map((installment, index) => (
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

// ####################################################################################
// ## FIM DO COMPONENTE LoanManagement COM AS ALTERAÇÕES
// ####################################################################################


// COMPONENTE DASHBOARD
function Dashboard({ selectedMonth, setSelectedMonth, selectedCardFilter, setSelectedCardFilter, selectedClientFilter, setSelectedClientFilter }) {
    const { db, userId, isAuthReady, theme, getUserCollectionPathSegments, showToast } = useContext(AppContext);
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
     * Compartilha a lógica com LoanManagement para consistência.
     * @param {string} originalLoanId - O ID do documento de empréstimo original.
     * @param {string|null} personKeyOrNull - A chave da pessoa ('person1', 'person2') ou null para compra normal.
     * @param {number} installmentNumber - O número da parcela.
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


    // Efeito para filtrar e sumarizar os dados do dashboard quando loans, clients, cards ou subscriptions mudam
    useEffect(() => {
        if (!isAuthReady || !clients.length || !cards.length) return; 

        const [filterYear, filterMonth] = selectedMonth ? selectedMonth.split('-').map(Number) : [null, null];
        const currentFilterDate = filterYear && filterMonth ? new Date(Date.UTC(filterYear, filterMonth - 1, 1)) : null;
        const todayAtMidnight = new Date();
        todayAtMidnight.setHours(0, 0, 0, 0);

        const allItems = [];

        // --- NOVA FUNÇÃO AUXILIAR PARA CALCULAR O PROGRESSO DA PARCELA ---
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

                // Prioriza parcelas pendentes ou atrasadas
                if (inst.status === 'Pendente') {
                    if (currentFilterDate) {
                        if (instDueDate.getUTCFullYear() > filterYearNum || 
                           (instDueDate.getUTCFullYear() === filterYearNum && instDueDate.getUTCMonth() >= filterMonthNum)) {
                            currentInstallmentNumber = inst.number;
                            foundNextPendingOrOverdue = true;
                            break; 
                        }
                    } else { 
                        if (instDueDate >= todayAtMidnight) {
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
            }

            if (!foundNextPendingOrOverdue) {
                const lastPaid = installmentsArray.filter(inst => inst.status === 'Paga').pop();
                if (lastPaid) {
                    return `${lastPaid.number}/${totalCount}`;
                } else {
                    return totalCount > 0 ? `1/${totalCount}` : `0/${totalCount}`; // Se tem parcelas mas nenhuma paga/pendente atual, mostra 1/Total
                }
            } else {
                return `${currentInstallmentNumber}/${totalCount}`;
            }
        };
        // --- FIM NOVA FUNÇÃO AUXILIAR ---

        // Processa empréstimos (compras) e suas parcelas
        loans.forEach(loan => {
            if (loan.isShared && loan.sharedDetails) {
                if (loan.sharedDetails.person1 && loan.sharedDetails.person1.clientId) {
                    const p1Installments = typeof loan.sharedDetails.person1.installments === 'string' ?
                        JSON.parse(loan.sharedDetails.person1.installments) :
                        loan.sharedDetails.person1.installments || [];
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
                                        installmentsProgress: getInstallmentProgressDisplay(p1Installments, loan.installmentsCount, currentFilterDate) // ATUALIZADO
                                    });
                                }
                            }
                        }
                    });
                }
                if (loan.sharedDetails.person2 && loan.sharedDetails.person2.clientId && loan.sharedDetails.person2.shareAmount > 0) {
                    const p2Installments = typeof loan.sharedDetails.person2.installments === 'string' ?
                        JSON.parse(loan.sharedDetails.person2.installments) :
                        loan.sharedDetails.person2.installments || [];
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
                                        installmentsProgress: getInstallmentProgressDisplay(p2Installments, loan.installmentsCount, currentFilterDate) // ATUALIZADO
                                    });
                                }
                            }
                        }
                    });
                }
            } else if (!loan.isShared) { // Compra normal
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
                                    installmentsProgress: getInstallmentProgressDisplay(normalInstallments, loan.installmentsCount, currentFilterDate) // ATUALIZADO
                                });
                            }
                        }
                    }
                });
            }
        });

        // Processa assinaturas ativas
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

        // Ordena todos os itens por data de vencimento/cobrança
        allItems.sort((a, b) => {
            const dateA = a.type === 'subscription_charge' ? a.sortDate : new Date(a.dueDate + "T00:00:00");
            const dateB = b.type === 'subscription_charge' ? b.sortDate : new Date(b.dueDate + "T00:00:00");
            return dateA - dateB;
        });

        setDisplayableItems(allItems);

        // Calcula os totais para o resumo do dashboard
        const newTotalFatura = allItems.reduce((sum, item) => sum + item.value, 0);
        const newTotalReceived = allItems
            .filter(item => (item.type === 'purchase_installment' && item.currentStatus === 'Paga') || (item.type === 'subscription_charge' && item.currentStatus === 'Paga'))
            .reduce((sum, item) => sum + item.value, 0);
        const newTotalBalanceDue = allItems
            .filter(item => (item.type === 'purchase_installment' && (item.currentStatus === 'Pendente' || item.currentStatus === 'Atrasado')) || (item.type === 'subscription_charge' && item.currentStatus === 'Pendente'))
            .reduce((sum, item) => sum + item.value, 0);
        const newTotalSubscriptions = allItems
            .filter(item => item.type === 'subscription_charge')
            .reduce((sum, item) => sum + item.value, 0);

        setDashboardSummary({
            totalFatura: newTotalFatura,
            totalReceived: newTotalReceived,
            totalBalanceDue: newTotalBalanceDue,
            totalSubscriptions: newTotalSubscriptions,
        });

    }, [loans, clients, cards, subscriptions, selectedMonth, selectedCardFilter, selectedClientFilter, isAuthReady]);

    /**
     * Retorna informações de exibição (nome e cor) para um cartão.
     * @param {string} cardId - O ID do cartão.
     * @returns {{name: string, color: string}} Objeto com nome e cor do cartão.
     */
    const getCardDisplayInfo = (cardId) => {
        const card = cards.find(c => c.id === cardId);
        return card ? { name: card.name, color: card.color || '#cccccc' } : { name: 'N/A', color: '#cccccc' };
    };

    /**
     * Abre o modal de confirmação para marcar todas as parcelas como pagas.
     */
    const confirmMarkAllPaid = () => {
        setIsMarkAllPaidConfirmationOpen(true);
    };

    /**
     * Marca todas as parcelas pendentes do mês filtrado como pagas.
     * Itera sobre `displayableItems` para encontrar as parcelas de compra e atualiza seu status.
     */
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

        const userCollectionPath = getUserCollectionPathSegments();
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
                    <input
                        type="month"
                        id="month-filter"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md"
                    />
                </div>
                <div className="flex flex-col">
                    <label htmlFor="card-filter" className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Filtrar por Cartão:</label>
                    <select
                        id="card-filter"
                        value={selectedCardFilter}
                        onChange={(e) => setSelectedCardFilter(e.target.value)}
                        className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md"
                    >
                        <option value="">Todos os Cartões</option>
                        {cards.map(card => (
                            <option key={card.id} value={card.id} style={{ backgroundColor: card.color, color: theme === 'dark' ? (['#000000', '#5E60CE'].includes(card.color) ? 'white' : 'black') : (['#FFFFFF', '#FFFFFF'].includes(card.color) ? 'black' : 'inherit') }}>
                                {card.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col">
                    <label htmlFor="client-filter" className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Filtrar por Pessoa:</label>
                    <select
                        id="client-filter"
                        value={selectedClientFilter}
                        onChange={(e) => setSelectedClientFilter(e.target.value)}
                        className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md"
                    >
                        <option value="">Todas as Pessoas</option>
                        {clients.map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
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
                                        <button
                                            type="button"
                                            onClick={confirmMarkAllPaid}
                                            className="ml-2 bg-purple-500 text-white px-2 py-1 rounded-md hover:bg-purple-600 transition duration-300 text-xs dark:bg-purple-700 dark:hover:bg-purple-800 whitespace-nowrap"
                                            title="Marcar todas as parcelas pendentes/atrasadas deste mês como pagas"
                                        >
                                            Marcar Tudo Pago
                                        </button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {displayableItems.map((item) => {
                                    const cardInfo = getCardDisplayInfo(item.cardId);
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                {item.type === 'purchase_installment' ? 'Parcela Compra' : 'Assinatura'}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{item.description}</td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                {item.clientId ? (clients.find(c => c.id === item.clientId)?.name || 'N/A') : 'N/A'}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300 flex items-center">
                                                <span
                                                    className="w-4 h-4 rounded-sm mr-2 inline-block"
                                                    style={{ backgroundColor: cardInfo.color }}
                                                    title={`Cor: ${cardInfo.color}`}
                                                ></span>
                                                {cardInfo.name}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{formatCurrencyDisplay(item.value)}</td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{item.dueDate}</td>
                                            <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                {item.installmentsProgress}
                                            </td>
                                            <td className={`py-3 px-4 whitespace-nowrap font-semibold ${
                                                item.currentStatus === 'Paga' ? 'text-green-600 dark:text-green-400' :
                                                    item.currentStatus === 'Atrasado' ? 'text-red-600 dark:text-red-400' :
                                                        item.currentStatus === 'Recorrente' ? 'text-purple-600 dark:text-purple-400' :
                                                            'text-yellow-600 dark:text-yellow-400'
                                                            }`}>
                                                {item.currentStatus}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {item.type === 'purchase_installment' && item.currentStatus !== 'Paga' && item.originalLoanStatus !== 'Pago Total' && (
                                                    <button
                                                        onClick={() => handleMarkInstallmentAsPaidDashboard(item.loanId, item.personKey, item.number)}
                                                        className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition duration-300 text-sm dark:bg-blue-700 dark:hover:bg-blue-800"
                                                    >
                                                        Marcar Paga
                                                    </button>
                                                )}
                                                {item.type === 'subscription_charge' && (
                                                    <span className="text-sm text-gray-500 dark:text-gray-400 italic">Gerenciar na aba Assinaturas</span>
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
            {/* Modal de Confirmação para Marcar Todas as Parcelas como Pagas */}
            <GenericModal
                isOpen={isMarkAllPaidConfirmationOpen}
                onClose={() => setIsMarkAllPaidConfirmationOpen(false)}
                onConfirm={handleMarkAllInstallmentsAsPaid}
                title="Confirmar Ação"
                message={`Tem certeza que deseja marcar TODAS as parcelas pendentes ou atrasadas do mês ${selectedMonth} como PAGAS? Esta ação é irreversível.`}
                isConfirmation={true}
                theme={theme}
            />
        </div>
    );
}

export default App;