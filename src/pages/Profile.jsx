import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { db, collection, query, where, getDocs, doc, updateDoc } from '../lib/firebase';
import { User, Home, LogOut, Check, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
    const { user, household, switchHousehold, logout, createHousehold, joinHousehold } = useStore();
    const [myHouseholds, setMyHouseholds] = useState([]);
    const [loadingHomes, setLoadingHomes] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [newHomeName, setNewHomeName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;

        const fetchHomes = async () => {
            try {
                const q = query(
                    collection(db, "households"),
                    where("members", "array-contains", user.uid)
                );
                const snapshot = await getDocs(q);
                const homes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setMyHouseholds(homes);
            } catch (error) {
                console.error("Error fetching households", error);
            } finally {
                setLoadingHomes(false);
            }
        };

        fetchHomes();
    }, [user]);

    const handleSwitch = async (id) => {
        if (id === household?.id) return;
        await switchHousehold(id);
    };

    const handleLogout = async () => {
        if (confirm("¿Cerrar sesión?")) {
            await logout();
            navigate('/login');
        }
    }

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newHomeName.trim()) return;
        await createHousehold(newHomeName);
        setNewHomeName("");
        setIsCreating(false);
        // Refresh list
        setLoadingHomes(true);
        // Re-fetch triggers automatically? No, createHousehold updates context household, but not myHouseholds list?
        // Actually createHousehold updates user profile which triggers context refresh.
        // But we need to update the list here.
        window.location.reload(); // Simplest way to refresh everything including the list
    }

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!joinCode.trim()) return;
        try {
            await joinHousehold(joinCode);
            setJoinCode("");
            setIsJoining(false);
            window.location.reload();
        } catch (e) {
            alert(e.message);
        }
    }

    return (
        <div className="p-4 space-y-6 pb-24 animate-in fade-in duration-500">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-600 bg-clip-text text-transparent">
                Mi Perfil
            </h1>

            {/* User Info */}
            <div className="bg-surface p-6 rounded-2xl border border-slate-700 flex items-center gap-4 shadow-lg">
                {user?.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-16 h-16 rounded-full border-2 border-emerald-500" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-600">
                        <User size={32} className="text-slate-400" />
                    </div>
                )}
                <div>
                    <h2 className="font-bold text-lg text-white">{user?.displayName}</h2>
                    <p className="text-sm text-slate-400">{user?.email}</p>
                </div>
            </div>

            {/* Households List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-300 flex items-center gap-2">
                        <Home size={20} className="text-emerald-500" /> Mis Hogares
                    </h3>
                </div>

                {loadingHomes ? (
                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-emerald-500" /></div>
                ) : (
                    <div className="space-y-3">
                        {myHouseholds.map(home => (
                            <button
                                key={home.id}
                                onClick={() => handleSwitch(home.id)}
                                className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${household?.id === home.id
                                        ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500'
                                        : 'bg-surface border-slate-700 hover:border-slate-500'
                                    }`}
                            >
                                <div className="text-left">
                                    <h4 className={`font-bold ${household?.id === home.id ? 'text-emerald-400' : 'text-slate-200'}`}>
                                        {home.name}
                                    </h4>
                                    <p className="text-xs text-slate-500 font-mono">Código: {home.code}</p>
                                </div>
                                {household?.id === home.id && (
                                    <div className="bg-emerald-500 text-white p-1 rounded-full">
                                        <Check size={16} />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Actions: Join or Create */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                        onClick={() => setIsCreating(!isCreating)}
                        className="p-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-emerald-500 hover:bg-emerald-500/10 transition-all font-bold text-sm"
                    >
                        + Crear Nuevo
                    </button>
                    <button
                        onClick={() => setIsJoining(!isJoining)}
                        className="p-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-blue-500 hover:bg-blue-500/10 transition-all font-bold text-sm"
                    >
                        → Unirse
                    </button>
                </div>

                {/* Create Form */}
                {isCreating && (
                    <form onSubmit={handleCreate} className="bg-slate-800 p-4 rounded-xl border border-slate-700 animate-in slide-in-from-top-2">
                        <label className="block text-xs text-slate-400 mb-1">Nombre del Hogar</label>
                        <div className="flex gap-2">
                            <input
                                value={newHomeName}
                                onChange={e => setNewHomeName(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-emerald-500"
                                placeholder="Ej. Casa de la Playa"
                                autoFocus
                            />
                            <button type="submit" className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm">Crear</button>
                        </div>
                    </form>
                )}

                {/* Join Form */}
                {isJoining && (
                    <form onSubmit={handleJoin} className="bg-slate-800 p-4 rounded-xl border border-slate-700 animate-in slide-in-from-top-2">
                        <label className="block text-xs text-slate-400 mb-1">Código de Invitación</label>
                        <div className="flex gap-2">
                            <input
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-blue-500 uppercase font-mono"
                                placeholder="XXXXXX"
                                autoFocus
                                maxLength={6}
                            />
                            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm">Unirse</button>
                        </div>
                    </form>
                )}
            </div>

            <div className="pt-8 border-t border-slate-800">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 p-4 rounded-xl transition-all font-bold"
                >
                    <LogOut size={20} />
                    Cerrar Sesión
                </button>
            </div>

            <div className="text-center text-xs text-slate-600">
                v0.1.0 • HousePlanner
            </div>
        </div>
    );
}
