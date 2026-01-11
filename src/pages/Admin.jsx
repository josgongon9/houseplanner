import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { db, collection, updateDoc, doc, onSnapshot } from '../lib/firebase';
import { Shield, ShieldAlert, User, ChevronLeft, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Admin() {
    const { user, userRole } = useStore();
    const [users, setUsers] = useState([]);
    const [households, setHouseholds] = useState([]);
    const [activeTab, setActiveTab] = useState('users'); // users, households
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || userRole !== 'admin') return;

        // Fetch all users
        const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
            setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Fetch all households
        const unsubHouseholds = onSnapshot(collection(db, "households"), (snapshot) => {
            setHouseholds(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        return () => {
            unsubUsers();
            unsubHouseholds();
        };
    }, [user, userRole]);

    const toggleRole = async (targetUserId, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        if (targetUserId === user.uid) {
            if (!confirm("¿Estás seguro de que quieres quitarte tus propios permisos de administrador?")) return;
        }
        await updateDoc(doc(db, "users", targetUserId), { role: newRole });
    };

    if (!user || userRole !== 'admin') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
                <ShieldAlert size={64} className="text-red-500" />
                <h1 className="text-2xl font-bold">Acceso Denegado</h1>
                <p className="text-slate-400">No tienes permisos para ver esta página.</p>
                <Link to="/" className="text-primary hover:underline">Volver al inicio</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-20 p-4 space-y-6">
            <header className="flex items-center gap-4 border-b border-slate-700 pb-4">
                <Link to="/" className="p-2 hover:bg-slate-800 rounded-full"><ChevronLeft /></Link>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Shield className="text-primary" />
                    Administración
                </h1>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-slate-800 rounded-lg">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'users' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    Usuarios ({users.length})
                </button>
                <button
                    onClick={() => setActiveTab('households')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'households' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    Hogares ({households.length})
                </button>
            </div>

            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center py-10">Cargando datos...</div>
                ) : activeTab === 'users' ? (
                    users.map(u => (
                        <div key={u.id} className="bg-surface p-4 rounded-xl border border-slate-700 flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                {u.photoURL ? (
                                    <img src={u.photoURL} alt={u.displayName} className="w-10 h-10 rounded-full" />
                                ) : (
                                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                                        <User size={20} />
                                    </div>
                                )}
                                <div>
                                    <div className="font-bold">{u.displayName || "Usuario Anónimo"}</div>
                                    <div className="text-xs text-slate-400">{u.email}</div>
                                </div>
                            </div>

                            <button
                                onClick={() => toggleRole(u.id, u.role)}
                                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${u.role === 'admin'
                                        ? 'bg-primary/20 text-primary border-primary/50 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50'
                                        : 'bg-slate-800 text-slate-400 border-slate-600 hover:bg-primary/20 hover:text-primary hover:border-primary/50'
                                    }`}
                            >
                                {u.role === 'admin' ? 'ADMIN' : 'USUARIO'}
                            </button>
                        </div>
                    ))
                ) : (
                    households.map(h => {
                        const creator = users.find(u => u.id === h.createdBy);
                        return (
                            <div key={h.id} className="bg-surface p-4 rounded-xl border border-slate-700 relative overflow-hidden">
                                <div className="flex justify-between items-start mb-2 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-800 p-2 rounded-lg">
                                            <Home size={20} className="text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">{h.name}</h3>
                                            <div className="text-xs text-slate-400 font-mono bg-black/30 px-2 py-0.5 rounded inline-block mt-1 border border-slate-700">
                                                CÓDIGO: <span className="text-white font-bold tracking-widest">{h.code}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs bg-slate-800 border border-slate-600 px-2 py-1 rounded-full text-slate-300">
                                        {h.members?.length || 0} miembros
                                    </span>
                                </div>
                                <div className="text-xs text-slate-500 border-t border-slate-700 pt-3 mt-3 flex justify-between items-center relative z-10">
                                    <span>Creado por: <span className="text-slate-300">{creator ? creator.displayName : 'Desconocido'}</span></span>
                                    <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        );
                    })
                )}

                {!loading && activeTab === 'households' && households.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                        No hay hogares creados aún.
                    </div>
                )}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-xs text-blue-200">
                <strong className="block mb-1 font-bold text-blue-400">Nota de Seguridad:</strong>
                Los administradores tienen acceso total a los datos. Ten cuidado al otorgar permisos.
                Los cambios se reflejan inmediatamente.
            </div>
        </div>
    );
}
