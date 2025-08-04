import React from 'react';
import ReactDOM from 'react-dom/client';
import AppWrapper from './App'; // Importa o AppWrapper que criámos
import { AppProvider } from './context/AppContext';
import './index.css'; // ✅ Garanta que esta linha está aqui

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <AppWrapper />
    </AppProvider>
  </React.StrictMode>
);
