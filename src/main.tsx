import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/stix-two-text/400.css'
import '@fontsource/stix-two-text/400-italic.css'
import './styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
