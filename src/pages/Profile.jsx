import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { db, collection, query, where, getDocs, doc, updateDoc, documentId, getDoc } from '../lib/firebase';
import { User, Home, LogOut, Check, Plus, Loader2, UserMinus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
    const { user, household, switchHousehold, leaveHousehold, removeMember, logout, createHousehold, joinHousehold, toggleFinanceModule } = useStore();
    const [userInfo, setUserInfo] = useState(null); // Local storage of extended user data
    const [myHouseholds, setMyHouseholds] = useState([]);
    const [loadingHomes, setLoadingHomes] = useState(true);
    const [expandedHome, setExpandedHome] = useState(null);
    const [homeMembers, setHomeMembers] = useState({});
    const [loadingMembers, setLoadingMembers] = useState(false);

    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [newHomeName, setNewHomeName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;

        // Fetch User Info for Toggles
        const fetchUserData = async () => {
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists()) setUserInfo(snap.data());
        }
        fetchUserData();

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

    const fetchHomeMembers = async (home) => {
        if (expandedHome?.id === home.id) {
            setExpandedHome(null);
            return;
        }

        setExpandedHome(home);
        if (homeMembers[home.id]) return; // Already fetched

        setLoadingMembers(true);
        try {
            const memberIds = home.members || [];
            if (memberIds.length === 0) return;

            // Fetch users in chunks (limit 10 for 'in' query)
            const users = [];
            for (let i = 0; i < memberIds.length; i += 10) {
                const chunk = memberIds.slice(i, i + 10);
                // Use documentId() because the uid is the document ID
                const q = query(collection(db, "users"), where(documentId(), "in", chunk));
                const snap = await getDocs(q);
                snap.docs.forEach(d => users.push({ uid: d.id, ...d.data() }));
            }

            setHomeMembers(prev => ({ ...prev, [home.id]: users }));
        } catch (error) {
            console.error("Error fetching members", error);
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleRemoveMember = async (homeId, member) => {
        const isSelf = member.uid === user.uid;
        const msg = isSelf
            ? `¿Estás seguro de que quieres salir del hogar?`
            : `¿Eliminar a ${member.displayName} de este hogar?`;

        if (confirm(msg)) {
            await removeMember(homeId, member.uid);

            // If it was self, the context might reload.
            // If it was someone else, refresh the list locally
            if (!isSelf) {
                setHomeMembers(prev => ({
                    ...prev,
                    [homeId]: prev[homeId].filter(m => m.uid !== member.uid)
                }));
                // Also update the member count in myHouseholds if needed
                setMyHouseholds(prev => prev.map(h =>
                    h.id === homeId
                        ? { ...h, members: h.members.filter(id => id !== member.uid) }
                        : h
                ));
            }
        }
    };

    const handleSwitch = async (id) => {
        if (id === household?.id) return;
        await switchHousehold(id);
    };

    const handleLeave = async (e, house) => {
        e.stopPropagation();
        if (confirm(`¿Seguro que quieres salir del hogar "${house.name}"?`)) {
            await leaveHousehold(house.id);
            if (house.id !== household?.id) {
                setMyHouseholds(prev => prev.filter(h => h.id !== house.id));
            }
        }
    }

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
        window.location.reload();
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

            {/* Feature Toggles */}
            <div className="bg-surface p-6 rounded-2xl border border-slate-700 shadow-lg space-y-4">
                <h3 className="font-bold text-slate-300 flex items-center gap-2">
                    <Check size={20} className="text-emerald-500" /> Configuración de Módulos
                </h3>
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <div>
                        <h4 className="font-bold text-white">Finanzas Personales</h4>
                        <p className="text-xs text-slate-400">Activa el control de patrimonio, inversiones y año fiscal.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={userInfo?.financeEnabled || false}
                            onChange={async (e) => {
                                const newVal = e.target.checked;
                                setUserInfo(prev => ({ ...prev, financeEnabled: newVal })); // Optimistic
                                await toggleFinanceModule(newVal);
                            }}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
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
                            <div key={home.id} className="space-y-2">
                                <div
                                    className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${household?.id === home.id
                                        ? 'bg-emerald-500/5 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                        : 'bg-surface border-slate-700 hover:border-slate-500'
                                        }`}
                                >
                                    <div
                                        className="text-left flex-1 cursor-pointer"
                                        onClick={() => handleSwitch(home.id)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <h4 className={`font-bold ${household?.id === home.id ? 'text-emerald-400' : 'text-slate-200'}`}>
                                                {home.name}
                                            </h4>
                                            {household?.id === home.id && (
                                                <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Activo</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 font-mono">Código: {home.code}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => fetchHomeMembers(home)}
                                            className={`p-2 rounded-lg transition-colors ${expandedHome?.id === home.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                                            title="Ver miembros"
                                        >
                                            <Plus size={18} className={`transition-transform duration-300 ${expandedHome?.id === home.id ? 'rotate-45' : ''}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Members List Table */}
                                {expandedHome?.id === home.id && (
                                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 animate-in slide-in-from-top-2">
                                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Miembros del Hogar</h5>
                                        {loadingMembers && !homeMembers[home.id] ? (
                                            <div className="flex justify-center p-2"><Loader2 className="w-4 h-4 animate-spin text-slate-500" /></div>
                                        ) : (
                                            <div className="space-y-2">
                                                {(homeMembers[home.id] || []).map(member => (
                                                    <div key={member.uid} className="flex items-center justify-between bg-surface/50 p-2 rounded-lg border border-slate-800/50">
                                                        <div className="flex items-center gap-2">
                                                            {member.photoURL ? (
                                                                <img src={member.photoURL} alt="" className="w-6 h-6 rounded-full" />
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-400">
                                                                    {member.displayName?.charAt(0)}
                                                                </div>
                                                            )}
                                                            <span className={`text-sm ${member.uid === user.uid ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                                                                {member.displayName} {member.uid === user.uid && '(Tú)'}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveMember(home.id, member)}
                                                            className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                                                            title={member.uid === user.uid ? "Salir del hogar" : "Eliminar del hogar"}
                                                        >
                                                            <UserMinus size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
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
