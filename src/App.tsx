import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/Toaster';
import { WorkspaceProvider } from '@/state/WorkspaceProvider';
import { AuthProvider } from '@/state/AuthProvider';
import { AppRoutes } from '@/routes';

export default function App() {
  return (
    <BrowserRouter>
      {/* Auth wraps the workspace store so sign-in can seed the store from the Firebase user. */}
      <AuthProvider>
        <WorkspaceProvider>
          <AppRoutes />
          <Toaster />
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
