/**
 * Hydra Admin UI — Entry Point
 *
 * Bootstraps the Lit-based admin interface for Ory Hydra client management.
 */

// Import all components to register them as custom elements
import './app.js';
import './components/common/toast.js';
import './components/common/btn.js';
import './components/common/card.js';
import './components/common/confirm.js';
import './components/common/secret-display.js';
import './components/layout/header.js';
import './components/layout/sidebar.js';
import './components/layout/app-layout.js';
import './components/clients/client-table.js';
import './components/clients/client-form.js';
import './components/clients/client-detail.js';
import './pages/server-picker.js';
import './pages/home.js';
import './pages/client-list.js';
import './pages/client-new.js';
import './pages/client-edit.js';
import './pages/client-view.js';
import './pages/import-export.js';
import './pages/tokens.js';
import './pages/settings.js';
import './pages/login.js';

// Ensure toast container exists in DOM
const toastRoot = document.createElement('hydra-toast-root');
document.body.appendChild(toastRoot);

console.log('🦅 Hydra Admin UI initialized');
