import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { AppShell } from '@/components/layout/AppShell';
import { NotFoundPage } from '@/features/errors/NotFoundPage';
import { RedirectIfAuthenticated, RequireAuth } from './guards';

const OverviewPage = lazy(() => import('@/features/overview/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const DatasetsPage = lazy(() => import('@/features/datasets/DatasetsPage').then((m) => ({ default: m.DatasetsPage })));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const ScenariosPage = lazy(() => import('@/features/scenarios/ScenariosPage').then((m) => ({ default: m.ScenariosPage })));
const HistoryPage = lazy(() => import('@/features/history/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SecurityPage = lazy(() => import('@/features/security/SecurityPage').then((m) => ({ default: m.SecurityPage })));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SignInPage = lazy(() => import('@/features/auth/SignInPage').then((m) => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import('@/features/auth/SignUpPage').then((m) => ({ default: m.SignUpPage })));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));

export function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <SignInPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/signup"
            element={
              <RedirectIfAuthenticated>
                <SignUpPage />
              </RedirectIfAuthenticated>
            }
          />
          {/* The two halves of the password reset. Neither is wrapped in `RedirectIfAuthenticated`:
              `/reset-password` is opened from an email link, so the visitor may well already have a
              live session, and bouncing them to the dashboard would strand them mid-reset. Both
              screens are self-contained, so there is nothing behind them to protect. */}
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                {/* The shell lives inside the guard so the auth screens render full-bleed
                    without the sidebar, topbar or page title chrome. */}
                <AppShell>
                  <Routes>
                    <Route path="/" element={<OverviewPage />} />
                    <Route path="/datasets" element={<DatasetsPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/scenarios" element={<ScenariosPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/security" element={<SecurityPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </AppShell>
              </RequireAuth>
            }
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
