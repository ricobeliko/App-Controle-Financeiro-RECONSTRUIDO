/**
 * Função de fallback para copiar texto para a área de transferência usando document.execCommand.
 * Necessário porque navigator.clipboard.writeText pode não funcionar em iframes.
 * @param {string} textToCopy - O texto a ser copiado.
 * @returns {boolean} True se a cópia foi bem-sucedida, false caso contrário.
 */
export const copyTextToClipboardFallback = (textToCopy) => {
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