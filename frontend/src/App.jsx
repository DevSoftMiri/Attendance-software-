import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppRouter from './routes/AppRouter';

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRouter />
                <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
            </AuthProvider>
        </BrowserRouter>
    );
}
