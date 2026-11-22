import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { LorryDataProvider } from './context/LorryDataContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <LorryDataProvider>
          <App />
        </LorryDataProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
