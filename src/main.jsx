import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@ant-design/v5-patch-for-react-19';
import App from './App.jsx'
import { AuthContextProvider } from './context/AuthContext.jsx'
import { SettingsProvider } from './context/SettingsContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthContextProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </AuthContextProvider>
  </StrictMode>,
)
