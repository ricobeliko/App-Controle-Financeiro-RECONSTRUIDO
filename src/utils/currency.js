/**
 * Formata um número para exibição em moeda BRL.
 * @param {number} value - O valor numérico a ser formatado.
 * @returns {string} O valor formatado como string BRL (Ex: R$ 1.234,56).
 */
export const formatCurrencyDisplay = (value) => {
    if (typeof value !== 'number' || isNaN(value)) {
        return 'R$ 0,00';
    }
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Analisa uma string de entrada de moeda BRL para um número.
 * @param {string} inputString - A string de entrada da moeda (Ex: "1.234,56").
 * @returns {number} O valor numérico analisado.
 */
export const parseCurrencyInput = (inputString) => {
    if (typeof inputString !== 'string') {
        return 0;
    }
    // Remove "R$", espaços, e separadores de milhares (ponto), e substitui a vírgula decimal por ponto.
    const cleanedString = inputString.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
    const parsed = parseFloat(cleanedString);
    return isNaN(parsed) ? 0 : parsed;
};

/**
 * Manipulador de eventos para campos de entrada de moeda.
 * Garante que apenas dígitos e vírgulas sejam permitidos.
 * @param {function} setter - A função setState do React para atualizar o valor.
 * @returns {function} Um manipulador de eventos onChange.
 */
export const handleCurrencyInputChange = (setter) => (e) => {
    let value = e.target.value;
    // Permite apenas dígitos e vírgulas
    value = value.replace(/[^\d,]/g, '');

    // Garante apenas uma vírgula
    const commaIndex = value.indexOf(',');
    if (commaIndex !== -1) {
        const afterComma = value.substring(commaIndex + 1).replace(/,/g, '');
        value = value.substring(0, commaIndex + 1) + afterComma;
    }
    
    setter(value);
};