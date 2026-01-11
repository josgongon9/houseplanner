import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import BottomNav from './components/BottomNav';
import Planner from './pages/Planner';
import Meals from './pages/Meals';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Expenses from './pages/Expenses';
import HouseholdSetup from './pages/HouseholdSetup';
import Profile from './pages/Profile';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, requireAdmin, requireAuth = true }) => {
    const { user, userRole, household, isLoading } = useStore();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    if (requireAuth && !user) {
        return <Login />;
    }

    // New check: If user is logged in but has no household, force them to setup
    // Exception: If they are already ON the setup page, don't redirect (infinite loop)
    // We handle this by checking if the child is HouseholdSetup? No, router handles path.
    // We'll let the router handle the path, but inside App we need to control this flow.
    // Easier approach: If !household, return HouseholdSetup directly unless it's the admin page maybe?
    // No, even admins need a home (or we give them a bypass, but let's keep it simple).

    if (requireAuth && user && !household) {
        // If we are already trying to render HouseholdSetup, allow it.
        // But children is an element...
        // Let's create a specific Route wrapper for this logic or handle it in the component Return.
        return <HouseholdSetup />;
    }

    if (requireAdmin && userRole !== 'admin') {
        return <Navigate to="/" />;
    }

    return (
        <>
            <div className={!requireAdmin ? "pb-20" : ""}>
                {children}
            </div>
            {!requireAdmin && <BottomNav />}
        </>
    );
};

function App() {
    return (
        <div className="min-h-screen bg-background text-slate-100">
            <BrowserRouter>
                <StoreProvider>
                    <div className="max-w-md mx-auto min-h-screen bg-background shadow-xl">
                        <Routes>
                            <Route path="/" element={
                                <ProtectedRoute>
                                    <Planner />
                                </ProtectedRoute>
                            } />
                            <Route path="/meals" element={
                                <ProtectedRoute>
                                    <Meals />
                                </ProtectedRoute>
                            } />
                            <Route path="/expenses" element={
                                <ProtectedRoute>
                                    <Expenses />
                                </ProtectedRoute>
                            } />
                            <Route path="/profile" element={
                                <ProtectedRoute>
                                    <Profile />
                                </ProtectedRoute>
                            } />
                            <Route path="/admin" element={
                                <ProtectedRoute requireAdmin>
                                    <Admin />
                                </ProtectedRoute>
                            } />
                        </Routes>
                    </div>
                </StoreProvider>
            </BrowserRouter>
        </div>
    );
}

export default App;
