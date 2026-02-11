import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import OnboardingPage from "@/pages/onboarding-page";
import BrowsePage from "@/pages/browse-page";
import PartyDetailPage from "@/pages/party-detail-page";
import ProfilePage from "@/pages/profile-page";
import SettingsPage from "@/pages/settings-page";
import CreatePartyPage from "@/pages/create-party-page";
import HostPage from "@/pages/host-page";
import AttendingPage from "@/pages/attending-page";
import LegalPage from "@/pages/legal-page";
import PersonalityTestPage from "@/pages/personality-test-page";
import MapPage from "@/pages/map-page";
import EditPartyPage from "@/pages/edit-party-page";
import NotificationsPage from "@/pages/notifications-page";
import UserProfilePage from "@/pages/user-profile-page";
import RatePartyPage from "@/pages/rate-party-page";
import ChatPage from "@/pages/chat-page";
import { MobileNav } from "@/components/mobile-nav";
import { Skeleton } from "@/components/ui/skeleton";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/auth" />;
  }

  if (user && (!user.city || !user.country) && location !== "/onboarding") {
    return <Redirect to="/onboarding" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/legal/:type" component={LegalPage} />
      <Route path="/">
        <AuthGuard>
          <BrowsePage />
        </AuthGuard>
      </Route>
      <Route path="/browse">
        <AuthGuard>
          <BrowsePage />
        </AuthGuard>
      </Route>
      <Route path="/onboarding">
        <AuthGuard>
          <OnboardingPage />
        </AuthGuard>
      </Route>
      <Route path="/party/:id">
        <AuthGuard>
          <PartyDetailPage />
        </AuthGuard>
      </Route>
      <Route path="/profile/:id">
        <AuthGuard>
          <UserProfilePage />
        </AuthGuard>
      </Route>
      <Route path="/profile">
        <AuthGuard>
          <ProfilePage />
        </AuthGuard>
      </Route>
      <Route path="/personality-test">
        <AuthGuard>
          <PersonalityTestPage />
        </AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard>
          <SettingsPage />
        </AuthGuard>
      </Route>
      <Route path="/create-party">
        <AuthGuard>
          <CreatePartyPage />
        </AuthGuard>
      </Route>
      <Route path="/host">
        <AuthGuard>
          <HostPage />
        </AuthGuard>
      </Route>
      <Route path="/attending">
        <AuthGuard>
          <AttendingPage />
        </AuthGuard>
      </Route>
      <Route path="/map">
        <AuthGuard>
          <MapPage />
        </AuthGuard>
      </Route>
      <Route path="/edit-party/:id">
        <AuthGuard>
          <EditPartyPage />
        </AuthGuard>
      </Route>
      <Route path="/chat">
        <AuthGuard>
          <ChatPage />
        </AuthGuard>
      </Route>
      <Route path="/notifications">
        <AuthGuard>
          <NotificationsPage />
        </AuthGuard>
      </Route>
      <Route path="/rate/:partyId">
        <AuthGuard>
          <RatePartyPage />
        </AuthGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const hideNav = ["/auth", "/onboarding"].includes(location) || location.startsWith("/legal");

  return (
    <div className="min-h-screen bg-background">
      <Router />
      {isAuthenticated && !hideNav && <MobileNav />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
