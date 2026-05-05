import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, readTheme } from './theme';
import './styles/tokens.css';
import './styles/app.css';

function RootApp() {
  const [theme, setTheme] = useState(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <App
      initialTheme={theme}
      onToggleTheme={() => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
      }}
    />
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
