import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, UtensilsCrossed, Shield, Wallet } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../context/StoreContext';

export default function BottomNav() {
    const { userRole } = useStore();
    const location = useLocation();
    const currentPath = location.pathname;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-slate-700 pb-safe z-50">
            <div className="flex justify-around items-center h-16">
                <Link to="/" className={clsx("flex flex-col items-center gap-1 p-2 w-full", currentPath === "/" ? "text-primary" : "text-slate-400")}>
                    <CalendarDays size={20} />
                    <span className="text-[10px] font-medium">Planner</span>
                </Link>
                <Link to="/meals" className={clsx("flex flex-col items-center gap-1 p-2 w-full", currentPath === "/meals" ? "text-primary" : "text-slate-400")}>
                    <UtensilsCrossed size={20} />
                    <span className="text-[10px] font-medium">Comidas</span>
                </Link>
                <Link to="/expenses" className={clsx("flex flex-col items-center gap-1 p-2 w-full", currentPath === "/expenses" ? "text-emerald-400" : "text-slate-400")}>
                    <Wallet size={20} />
                    <span className="text-[10px] font-medium">Gastos</span>
                </Link>
                {userRole === 'admin' && (
                    <Link to="/admin" className={clsx("flex flex-col items-center gap-1 p-2 w-full", currentPath === "/admin" ? "text-primary" : "text-amber-500/50")}>
                        <Shield size={20} />
                        <span className="text-[10px] font-medium">Admin</span>
                    </Link>
                )}
            </div>
        </div>
    );
}
