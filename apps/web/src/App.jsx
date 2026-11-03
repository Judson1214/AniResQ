import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AuthInitializer } from "@/components/auth/AuthInitializer";
import { UserRole } from "@aniresq/shared-types";

const HomePage = lazy(() => import("@/pages/HomePage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const AnimalsPage = lazy(() => import("@/pages/AnimalsPage"));
const AnimalDetailPage = lazy(() => import("@/pages/AnimalDetailPage"));
const RescueListPage = lazy(() => import("@/pages/RescueListPage"));
const RescueDetailPage = lazy(() => import("@/pages/RescueDetailPage"));
const ReportRescuePage = lazy(() => import("@/pages/ReportRescuePage"));
const LostFoundPage = lazy(() => import("@/pages/LostFoundPage"));
const AdoptionPage = lazy(() => import("@/pages/AdoptionPage"));
const DonationPage = lazy(() => import("@/pages/DonationPage"));
const SurrenderPage = lazy(() => import("@/pages/SurrenderPage"));
const MyApplicationsPage = lazy(() => import("@/pages/MyApplicationsPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const UnauthorizedPage = lazy(() => import("@/pages/UnauthorizedPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
  </div>
);

const RESPONDER_ROLES = [
  UserRole.ADMIN,
  UserRole.VOLUNTEER,
  UserRole.SHELTER,
  UserRole.NGO,
  UserRole.VET,
];

function App() {
  return (
    <>
      <AuthInitializer />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/animals" element={<AnimalsPage />} />
          <Route path="/animals/:id" element={<AnimalDetailPage />} />
          <Route path="/lost-found" element={<LostFoundPage />} />
          <Route path="/donate" element={<DonationPage />} />

          {/* Protected Routes - Any authenticated user */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report-rescue"
            element={
              <ProtectedRoute>
                <ReportRescuePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/adoption/:animalId"
            element={
              <ProtectedRoute>
                <AdoptionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/surrender"
            element={
              <ProtectedRoute>
                <SurrenderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-applications"
            element={
              <ProtectedRoute>
                <MyApplicationsPage />
              </ProtectedRoute>
            }
          />

          {/* Responder / Staff Protected Routes (Active SOS alerts and maps) */}
          <Route
            path="/rescue"
            element={
              <ProtectedRoute allowedRoles={RESPONDER_ROLES}>
                <RescueListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rescue/:id"
            element={
              <ProtectedRoute allowedRoles={RESPONDER_ROLES}>
                <RescueDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/users"
            element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Authorization failure route */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
