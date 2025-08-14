// src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
// Importa o AppProvider do local correto
import { AppProvider } from './context/AppContext'; 
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* O AppProvider agora envolve o App, fornecendo o contexto para ele e todos os seus filhos */}
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);