import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/theme.css';
import useTheme from './hooks/useTheme';

function ThemeBootstrap({ children }) {
  useTheme();
  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeBootstrap>
      <App />
    </ThemeBootstrap>
  </React.StrictMode>
);
