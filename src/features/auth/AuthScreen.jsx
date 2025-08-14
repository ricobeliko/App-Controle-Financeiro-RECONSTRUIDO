// src/features/auth/AuthScreen.jsx

import React, { useState, useEffect, useRef } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
// 1. IMPORTAÇÃO CORRIGIDA
// Agora importa o hook useAppContext do local centralizado.
import { useAppContext } from '../../context/AppContext';

function AuthScreen() {
    // 2. USO CORRETO DO HOOK
    // Pegando o que precisamos do contexto global usando o hook.
    const { auth, db, currentUser, getUserCollectionPathSegments } = useAppContext();

    // Estados que controlam o formulário e as mensagens
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
    const [loginSuggestion, setLoginSuggestion] = useState('');

    // Efeito para carregar o e-mail lembrado ao iniciar
    useEffect(() => {
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    const showAuthError = (message) => {
        setAuthError(message);
        setTimeout(() => setAuthError(''), 5000);
    };

    // --- FUNÇÕES DE AUTENTICAÇÃO ---

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
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);

            const userCollectionPath = getUserCollectionPathSegments();
            const userDocRef = doc(db, ...userCollectionPath, userCredential.user.uid);
            await setDoc(userDocRef, {
                name: userName,
                email: email,
                createdAt: new Date(),
                plan: 'free'
            }, { merge: true });

            setAuthMessage('🎉 Quase lá! Enviamos um e-mail de verificação para você. Em instantes, você será redirecionado.');

            setTimeout(async () => {
                await signOut(auth);
                setAuthMessage('');
                setIsRegistering(false);
                setPostRegistrationMessage('🎉 Falta Pouco! Por favor, verifique sua caixa de entrada e spam para fazer login!');
            }, 10000);

            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setUserName('');

        } catch (error) {
            console.error("Erro no cadastro:", error);
            if (error.code === 'auth/email-already-in-use') {
                showAuthError('Este e-mail já está em uso. Tente fazer login ou use outro e-mail.');
            } else {
                showAuthError(`Erro no cadastro: ${error.message}`);
            }
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthError('');
        setAuthMessage('');
        setPostRegistrationMessage(null);

        let authEmailResolved = email;
        const isEmailFormat = /\S+@\S+\.\S+/.test(email);

        try {
            if (!isEmailFormat) {
                const userCollectionPathPrefix = getUserCollectionPathSegments();
                // O caminho da coleção de usuários é um nível acima do caminho do usuário individual
                const usersRef = collection(db, ...userCollectionPathPrefix);
                const q = query(usersRef, where('name', '==', email));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    showAuthError('Usuário (login) não encontrado. Verifique o seu login ou utilize o seu e-mail.');
                    return;
                }
                authEmailResolved = querySnapshot.docs[0].data().email;
            }

            await setPersistence(auth, browserLocalPersistence);
            const userCredential = await signInWithEmailAndPassword(auth, authEmailResolved, password);

            if (!userCredential.user.emailVerified) {
                // A mensagem de verificação será mostrada pelo listener no App.jsx
                return;
            }

            if (rememberMeCheckboxRef.current?.checked) {
                localStorage.setItem('rememberedEmail', authEmailResolved);
            } else {
                localStorage.removeItem('rememberedEmail');
            }
        } catch (error) {
            console.error("Erro no login:", error);
             if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                showAuthError('E-mail/Login ou senha inválidos.');
            } else {
                showAuthError(`Erro no login: ${error.message}`);
            }
        }
    };
    
    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Erro ao sair:", error);
            showAuthError(`Erro ao sair: ${error.message}`);
        }
    };

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

    const handleSuggestionClick = () => {
        if (loginSuggestion) {
            setEmail(loginSuggestion);
            setLoginSuggestion('');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-3xl font-bold text-center mb-6 text-gray-800 dark:text-gray-100">
                    {isRegistering ? 'Registrar' : 'Entrar'}
                </h2>
                {authError && <div className="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{authError}</div>}
                {authMessage && <div className="bg-green-100 border border-green-400 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">{authMessage}</div>}
                {postRegistrationMessage && <div className="bg-blue-100 border border-blue-400 text-blue-700 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-300 px-4 py-3 rounded-lg mb-4 text-sm">{postRegistrationMessage}</div>}

                {currentUser && !currentUser.emailVerified && !isRegistering && !authMessage && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                        Seu e-mail (<span className="font-semibold">{currentUser.email}</span>) ainda não foi verificado. Por favor, verifique sua caixa de entrada e spam.
                        <button onClick={async () => { try { await sendEmailVerification(currentUser); setAuthMessage('🚀 Novo e-mail de verificação enviado!'); setTimeout(() => handleLogout(), 5000); } catch (error) { showAuthError(`Erro: ${error.message}`); } }} className="block w-full mt-3 bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600">Reenviar E-mail</button>
                        <button onClick={handleLogout} className="block w-full mt-2 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600">Sair</button>
                    </div>
                )}

                {!(currentUser && !currentUser.emailVerified) && (
                    <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
                        {isRegistering && (
                            <input type="text" placeholder="Seu Login (nome de usuário)" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700" required />
                        )}
                        <div className="relative">
                            <input type="text" placeholder="Seu E-mail ou Login" value={email} onChange={handleEmailInputChange} className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700" required autoComplete="username" />
                            {loginSuggestion && (
                                <div onClick={handleSuggestionClick} className="absolute z-10 w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-b-lg shadow-lg cursor-pointer">
                                    <div className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 text-sm text-gray-700 dark:text-gray-200">{loginSuggestion}</div>
                                </div>
                            )}
                        </div>
                        <input type="password" placeholder="Sua Senha (mínimo 8 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700" required autoComplete={isRegistering ? "new-password" : "current-password"} />
                        {isRegistering && (
                            <input type="password" placeholder="Repita a Senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700" required autoComplete="new-password" />
                        )}
                        {!isRegistering && (
                            <div className="flex items-center">
                                <input type="checkbox" id="rememberMe" ref={rememberMeCheckboxRef} checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                                <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-900 dark:text-gray-300">Lembrar meu e-mail</label>
                            </div>
                        )}
                        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md">{isRegistering ? 'Registrar' : 'Entrar'}</button>
                    </form>
                )}

                {!(currentUser && !currentUser.emailVerified) && (
                    <p className="mt-6 text-center text-gray-600 dark:text-gray-300">
                        {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}
                        <button onClick={() => { setIsRegistering(prev => !prev); setAuthError(''); setAuthMessage(''); setPostRegistrationMessage(null); setPassword(''); setConfirmPassword(''); setUserName(''); setLoginSuggestion(''); }} className="text-blue-600 hover:underline ml-2 dark:text-blue-400">
                            {isRegistering ? 'Iniciar Sessão' : 'Registre-se'}
                        </button>
                    </p>
                )}
            </div>
        </div>
    );
}

export default AuthScreen;
