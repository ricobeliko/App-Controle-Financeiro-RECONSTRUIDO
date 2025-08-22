// src/features/landing/LandingPage.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// --- Ícones embutidos como componentes React ---

const MenuIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
);

const XIcon = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

const FinControlLogo = ({ className }) => (
    <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);


const FeatureIcon = ({ children }) => (
    <div className="bg-purple-200/10 text-purple-400 rounded-lg h-12 w-12 flex items-center justify-center mb-4 mx-auto">
        {children}
    </div>
);

const ChartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>;
const CreditCardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>;
const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;


// --- Componente Principal da Landing Page ---

export default function LandingPage() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    const navigate = useNavigate();
    const handleLoginClick = () => navigate('/login');
    const handleRegisterClick = () => navigate('/login');
    const handleUpgrade = () => navigate('/login');


    return (
        <div className="bg-[#1e1e1e] text-gray-300 font-sans antialiased">
            
            {/* Cabeçalho */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#1e1e1e]/80 backdrop-blur-sm border-b border-gray-800">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex-shrink-0">
                            {/* AJUSTE: Fonte trocada para "Roboto" */}
                            <a href="#" className="flex items-center gap-2 text-white hover:text-purple-400 transition-colors">
                                <FinControlLogo className="text-purple-500" />
                                <span className="text-2xl font-roboto font-bold tracking-wider">FinControl</span>
                            </a>
                        </div>
                        <nav className="hidden md:flex md:items-center md:space-x-8">
                            <a href="#features" className="text-gray-400 hover:text-white transition">Recursos</a>
                            <a href="#pricing" className="text-gray-400 hover:text-white transition">Preços</a>
                        </nav>
                        <div className="hidden md:flex items-center space-x-2">
                            <button onClick={handleLoginClick} className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 rounded-md transition">Entrar</button>
                            <button onClick={handleRegisterClick} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md shadow-sm transition">Crie sua conta</button>
                        </div>
                        <div className="md:hidden flex items-center">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-md text-gray-400 hover:bg-gray-800">
                                {isMenuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                </div>
                {/* Menu Mobile */}
                {isMenuOpen && (
                    <div className="md:hidden bg-[#1e1e1e] border-t border-gray-800">
                        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                            <a href="#features" className="block px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:bg-gray-800">Recursos</a>
                            <a href="#pricing" className="block px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:bg-gray-800">Preços</a>
                        </div>
                        <div className="pt-4 pb-3 border-t border-gray-800">
                            <div className="px-2 space-y-2">
                                <button onClick={handleRegisterClick} className="block w-full text-center px-4 py-2 text-base font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md shadow-sm transition">Crie sua conta</button>
                                <button onClick={handleLoginClick} className="block w-full text-center px-4 py-2 text-base font-medium text-gray-300 hover:bg-gray-800 rounded-md transition">Já tem uma conta? Entrar</button>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            <main>
                {/* Seção Hero */}
                <section className="pt-24 md:pt-32 pb-16 md:pb-24">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white">
                            O controle financeiro para seus cartões,
                            <span className="block text-purple-500">simples e visual.</span>
                        </h1>
                        <p className="mt-4 max-w-2xl mx-auto text-lg md:text-xl text-gray-400">
                            Pare de se perder em planilhas. Visualize suas faturas, gerencie compras compartilhadas e tenha clareza total dos seus gastos mensais.
                        </p>
                        <div className="mt-8 flex justify-center">
                            <button onClick={handleRegisterClick} className="px-8 py-3 text-lg font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-lg transform hover:scale-105 transition">
                                Comece agora, é grátis!
                            </button>
                        </div>
                    </div>
                </section>

                {/* Seção de Recursos */}
                <section id="features" className="py-16 md:py-24 bg-black/20">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold text-white">Tudo o que você precisa em um só lugar</h2>
                            <p className="mt-4 text-lg text-gray-400">Ferramentas poderosas para descomplicar sua vida financeira.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                            <div className="text-center">
                                <FeatureIcon><CreditCardIcon /></FeatureIcon>
                                <h3 className="text-xl font-semibold mb-2 text-white">Gestão de Faturas</h3>
                                <p className="text-gray-400">Saiba exatamente o valor da sua fatura antes dela fechar. Adicione compras, despesas e assinaturas com facilidade.</p>
                            </div>
                            <div className="text-center">
                                <FeatureIcon><UsersIcon /></FeatureIcon>
                                <h3 className="text-xl font-semibold mb-2 text-white">Compras Compartilhadas</h3>
                                <p className="text-gray-400">Dividiu uma compra? Registre o valor de cada pessoa e controle quem te deve o quê, parcela por parcela.</p>
                            </div>
                            <div className="text-center">
                                <FeatureIcon><ChartIcon /></FeatureIcon>
                                <h3 className="text-xl font-semibold mb-2 text-white">Relatórios Visuais</h3>
                                <p className="text-gray-400">Com os recursos Pro, visualize gráficos que mostram para onde seu dinheiro está indo e tome decisões mais inteligentes.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Seção de Preços */}
                <section id="pricing" className="py-16 md:py-24">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold text-white">Um plano para cada necessidade</h2>
                            <p className="mt-4 text-lg text-gray-400">Comece de graça e evolua quando estiver pronto.</p>
                        </div>
                        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Plano Free */}
                            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 flex flex-col">
                                <h3 className="text-2xl font-semibold text-white">Free</h3>
                                <p className="mt-4 text-gray-400">O essencial para começar a organizar suas finanças hoje mesmo.</p>
                                <div className="mt-6">
                                    <span className="text-4xl font-bold text-white">R$0</span>
                                    <span className="text-lg font-medium text-gray-400">/mês</span>
                                </div>
                                <ul className="mt-8 space-y-4 text-gray-300">
                                    <li className="flex items-start"><span className="text-green-500 mt-1 mr-3 flex-shrink-0"><CheckIcon /></span><span>Gerenciamento de Pessoas</span></li>
                                    <li className="flex items-start"><span className="text-green-500 mt-1 mr-3 flex-shrink-0"><CheckIcon /></span><span>Gerenciamento de Cartões</span></li>
                                    <li className="flex items-start"><span className="text-green-500 mt-1 mr-3 flex-shrink-0"><CheckIcon /></span><span>Registro de Compras</span></li>
                                </ul>
                                <div className="mt-8">
                                    <button onClick={handleRegisterClick} className="w-full px-6 py-3 text-lg font-medium text-purple-300 bg-purple-600/20 hover:bg-purple-600/30 rounded-lg transition">Comece Grátis</button>
                                </div>
                            </div>
                            {/* Plano Pro */}
                            <div className="bg-gray-900/50 border-2 border-purple-600 rounded-lg p-8 flex flex-col relative">
                                <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
                                    <span className="px-3 py-1 text-sm font-semibold tracking-wide text-white bg-purple-600 rounded-full">MAIS POPULAR</span>
                                </div>
                                <h3 className="text-2xl font-semibold text-white">Pro</h3>
                                <p className="mt-4 text-gray-400">Desbloqueie todo o potencial com relatórios e recursos avançados.</p>
                                <div className="mt-6">
                                    <span className="text-4xl font-bold text-white">R$9,90</span>
                                    <span className="text-lg font-medium text-gray-400">/mês</span>
                                </div>
                                <ul className="mt-8 space-y-4 text-gray-300">
                                    <li className="flex items-start"><span className="text-green-500 mt-1 mr-3 flex-shrink-0"><CheckIcon /></span><span className="font-semibold">Tudo do plano Free, e mais:</span></li>
                                    <li className="flex items-start"><span className="text-green-500 mt-1 mr-3 flex-shrink-0"><CheckIcon /></span><span>Registro de Receitas e Despesas</span></li>
                                    <li className="flex items-start"><span className="text-green-500 mt-1 mr-3 flex-shrink-0"><CheckIcon /></span><span>Relatórios e Gráficos Avançados</span></li>
                                    <li className="flex items-start"><span className="text-green-500 mt-1 mr-3 flex-shrink-0"><CheckIcon /></span><span>Balanço Mensal (Receitas vs. Despesas)</span></li>
                                </ul>
                                <div className="mt-auto pt-8">
                                    <button onClick={handleUpgrade} className="w-full px-6 py-3 text-lg font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-lg transition">Tornar-se Pro</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Rodapé */}
            <footer className="bg-black/20 border-t border-gray-800">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-500">
                    <p>&copy; {new Date().getFullYear()} FinControl. Todos os direitos reservados.</p>
                </div>
            </footer>
        </div>
    );
}
