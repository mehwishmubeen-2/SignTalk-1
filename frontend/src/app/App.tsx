import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { ActiveCallProvider } from './context/ActiveCallContext';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <AuthProvider>
      <ActiveCallProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </ActiveCallProvider>
    </AuthProvider>
  );
}

export default App;
