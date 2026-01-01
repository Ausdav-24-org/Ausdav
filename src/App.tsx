import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import NeuralNetworkSplash from "@/components/NeuralNetworkSplash";
import Layout from "@/components/layout/Layout";

import HomePage from "@/pages/HomePage";
import AboutPage from "@/pages/AboutPage";
import UnderConstructionPage from "@/pages/UnderConstructionPage";
import CommitteePage from "@/pages/CommitteePage";
import ExamPage from "@/pages/ExamPage";
import ResourcesPage from "@/pages/ResourcesPage";
import SeminarPage from "@/pages/SeminarPage";
import EventsPage from "@/pages/EventsPage";
import EventDetailsPage from "@/pages/EventDetailsPage";
import DonatePage from "@/pages/DonatePage";
import LoginPage from "@/pages/LoginPage";
import NotFoundPage from "@/pages/NotFoundPage";
import SignupPortalPage from "@/pages/SignupPortalPage";
import ProfilePage from "@/pages/ProfilePage";

// Admin imports
import { AdminLayout } from "@/components/admin/AdminLayout";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminProfilePage from "@/pages/admin/AdminProfilePage";
import AdminMembersPage from "@/pages/admin/AdminMembersPage";
import AdminAnnouncementsPage from "@/pages/admin/AdminAnnouncementsPage";
import AdminAuditPage from "@/pages/admin/AdminAuditPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import AdminPermissionsPage from "@/pages/admin/AdminPermissionsPage";
import AdminEventsPage from "@/pages/admin/AdminEventsPage";
import AdminFeedbackPage from "@/pages/admin/AdminFeedbackPage";
import ContactSettingsPage from "@/pages/admin/ContactSettingsPage";
import FinanceSubmitPage from "@/pages/admin/finance/FinanceSubmitPage";
import FinanceVerifyPage from "@/pages/admin/finance/FinanceVerifyPage";
import FinanceLedgerPage from "@/pages/admin/finance/FinanceLedgerPage";
import ProfileSetupPage from "@/pages/admin/ProfileSetupPage";
import AdminExamPage from "@/pages/admin/AdminExamPage";
import AdminSeminarPage from "@/pages/admin/AdminSeminarPage";
import AdminPastPaperPage from "@/pages/admin/AdminPastPaperPage";
import AdminApplicantsPage from "@/pages/admin/AdminApplicantsPage";
import ClaimPermissionPage from "@/pages/admin/ClaimPermissionPage";

import AdminPatronsPage from "@/pages/admin/AdminPatronsPage";
import AdminSiteModePage from "@/pages/admin/AdminSiteModePage";

// ✅ ADD THIS IMPORT (create this file or update the path to your actual results page)
import AdminResultsPage from "@/pages/admin/AdminResultsPage";
import AdminDesignationsPage from "@/pages/admin/AdminDesignationsPage";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const devStayOnSplash = import.meta.env.DEV;

  useEffect(() => {
    document.documentElement.classList.add("dark");

    if (devStayOnSplash) {
      //if (false) {
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
              <BrowserRouter basename={import.meta.env.BASE_URL}>
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
                        <HomePage />
                      </Layout>
                    }
                  />
                  <Route
                    path="/about"
                    element={
                      <Layout>
                        <AboutPage />
                      </Layout>
                    }
                  />
                  <Route
                    path="/under-construction"
                    element={
                      <Layout>
                        <UnderConstructionPage />
                      </Layout>
                    }
                  />
                  <Route
                    path="/committee"
                    element={
                      <Layout>
                        <CommitteePage />
                      </Layout>
                    }
                  />
                  <Route
                    path="/exam"
                    element={
                      <Layout>
                        <ExamPage />
                      </Layout>
                    }
                  />
                  <Route
                    path="/resources"
                    element={
                      <Layout>
                        <ResourcesPage />
                      </Layout>
                    }
                  />
                  <Route
                    path="/events"
                    element={
                      <Layout>
                        <EventsPage />
                      </Layout>
                    }
                  />
                  <Route
                    path="/events/:id"
                    element={
                      <Layout>
                        <EventDetailsPage />
                      </Layout>
                    }
                  />
                  <Route
                    path="/donate"
                    element={
                      <Layout>
                        <DonatePage />
                      </Layout>
                    }
                  />
                  <Route
                    path="/login"
                    element={
                      <Layout>
                        <LoginPage />
                      </Layout>
                    }
                  />
                  <Route
                    path="/signup"
                    element={
                      <Layout>
                        <SignupPortalPage />
                      </Layout>
                    }
                  />
                  <Route
                    path="/register"
                    element={<Navigate to="/signup" replace />}
                  />

                  <Route
                    path="/profile"
                    element={
                      <Layout>
                        <ProfilePage />
                      </Layout>
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
                        <AdminLayout />
                      </AdminAuthProvider>
                    }
                  >
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="dashboard" element={<AdminDashboardPage />} />
                    <Route
                      path="profile-setup"
                      element={<ProfileSetupPage />}
                    />
                    <Route path="profile" element={<AdminProfilePage />} />
                    <Route path="members" element={<AdminMembersPage />} />
                    <Route
                      path="applicants"
                      element={<AdminApplicantsPage />}
                    />
                    <Route path="patrons" element={<AdminPatronsPage />} />
                    <Route path="results" element={<AdminResultsPage />} />
                    <Route
                      path="designations"
                      element={<AdminDesignationsPage />}
                    />
                    <Route path="site-mode" element={<AdminSiteModePage />} />
                    <Route path="events" element={<AdminEventsPage />} />
                    <Route path="exam" element={<AdminExamPage />} />
                    <Route path="seminar" element={<AdminSeminarPage />} />
                    <Route path="past-paper" element={<AdminPastPaperPage />} />
                    <Route
                      path="announcements"
                      element={<AdminAnnouncementsPage />}
                    />
                    <Route path="feedback" element={<AdminFeedbackPage />} />
                    <Route
                      path="claim-permission"
                      element={<ClaimPermissionPage />}
                    />
                    <Route
                      path="permissions"
                      element={<AdminPermissionsPage />}
                    />
                    <Route path="contact" element={<ContactSettingsPage />} />
                    <Route path="audit" element={<AdminAuditPage />} />
                    <Route path="settings" element={<AdminSettingsPage />} />
                    <Route
                      path="finance/submit"
                      element={<FinanceSubmitPage />}
                    />
                    <Route
                      path="finance/verify"
                      element={<FinanceVerifyPage />}
                    />
                    <Route
                      path="finance/ledger"
                      element={<FinanceLedgerPage />}
                    />
                  </Route>

                  <Route
                    path="*"
                    element={
                      <Layout>
                        <NotFoundPage />
                      </Layout>
                    }
                  />
                </Routes>
              </BrowserRouter>
            )}
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
