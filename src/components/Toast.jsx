import React, { useEffect } from 'react';
import { useAppContext } from '../context/AppContext'; // Importa o hook para acessar o contexto

function Toast() {
    // Pega a mensagem e a função para limpar do contexto global
    const { toastMessage, clearToast } = useAppContext();

    // Este efeito cuida de fechar o toast automaticamente
    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => {
                clearToast();
            }, 3000); // Fecha automaticamente após 3 segundos
            return () => clearTimeout(timer);
        }
    }, [toastMessage, clearToast]);

    // Se não houver mensagem, o componente não renderiza nada
    if (!toastMessage) {
        return null;
    }

    // Lógica para definir as cores com base no tipo de mensagem
    let bgColorClass, textColorClass, borderColorClass;
    switch (toastMessage.type) {
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
            <p className="text-sm font-medium">{toastMessage.text}</p>
            <button onClick={clearToast} className="ml-4 p-1 rounded-full hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}

export default Toast;
