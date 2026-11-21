import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { LorryDataProvider } from './context/LorryDataContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <LorryDataProvider>
        <App />
      </LorryDataProvider>
    </AuthProvider>
  </React.StrictMode>
);
