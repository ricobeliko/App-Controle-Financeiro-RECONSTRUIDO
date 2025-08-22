import React from 'react';

// Um componente de spinner de carregamento simples usando Tailwind CSS
export default function Spinner() {
  return (
    <div className="border-4 border-gray-200 border-t-blue-500 rounded-full w-12 h-12 animate-spin"></div>
  );
}
