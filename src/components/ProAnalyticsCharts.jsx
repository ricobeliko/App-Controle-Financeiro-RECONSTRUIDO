// src/components/ProAnalyticsCharts.jsx

import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Componente que contém os gráficos da versão Pro
const ProAnalyticsCharts = ({ loans, clients, theme }) => {
    // A lógica para processar os dados para o gráfico está correta
    const dataForChart = clients.map(client => {
        const totalSpent = loans
            .filter(loan => 
                (!loan.isShared && loan.clientId === client.id) ||
                (loan.isShared && (loan.sharedDetails.person1?.clientId === client.id || loan.sharedDetails.person2?.clientId === client.id))
            )
            .reduce((acc, loan) => {
                if (!loan.isShared) {
                    return acc + loan.totalValue;
                }
                if (loan.sharedDetails.person1?.clientId === client.id) {
                    return acc + loan.sharedDetails.person1.shareAmount;
                }
                if (loan.sharedDetails.person2?.clientId === client.id) {
                    return acc + loan.sharedDetails.person2.shareAmount;
                }
                return acc;
            }, 0);
        
        return { name: client.name, 'Total Gasto': totalSpent };
    }).filter(item => item['Total Gasto'] > 0);

    const textColor = theme === 'dark' ? '#A3A3A3' : '#333';

    return (
        <div className="mt-8 p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-lg">
            <h3 className="text-xl font-bold text-blue-700 dark:text-blue-400 mb-4">Análise de Gastos por Pessoa (Pro)</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dataForChart} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#4A5568' : '#E2E8F0'}/>
                    <XAxis dataKey="name" tick={{ fill: textColor }} />
                    <YAxis tick={{ fill: textColor }} />
                    <Tooltip 
                        cursor={{fill: theme === 'dark' ? 'rgba(124, 58, 237, 0.2)' : 'rgba(200, 200, 255, 0.3)'}}
                        contentStyle={{ 
                            backgroundColor: theme === 'dark' ? '#2D3748' : '#FFFFFF', 
                            border: `1px solid ${theme === 'dark' ? '#4A5568' : '#E2E8F0'}`
                        }}
                    />
                    <Legend />
                    <Bar dataKey="Total Gasto" fill="#8884d8" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

// ⚠️ CORREÇÃO: Exportando o componente correto
export default ProAnalyticsCharts;