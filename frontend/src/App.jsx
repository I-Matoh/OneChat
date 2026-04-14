import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from '@/lib/PageNotFound';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import UserNotRegisteredError from '@/components/UserNotRegistered';
import MainLayout from '@/components/layout/MainLayout';

import Home from '@/pages/Home';
import Chat from '@/pages/Chat';
import PageEditor from '@/pages/PageEditor';
import Tasks from '@/pages/Tasks';
import AIAssistant from '@/pages/AIAssistant';
import Search from '@/pages/Search';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import MeetingAI from '@/pages/MeetingAI';
import Settings from '@/pages/Settings';

const AuthenticatedApp = () => {
  const { user, token, loading: isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading OneChat...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/pages/:pageId" element={<PageEditor />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="/meeting" element={<MeetingAI />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/search" element={<Search />} />
      </Route>
      <Route path="/landing" element={<Landing />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;