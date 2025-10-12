import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyFontVariables } from './styles/fonts'

applyFontVariables()

createRoot(document.getElementById("root")!).render(<App />);
