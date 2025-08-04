import React from 'react';

/**
 * Componente de Modal Genérico para confirmação ou informação.
 */
function GenericModal({ isOpen, onClose, title, message, isConfirmation = false, onConfirm, theme }) {
    if (!isOpen) return null;

    // Lógica para determinar as cores com base no tema
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

export default GenericModal;
