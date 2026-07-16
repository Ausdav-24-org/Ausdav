import { useState, useEffect, Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import NeuralNetworkSplash from "@/components/NeuralNetworkSplash";
import Layout from "@/components/layout/Layout";
import { SiteModeGuard } from "@/components/SiteModeGuard";
import { EmergencyLockGuard } from "@/components/EmergencyLockGuard";

// Lazy load all pages for code splitting
const HomePage = lazy(() => import("@/pages/HomePage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const UnderConstructionPage = lazy(() => import("@/pages/UnderConstructionPage"));
const CommitteePage = lazy(() => import("@/pages/CommitteePage"));
const ExamPage = lazy(() => import("@/pages/ExamPage"));
const QuizPage = lazy(() => import("@/pages/QuizPage"));
const ResourcesPage = lazy(() => import("@/pages/ResourcesPage"));
const SeminarPage = lazy(() => import("@/pages/SeminarPage"));
const EventsPage = lazy(() => import("@/pages/EventsPage"));
const EventDetailsPage = lazy(() => import("@/pages/EventDetailsPage"));
const DonatePage = lazy(() => import("@/pages/DonatePage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const SignupPortalPage = lazy(() => import("@/pages/SignupPortalPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback").then(m => ({ default: m.AuthCallback })));

// Admin imports - lazy loaded
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboardPage"));
const AdminProfilePage = lazy(() => import("@/pages/admin/AdminProfilePage"));
const AdminMembersPage = lazy(() => import("@/pages/admin/AdminMembersPage"));
const AdminAnnouncementsPage = lazy(() => import("@/pages/admin/AdminAnnouncementsPage"));
const FinanceAuditLogPage = lazy(() => import("@/pages/admin/finance/FinanceAuditLogPage"));
const AdminSettingsPage = lazy(() => import("@/pages/admin/AdminSettingsPage"));
const AdminPermissionsPage = lazy(() => import("@/pages/admin/AdminPermissionsPage"));
const AdminEventsPage = lazy(() => import("@/pages/admin/AdminEventsPage"));
const AdminFeedbackPage = lazy(() => import("@/pages/admin/AdminFeedbackPage"));
const UpdatePasswordPage = lazy(() => import("@/pages/UpdatePasswordPage"));
const ContactSettingsPage = lazy(() => import("@/pages/admin/ContactSettingsPage"));
const FinanceSubmitPage = lazy(() => import("@/pages/admin/finance/FinanceSubmitPage"));
const FinanceVerifyPage = lazy(() => import("@/pages/admin/finance/FinanceVerifyPage"));
const FinanceLedgerPage = lazy(() => import("@/pages/admin/finance/FinanceLedgerPage"));
const ProfileSetupPage = lazy(() => import("@/pages/admin/ProfileSetupPage"));
const AdminExamPage = lazy(() => import("@/pages/admin/AdminExamPage"));
const AdminQuizPage = lazy(() => import("@/pages/admin/AdminQuizPage"));
const AdminSeminarPage = lazy(() => import("@/pages/admin/AdminSeminarPage"));
const AdminPastPaperPage = lazy(() => import("@/pages/admin/AdminPastPaperPage"));
const AdminApplicantsPage = lazy(() => import("@/pages/admin/AdminApplicantsPage"));
const ClaimPermissionPage = lazy(() => import("@/pages/admin/ClaimPermissionPage"));
const AdminPatronsPage = lazy(() => import("@/pages/admin/AdminPatronsPage"));
const AdminSiteModePage = lazy(() => import("@/pages/admin/AdminSiteModePage"));
const AdminResultsPage = lazy(() => import("@/pages/admin/AdminResultsPage"));
const AdminDesignationsPage = lazy(() => import("@/pages/admin/AdminDesignationsPage"));
const AdminDetailsPage = lazy(() => import("@/pages/admin/AdminDetailsPage"));
const AdminMasterAdminPage = lazy(() => import("@/pages/admin/AdminMasterAdminPage"));
const AdminEmergencyLockPage = lazy(() => import("@/pages/admin/AdminEmergencyLockPage"));
const AccessDeniedPage = lazy(() => import("@/pages/AccessDeniedPage"));
const AdminBulkQRGeneratorPage = lazy(() => import("@/pages/admin/AdminQRAndIDCardsPage"));
const AdminIDCardPage = lazy(() => import("@/pages/admin/AdminQRAndIDCardsPage"));
const VerifyMemberPage = lazy(() => import("@/pages/VerifyMemberPage"));
const ChangePasswordPage = lazy(() => import('@/pages/ChangePasswordPage'),);


// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
  </div>
);

const queryClient = new QueryClient();

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const devStayOnSplash = false;

  useEffect(() => {
    document.documentElement.classList.add("dark");

    // if (devStayOnSplash) {
    if (devStayOnSplash) {
      setAppReady(true);
      setShowSplash(true);
      return;
    }

    const hasSeenSplash = sessionStorage.getItem("ausdav-splash-shown");
    if (hasSeenSplash) {
      setShowSplash(false);
      setAppReady(true);
    }
  }, [devStayOnSplash]);

  const handleSplashComplete = () => {
    setAppReady(true);
    if (!devStayOnSplash) {
      setShowSplash(false);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />

            {showSplash && (
              <NeuralNetworkSplash
                onComplete={handleSplashComplete}
                stayVisible={devStayOnSplash}
              />
            )}

            {appReady && (
              <BrowserRouter
                  basename={import.meta.env.BASE_URL}
                  future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
                >
                <ScrollToTop />
                <EmergencyLockGuard>
                <SiteModeGuard>
                <Routes>
                  {/* Public routes with Layout */}
                  <Route
                    path="/splash"
                    element={
                      <Layout>
                        <NeuralNetworkSplash
                          stayVisible
                          onComplete={handleSplashComplete}
                        />
                      </Layout>
                    }
                  />
                  <Route
                    path="/"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <HomePage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/about"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <AboutPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/under-construction"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <UnderConstructionPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/access-denied"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <AccessDeniedPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/committee"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <CommitteePage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/exam"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <ExamPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route path="/quiz" element={<Navigate to="/quiz/1" replace />} />
                  <Route
                    path="/quiz/:questionIndex"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <QuizPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/resources"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <ResourcesPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/events"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <EventsPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/events/:id"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <EventDetailsPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/donate"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <DonatePage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/login"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <LoginPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  {/* oauth redirect landing page */}
                  <Route
                    path="/auth/callback"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <AuthCallback />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/account/update-password"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <UpdatePasswordPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/account/change-password"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <ChangePasswordPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/signup"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <SignupPortalPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                  <Route
                    path="/register"
                    element={<Navigate to="/signup" replace />}
                  />

                  {/* Member QR Code Verification - Public Route */}
                  <Route
                    path="/verify-member"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <VerifyMemberPage />
                        </Suspense>
                      </Layout>
                    }
                  />

                  <Route
                    path="/profile"
                    element={
                      <AdminAuthProvider>
                        <Layout>
                          <Suspense fallback={<PageLoader />}>
                            <ProfilePage />
                          </Suspense>
                        </Layout>
                      </AdminAuthProvider>
                    }
                  />
                  <Route
                    path="/ausdav/src/pages/ProfilePage.tsx"
                    element={<Navigate to="/profile" replace />}
                  />

                  <Route
                    path="/admin/login"
                    element={<Navigate to="/login" replace />}
                  />
                  <Route
                    path="/admin"
                    element={
                      <AdminAuthProvider>
                        <Suspense fallback={<PageLoader />}>
                          <AdminLayout />
                        </Suspense>
                      </AdminAuthProvider>
                    }
                  >
                    <Route index element={<Suspense fallback={<PageLoader />}><AdminDashboardPage /></Suspense>} />
                    <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><AdminDashboardPage /></Suspense>} />
                    <Route path="profile-setup" element={<Suspense fallback={<PageLoader />}><ProfileSetupPage /></Suspense>} />
                    <Route path="profile" element={<Suspense fallback={<PageLoader />}><AdminProfilePage /></Suspense>} />
                    <Route path="members" element={<Suspense fallback={<PageLoader />}><AdminMembersPage /></Suspense>} />
                    <Route path="applicants" element={<Suspense fallback={<PageLoader />}><AdminApplicantsPage /></Suspense>} />
                    <Route path="patrons" element={<Suspense fallback={<PageLoader />}><AdminPatronsPage /></Suspense>} />
                    <Route path="results" element={<Suspense fallback={<PageLoader />}><AdminResultsPage /></Suspense>} />
                    <Route path="designations" element={<Suspense fallback={<PageLoader />}><AdminDesignationsPage /></Suspense>} />
                    <Route path="details" element={<Suspense fallback={<PageLoader />}><AdminDetailsPage /></Suspense>} />
                    <Route path="site-mode" element={<Suspense fallback={<PageLoader />}><AdminSiteModePage /></Suspense>} />
                    <Route path="events" element={<Suspense fallback={<PageLoader />}><AdminEventsPage /></Suspense>} />
                    <Route path="exam" element={<Suspense fallback={<PageLoader />}><AdminExamPage /></Suspense>} />
                    <Route path="quiz" element={<Suspense fallback={<PageLoader />}><AdminQuizPage /></Suspense>} />
                    <Route path="seminar" element={<Suspense fallback={<PageLoader />}><AdminSeminarPage /></Suspense>} />
                    <Route path="past-paper" element={<Suspense fallback={<PageLoader />}><AdminPastPaperPage /></Suspense>} />
                    <Route path="announcements" element={<Suspense fallback={<PageLoader />}><AdminAnnouncementsPage /></Suspense>} />
                    <Route path="feedback" element={<Suspense fallback={<PageLoader />}><AdminFeedbackPage /></Suspense>} />
                    <Route path="claim-permission" element={<Suspense fallback={<PageLoader />}><ClaimPermissionPage /></Suspense>} />
                    <Route path="permissions" element={<Suspense fallback={<PageLoader />}><AdminPermissionsPage /></Suspense>} />
                    <Route path="master-admin" element={<Suspense fallback={<PageLoader />}><AdminMasterAdminPage /></Suspense>} />
                    <Route path="emergency-lock" element={<Suspense fallback={<PageLoader />}><AdminEmergencyLockPage /></Suspense>} />
                    <Route path="bulk-qr-generator" element={<Suspense fallback={<PageLoader />}><AdminBulkQRGeneratorPage /></Suspense>} />
                    <Route path="id-card-generator" element={<Suspense fallback={<PageLoader />}><AdminIDCardPage /></Suspense>} />
                    <Route path="contact" element={<Suspense fallback={<PageLoader />}><ContactSettingsPage /></Suspense>} />
                    <Route path="finance/audit" element={<Suspense fallback={<PageLoader />}><FinanceAuditLogPage /></Suspense>} />
                    <Route path="settings" element={<Suspense fallback={<PageLoader />}><AdminSettingsPage /></Suspense>} />
                    <Route path="finance/submit" element={<Suspense fallback={<PageLoader />}><FinanceSubmitPage /></Suspense>} />
                    <Route path="finance/verify" element={<Suspense fallback={<PageLoader />}><FinanceVerifyPage /></Suspense>} />
                    <Route path="finance/ledger" element={<Suspense fallback={<PageLoader />}><FinanceLedgerPage /></Suspense>} />
                  </Route>

                  <Route
                    path="*"
                    element={
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
                          <NotFoundPage />
                        </Suspense>
                      </Layout>
                    }
                  />
                </Routes>
                </SiteModeGuard>
                </EmergencyLockGuard>
              </BrowserRouter>
            )}
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
