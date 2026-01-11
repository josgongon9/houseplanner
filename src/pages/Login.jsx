import React from 'react';
import { useStore } from '../context/StoreContext';
import { ChefHat, ArrowRight } from 'lucide-react';

export default function Login() {
    const { login } = useStore();

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-500">

                {/* Logo / Icon */}
                <div className="flex justify-center">
                    <div className="bg-primary/20 p-6 rounded-full ring-4 ring-primary/10">
                        <ChefHat size={64} className="text-primary" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        Menu Semanal
                    </h1>
                    <p className="text-slate-400">
                        Planifica, gestiona tu stock y no te quedes sin albóndigas nunca más.
                    </p>
                </div>

                <div className="space-y-4 pt-4">
                    <button
                        onClick={login}
                        className="w-full group relative flex items-center justify-center gap-3 bg-white text-slate-900 px-6 py-4 rounded-xl font-bold text-lg hover:bg-slate-200 transition-all active:scale-95 shadow-xl hover:shadow-2xl hover:shadow-white/10"
                    >
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
                        <span>Continuar con Google</span>
                        <ArrowRight className="absolute right-4 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" size={20} />
                    </button>

                    <p className="text-xs text-slate-600">
                        Se usará tu cuenta para guardar y sincronizar los datos.
                    </p>
                </div>
            </div>
        </div>
    );
}
