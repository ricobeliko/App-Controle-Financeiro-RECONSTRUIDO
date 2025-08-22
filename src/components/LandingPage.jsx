import React from 'react';

// Ícones para a seção de recursos
const FeatureIcon1 = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-white"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const FeatureIcon2 = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-white"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
);
const FeatureIcon3 = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-white"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);

function LandingPage({ onLogin }) {
  return (
    <div className="bg-gray-900 text-white font-sans">
      {/* Cabeçalho */}
      <header className="py-4 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h1 className="text-xl font-bold">FinControl</h1>
        </div>
        <button onClick={onLogin} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300">
          Entrar
        </button>
      </header>

      {/* Seção Principal (Hero) */}
      <main className="text-center py-20 px-6">
        <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
          O controle financeiro do seu cartão, <br className="hidden md:block" /> simplificado e poderoso.
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
          Organize suas compras, gerencie assinaturas e tenha uma visão clara de seus gastos mensais com uma ferramenta intuitiva e eficaz.
        </p>
        <button onClick={onLogin} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 transform hover:scale-105">
          Comece a usar agora
        </button>
      </main>

      {/* Seção de Recursos */}
      <section className="py-20 bg-gray-800">
        <div className="container mx-auto px-6">
          <h3 className="text-3xl font-bold text-center mb-12">Recursos Principais</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-900 p-8 rounded-lg text-center">
              <div className="bg-blue-500 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <FeatureIcon1 />
              </div>
              <h4 className="text-xl font-bold mb-2">Gerenciamento de Despesas</h4>
              <p className="text-gray-400">
                Cadastre suas compras normais ou compartilhadas, definindo cartões, valores e parcelas de forma simples.
              </p>
            </div>
            <div className="bg-gray-900 p-8 rounded-lg text-center">
              <div className="bg-blue-500 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <FeatureIcon2 />
              </div>
              <h4 className="text-xl font-bold mb-2">Controle de Cartões</h4>
              <p className="text-gray-400">
                Adicione múltiplos cartões de crédito, com seus respectivos limites, datas de fechamento e vencimento.
              </p>
            </div>
            <div className="bg-gray-900 p-8 rounded-lg text-center">
              <div className="bg-blue-500 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <FeatureIcon3 />
              </div>
              <h4 className="text-xl font-bold mb-2">Relatórios por Pessoa</h4>
              <p className="text-gray-400">
                Gere relatórios detalhados por pessoa para visualizar o saldo devedor e os compromissos mensais.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Chamada para Ação */}
      <section className="text-center py-20 px-6">
        <h3 className="text-3xl font-bold mb-4">Pronto para assumir o controle?</h3>
        <p className="text-lg text-gray-400 max-w-xl mx-auto mb-8">
          Junte-se a nós e transforme a maneira como você gerencia suas finanças no cartão de crédito.
        </p>
        <button onClick={onLogin} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 transform hover:scale-105">
          Criar minha conta
        </button>
      </section>

      {/* Rodapé */}
      <footer className="py-6 text-center text-gray-500 border-t border-gray-800">
        <p>&copy; {new Date().getFullYear()} FinControl. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

export default LandingPage;