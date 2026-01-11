import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { db, collection, updateDoc, doc, onSnapshot } from '../lib/firebase';
import { Shield, ShieldAlert, User, ChevronLeft, Home, Edit, Plus, X, LogIn, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Admin() {
    const { user, userRole, adminUpdateHousehold, adminAddUserToHousehold, adminCreateHousehold, adminSwitchHousehold, adminCreateGhostUser, adminDeleteUser, adminDeleteHousehold, household: currentHousehold } = useStore();
    const [users, setUsers] = useState([]);
    const [households, setHouseholds] = useState([]);
    const [activeTab, setActiveTab] = useState('users'); // users, households
    const [loading, setLoading] = useState(true);

    // States for Edit/Add
    const [editingHousehold, setEditingHousehold] = useState(null); // ID of household being edited
    const [isCreatingHousehold, setIsCreatingHousehold] = useState(false);
    const [newHouseholdName, setNewHouseholdName] = useState("");

    // States for Adding User to Household
    const [showAddUserModal, setShowAddUserModal] = useState(false); // ID of household
    const [selectedUserToAdd, setSelectedUserToAdd] = useState("");

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

    const handleCreateHousehold = async (e) => {
        e.preventDefault();
        if (!newHouseholdName) return;
        await adminCreateHousehold(newHouseholdName);
        setNewHouseholdName("");
        setIsCreatingHousehold(false);
    }

    const handleUpdateHousehold = async (id, name) => {
        await adminUpdateHousehold(id, { name });
        setEditingHousehold(null);
    }

    const handleAddUserToHousehold = async () => {
        if (!showAddUserModal || !selectedUserToAdd) return;
        try {
            await adminAddUserToHousehold(selectedUserToAdd, showAddUserModal);
            setShowAddUserModal(false);
            setSelectedUserToAdd("");
        } catch (e) {
            alert(e.message);
        }
    }

    if (!user || userRole !== 'admin') {
        return <AccessDenied />;
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
                    Usuarios
                </button>
                <button
                    onClick={() => setActiveTab('households')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'households' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    Hogares
                </button>
            </div>

            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center py-10">Cargando datos...</div>
                ) : activeTab === 'users' ? (
                    <div className="space-y-4">
                        <button
                            onClick={async () => {
                                const name = prompt("Nombre del usuario de prueba:");
                                if (name) await adminCreateGhostUser(name);
                            }}
                            className="w-full py-3 bg-slate-800 border border-slate-700 border-dashed rounded-xl text-slate-400 hover:border-emerald-500 hover:text-emerald-400 transition-colors flex justify-center items-center gap-2"
                        >
                            <Plus size={20} /> Crear Usuario de Prueba
                        </button>
                        {users.map(u => (
                            <div key={u.id} className="bg-surface p-4 rounded-xl border border-slate-700 flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <Avatar url={u.photoURL} />
                                    <div>
                                        <div className="font-bold flex items-center gap-2">
                                            {u.displayName || "Usuario Anónimo"}
                                            {u.isGhost && <span className="text-[10px] bg-slate-700 px-1 rounded text-slate-300">TEST</span>}
                                        </div>
                                        <div className="text-xs text-slate-400">{u.email}</div>
                                        {u.householdId && <div className="text-[10px] text-blue-400">En Hogar: {households.find(h => h.id === u.householdId)?.name || '...'}</div>}
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
                                {u.id !== user.uid && (
                                    <button
                                        onClick={async () => {
                                            if (confirm(`¿Eliminar permanentemente a "${u.displayName || u.email}"?`)) {
                                                await adminDeleteUser(u.id);
                                            }
                                        }}
                                        className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <button onClick={() => setIsCreatingHousehold(true)} className="w-full py-3 bg-slate-800 border border-slate-700 border-dashed rounded-xl text-slate-400 hover:border-primary hover:text-primary transition-colors flex justify-center items-center gap-2">
                            <Plus size={20} /> Crear Nuevo Hogar
                        </button>

                        {isCreatingHousehold && (
                            <form onSubmit={handleCreateHousehold} className="bg-slate-800 p-4 rounded-xl flex gap-2">
                                <input className="flex-1 bg-black/20 rounded p-2 text-sm" placeholder="Nombre del hogar" value={newHouseholdName} onChange={e => setNewHouseholdName(e.target.value)} autoFocus />
                                <button type="submit" className="text-sm bg-primary text-black font-bold px-3 rounded">Guardar</button>
                                <button type="button" onClick={() => setIsCreatingHousehold(false)} className="text-xs text-red-400 px-2">X</button>
                            </form>
                        )}

                        {households.map(h => {
                            const creator = users.find(u => u.id === h.createdBy);
                            const isEditing = editingHousehold === h.id;
                            const isCurrent = currentHousehold?.id === h.id;

                            return (
                                <div key={h.id} className={`p-4 rounded-xl border relative overflow-hidden group transition-all ${isCurrent ? 'bg-emerald-500/10 border-emerald-500' : 'bg-surface border-slate-700'}`}>
                                    {isCurrent && <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-bl">ACTUAL</div>}

                                    <div className="flex justify-between items-start mb-2 relative z-10">
                                        <div className="flex items-center gap-3 w-full">
                                            <div className={`p-2 rounded-lg ${isCurrent ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                                                <Home size={20} className={isCurrent ? 'text-emerald-400' : 'text-primary'} />
                                            </div>

                                            {isEditing ? (
                                                <div className="flex-1 flex gap-2">
                                                    <input className="flex-1 bg-black/50 text-white rounded px-2" defaultValue={h.name} id={`edit-name-${h.id}`} />
                                                    <button onClick={() => handleUpdateHousehold(h.id, document.getElementById(`edit-name-${h.id}`).value)} className="text-green-400 text-xs font-bold">OK</button>
                                                    <button onClick={() => setEditingHousehold(null)} className="text-red-400 text-xs">X</button>
                                                </div>
                                            ) : (
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center">
                                                        <h3
                                                            className={`font-bold text-lg cursor-pointer hover:text-primary transition-colors ${isCurrent ? 'text-emerald-400' : ''}`}
                                                            onClick={() => setEditingHousehold(h.id)}
                                                        >
                                                            {h.name}
                                                        </h3>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {!isCurrent && (
                                                                <button
                                                                    onClick={async () => {
                                                                        if (confirm(`¿Entrar al hogar "${h.name}" como Administrador?`)) {
                                                                            await adminSwitchHousehold(h.id);
                                                                        }
                                                                    }}
                                                                    className="p-1.5 bg-slate-700 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded transition-colors flex items-center gap-1"
                                                                    title="Entrar a este hogar"
                                                                >
                                                                    <LogIn size={14} /> <span className="text-[10px] font-bold">ENTRAR</span>
                                                                </button>
                                                            )}
                                                            <button onClick={() => setEditingHousehold(h.id)} className="p-1.5 bg-slate-700 hover:bg-white text-slate-400 hover:text-black rounded transition-colors"><Edit size={14} /></button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm(`¿Eliminar EL HOGAR "${h.name}" y todos sus datos? (No se puede deshacer)`)) {
                                                                        await adminDeleteHousehold(h.id);
                                                                    }
                                                                }}
                                                                className="p-1.5 bg-slate-700 hover:bg-red-600 text-slate-400 hover:text-white rounded transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-slate-400 font-mono bg-black/30 px-2 py-0.5 rounded inline-block mt-1 border border-slate-700">
                                                        CÓDIGO: <span className="text-white font-bold tracking-widest">{h.code}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Members */}
                                    <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-500">MIEMBROS ({h.members?.length || 0})</span>
                                            <button onClick={() => setShowAddUserModal(h.id)} className="text-[10px] bg-slate-800 px-2 py-1 rounded hover:bg-slate-700 text-primary">+ AÑADIR</button>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {h.members?.map(mid => {
                                                const mem = users.find(u => u.id === mid);
                                                return (
                                                    <span key={mid} className="text-xs px-2 py-1 bg-slate-800 rounded-full flex items-center gap-1 border border-slate-700">
                                                        <Avatar url={mem?.photoURL} size="xs" /> {mem?.displayName || '...'}
                                                    </span>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            {/* ADD USER MODAL */}
            {
                showAddUserModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-surface w-full max-w-sm rounded-xl p-4 shadow-2xl border border-slate-700">
                            <h3 className="font-bold text-lg mb-4">Añadir usuario a hogar</h3>
                            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                                {users.filter(u => !u.householdId || u.householdId !== showAddUserModal).map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => setSelectedUserToAdd(u.id)}
                                        className={`w-full text-left p-2 rounded flex items-center gap-3 hover:bg-slate-800 border ${selectedUserToAdd === u.id ? 'border-primary bg-primary/10' : 'border-transparent'}`}
                                    >
                                        <Avatar url={u.photoURL} size="xs" />
                                        <div className="overflow-hidden">
                                            <div className="font-bold text-sm truncate">{u.displayName}</div>
                                            <div className="text-[10px] text-slate-400 truncate">{u.email}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleAddUserToHousehold} disabled={!selectedUserToAdd} className="flex-1 bg-primary text-black font-bold py-2 rounded disabled:opacity-50">Añadir</button>
                                <button onClick={() => { setShowAddUserModal(false); setSelectedUserToAdd(""); }} className="flex-1 bg-slate-800 py-2 rounded">Cancelar</button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
}

const AccessDenied = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <ShieldAlert size={64} className="text-red-500" />
        <h1 className="text-2xl font-bold">Acceso Denegado</h1>
        <Link to="/" className="text-primary hover:underline">Volver al inicio</Link>
    </div>
);

const Avatar = ({ url, size = 'md' }) => {
    const s = size === 'xs' ? 'w-6 h-6' : 'w-10 h-10';
    if (!url) return <div className={`${s} bg-slate-700 rounded-full flex items-center justify-center`}><User size={size === 'xs' ? 14 : 20} /></div>
    return <img src={url} className={`${s} rounded-full border border-slate-600`} />
}
