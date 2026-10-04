import { Route, Switch } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import NotFound from "@/pages/NotFound";
import Admin from "@/pages/Admin";
import Home from "@/pages/Home";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import CookieConsent from "./components/CookieConsent";
import AnalyticsTracker from "./components/AnalyticsTracker";
import { CookiesPage, LegalNoticePage, PrivacyPage } from "@/pages/Legal";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/admin" component={Admin} /><Route path="/cookies" component={CookiesPage} /><Route path="/privacidad" component={PrivacyPage} /><Route path="/aviso-legal" component={LegalNoticePage} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster theme="dark" /><AnalyticsTracker /><Router /><CookieConsent /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
