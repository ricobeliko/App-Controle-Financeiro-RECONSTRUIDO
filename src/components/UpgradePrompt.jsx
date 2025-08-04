import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useAppContext } from '../context/AppContext'; 
import { functions, auth } from '../utils/firebase'; 

const UpgradePrompt = () => {
    const { showToast } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);

    const handleUpgradeClick = async () => {
        if (!auth.currentUser) {
            showToast("Você precisa estar logado para fazer o upgrade.", "error");
            return;
        }

        setIsLoading(true);
        showToast("Conectando com o checkout...", "info");

        try {
            await auth.currentUser.getIdToken(true);

            const createStripeCheckout = httpsCallable(functions, 'createStripeCheckout');
            const result = await createStripeCheckout();
            
            if (!result?.data?.url) {
              throw new Error("A resposta da função não contém 'url'");
            }
            
            const { url } = result.data;
            window.location.href = url;
            
        } catch (error) {
            console.error("Erro ao chamar a Cloud Function de checkout:", error);
            
            const errorMessage = error.message.includes("unauthenticated") 
                ? "Você precisa estar logado para fazer o upgrade."
                : "Erro ao iniciar o pagamento. Tente novamente.";

            showToast(errorMessage, "error");
            setIsLoading(false);
        }
    };

    return (
        <div className="mt-8 p-6 border-2 border-dashed border-yellow-500 rounded-lg text-center bg-yellow-50 dark:bg-gray-800 shadow-inner">
            <h3 className="text-xl font-bold text-yellow-700 dark:text-yellow-400">Recurso Exclusivo para Assinantes Pro!</h3>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
                Acesse gráficos e análises avançadas para entender melhor suas finanças.
            </p>
            <button 
                onClick={handleUpgradeClick}
                disabled={isLoading}
                className="mt-4 bg-yellow-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-yellow-600 transition-transform transform hover:scale-105 shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {isLoading ? 'Aguarde...' : 'Fazer Upgrade Agora'}
            </button>
        </div>
    );
};

export default UpgradePrompt;
