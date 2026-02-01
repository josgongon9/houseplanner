import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Home, ArrowRight, Keyboard, Sparkles } from 'lucide-react';

export default function HouseholdSetup() {
    const { createHousehold, joinHousehold, logout } = useStore();
    const [mode, setMode] = useState('welcome'); // welcome, create, join
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createHousehold(name);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await joinHousehold(code);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (mode === 'welcome') {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in max-w-md mx-auto w-full">
                <div className="mb-8 p-4 bg-primary/20 rounded-full">
                    <Home size={48} className="text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-2">¡Bienvenido a Casa!</h1>
                <p className="text-slate-400 mb-8 max-w-xs">
                    Para empezar, necesitas un Espacio. Puedes crear uno nuevo para tu familia o unirte a uno existente.
                </p>

                <div className="w-full max-w-sm space-y-3">
                    <button onClick={() => setMode('create')} className="w-full p-4 bg-primary rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors">
                        <Sparkles size={20} /> Crear un nuevo Hogar
                    </button>
                    <button onClick={() => setMode('join')} className="w-full p-4 bg-surface border border-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                        <Keyboard size={20} /> Introducir código
                    </button>
                </div>

                <button onClick={logout} className="mt-8 text-sm text-slate-500 underline">Cerrar Sesión</button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-6 flex flex-col justify-center max-w-md mx-auto animate-in slide-in-from-bottom-10">
            <h1 className="text-2xl font-bold mb-6">
                {mode === 'create' ? 'Nuevo Hogar' : 'Unirse a Hogar'}
            </h1>

            {mode === 'create' && (
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Nombre de tu Casa</label>
                        <input
                            value={name} onChange={e => setName(e.target.value)}
                            className="w-full bg-surface border border-slate-700 rounded-xl p-3 focus:border-primary outline-none"
                            placeholder="Ej. Casa de José"
                            required
                        />
                    </div>
                    <button disabled={loading} className="w-full bg-primary p-4 rounded-xl font-bold flex justify-center items-center gap-2">
                        {loading ? 'Creando...' : 'Crear Espacio'} <ArrowRight size={20} />
                    </button>
                </form>
            )}

            {mode === 'join' && (
                <form onSubmit={handleJoin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Código de Invitación</label>
                        <input
                            value={code} onChange={e => setCode(e.target.value)}
                            className="w-full bg-surface border border-slate-700 rounded-xl p-3 focus:border-primary outline-none uppercase tracking-widest text-center text-xl"
                            placeholder="XXXXXX"
                            maxLength={6}
                            required
                        />
                        <p className="text-xs text-slate-500 mt-2 text-center">Pide el código al administrador del hogar.</p>
                    </div>
                    {error && <p className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded">{error}</p>}
                    <button disabled={loading} className="w-full bg-white text-black p-4 rounded-xl font-bold flex justify-center items-center gap-2">
                        {loading ? 'Verificando...' : 'Unirse'} <ArrowRight size={20} />
                    </button>
                </form>
            )}

            <button onClick={() => setMode('welcome')} className="mt-6 text-slate-400 text-sm hover:text-white">
                Cancelar y volver
            </button>
        </div>
    );
}
