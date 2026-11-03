import { createRoot } from 'react-dom/client';
import AdminApp from './admin/AdminApp';
import './index.css';

createRoot(document.getElementById('admin-root')!).render(<AdminApp />);
