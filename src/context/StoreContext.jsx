import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
    db, auth, googleProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged,
    collection, addDoc, updateDoc, setDoc, deleteDoc, doc, onSnapshot, getDoc, getDocs,
    query, orderBy, where, serverTimestamp
} from "../lib/firebase";

const StoreContext = createContext();

export const useStore = () => useContext(StoreContext);

export const StoreProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [household, setHousehold] = useState(null); // { id, name, code, createdBy }
    const [householdMembers, setHouseholdMembers] = useState([]); // Array of user profiles

    // Data tied to the household
    const [meals, setMeals] = useState([]);
    const [menu, setMenu] = useState({});
    const [expenses, setExpenses] = useState([]); // New Module

    const [isLoading, setIsLoading] = useState(true);

    // Listener Ref to avoid leaks when switching households
    const householdListenerRef = useRef(null);

    // 1. Authentication & Profile Sync
    useEffect(() => {
        if (!auth) { setIsLoading(false); return; }

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setHousehold(null);
                setHouseholdMembers([]);
                setMeals([]);
                setMenu({});
                setExpenses([]);
                setUserRole(null);
                setIsLoading(false);
            } else {
                // Fetch User Profile
                const userRef = doc(db, "users", currentUser.uid);
                try {
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        setUserRole(userData.role || 'user');
                        // If user has a householdId, fetch household details immediately
                        if (userData.householdId) {
                            fetchHousehold(userData.householdId);
                        } else {
                            setHousehold(null);
                            setIsLoading(false); // Done loading (user needs to setup home)
                        }
                    } else {
                        // Create Profile
                        await setDoc(userRef, {
                            email: currentUser.email,
                            displayName: currentUser.displayName,
                            photoURL: currentUser.photoURL,
                            role: 'user',
                            createdAt: new Date().toISOString()
                        });
                        setUserRole('user');
                        setHousehold(null);
                        setIsLoading(false);
                    }
                } catch (e) {
                    console.error("Error fetching user", e);
                    setIsLoading(false);
                }
            }
        });

        return () => unsubscribeAuth();
    }, []);

    // Helper: Fetch Household Details
    const fetchHousehold = (householdId) => {
        // Cleanup previous listener if exists
        if (householdListenerRef.current) {
            householdListenerRef.current();
            householdListenerRef.current = null;
        }

        // We set up a listener for the household itself (in case name changes etc)
        householdListenerRef.current = onSnapshot(doc(db, "households", householdId), (doc) => {
            if (doc.exists()) {
                setHousehold({ id: doc.id, ...doc.data() });
            } else {
                setHousehold(null); // Should handle "removed from home" scenario here
            }
        });
    };

    // 2. Data Sync (Only when Household is set)
    useEffect(() => {
        if (!user || !household) return;

        // A. Meals (Filtered by Household)
        const qMeals = query(collection(db, "meals"), where("householdId", "==", household.id));
        const unsubMeals = onSnapshot(qMeals, (snapshot) => {
            setMeals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // B. Menu (Filtered by Household)
        const qMenu = query(collection(db, "menu"), where("householdId", "==", household.id));
        const unsubMenu = onSnapshot(qMenu, (snapshot) => {
            const menuData = {};
            snapshot.docs.forEach(d => {
                const compositeKey = d.id;
                const localKey = compositeKey.replace(`${household.id}_`, '');
                menuData[localKey] = d.data().mealId;
            });
            setMenu(menuData);
        });

        // C. Expenses (New Module)
        const qExpenses = query(collection(db, "expenses"), where("householdId", "==", household.id), orderBy("date", "desc"));
        const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
            setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // D. Household Members (Fetch profiles)
        const qMembers = query(collection(db, "users"), where("householdId", "==", household.id));
        const unsubMembers = onSnapshot(qMembers, (snapshot) => {
            setHouseholdMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        setIsLoading(false);

        return () => {
            unsubMeals();
            unsubMenu();
            unsubExpenses();
            unsubMembers();
        };
    }, [household]); // Re-run if household changes

    // ACTIONS ------------------

    const login = async () => {
        try { await signInWithPopup(auth, googleProvider); }
        catch (error) { console.error(error); alert(error.message); }
    };

    const logout = async () => { await signOut(auth); };

    // Household Actions
    const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

    const createHousehold = async (name) => {
        if (!user) return;
        const code = generateCode();
        const newHomeRef = await addDoc(collection(db, "households"), {
            name,
            code,
            createdBy: user.uid,
            members: [user.uid],
            createdAt: new Date().toISOString()
        });

        // Update User
        await updateDoc(doc(db, "users", user.uid), { householdId: newHomeRef.id });
        fetchHousehold(newHomeRef.id);
    };

    const joinHousehold = async (code) => {
        if (!user) return;
        // Find household by code
        const q = query(collection(db, "households"), where("code", "==", code.toUpperCase().trim()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("Código no válido. No se encontró el hogar.");
        }

        const householdDoc = querySnapshot.docs[0];
        const householdData = householdDoc.data();

        // Check if already member
        if (!householdData.members.includes(user.uid)) {
            const newMembers = [...(householdData.members || []), user.uid];
            await updateDoc(doc(db, "households", householdDoc.id), { members: newMembers });
        }

        // Update User profile
        await updateDoc(doc(db, "users", user.uid), { householdId: householdDoc.id });

        // Force refresh
        fetchHousehold(householdDoc.id);
    };

    const addMeal = async (name, type, quantity) => {
        if (!user || !household) return;
        await addDoc(collection(db, "meals"), {
            name, type, quantity: Number(quantity) || 0,
            householdId: household.id
        });
    };

    const updateMealStock = async (id, quantity) => {
        if (!user) return;
        await updateDoc(doc(db, "meals", id), { quantity: Number(quantity) });
    };

    const deleteMeal = async (id) => {
        if (!user) return;
        await deleteDoc(doc(db, "meals", id));
    };

    const setMenuItem = async (date, type, mealId) => {
        if (!user || !household) return;
        const localKey = `${date}-${type}`;
        const compositeId = `${household.id}_${localKey}`;
        const menuRef = doc(db, "menu", compositeId);

        if (!mealId) {
            await deleteDoc(menuRef);
        } else {
            await setDoc(menuRef, {
                mealId,
                householdId: household.id,
                date, // useful for filtering
                type
            });
        }
    };

    // Expenses Actions
    const addExpense = async (title, amount, category, payerId, splitAmong, splitMode = 'equal', customAmounts = {}) => {
        if (!user || !household) return;
        await addDoc(collection(db, "expenses"), {
            title,
            amount: Number(amount),
            category,
            date: new Date().toISOString(),
            householdId: household.id,
            payerId: payerId || user.uid, // Who paid?
            splitAmong: splitAmong || householdMembers.map(m => m.id), // Who is is for? (Array of IDs)
            splitMode,
            customAmounts
        });
    };

    const switchHousehold = async (targetHouseholdId) => {
        if (!user) return;
        // Verify (optimistic) and update
        await updateDoc(doc(db, "users", user.uid), { householdId: targetHouseholdId });
        // Manually switch context
        fetchHousehold(targetHouseholdId);
    };

    const updateExpense = async (id, data) => {
        if (!user || !household) return;
        const payload = { ...data };
        if (payload.amount) payload.amount = Number(payload.amount);
        await updateDoc(doc(db, "expenses", id), payload);
    }

    const deleteExpense = async (id) => {
        if (!user || !household) return;
        await deleteDoc(doc(db, "expenses", id));
    }

    // Admin Actions
    const adminAddUserToHousehold = async (userId, householdId) => {
        if (!user || userRole !== 'admin') return;

        // 1. Get current data to be safe
        const houseRef = doc(db, "households", householdId);
        const houseSnap = await getDoc(houseRef);
        if (!houseSnap.exists()) throw new Error("Hogar no encontrado");

        const currentMembers = houseSnap.data().members || [];
        if (!currentMembers.includes(userId)) {
            await updateDoc(houseRef, { members: [...currentMembers, userId] });
        }

        // 2. Update User
        await updateDoc(doc(db, "users", userId), { householdId: householdId });
    };

    const adminCreateHousehold = async (name) => {
        if (!user || userRole !== 'admin') return;
        const code = generateCode();
        await addDoc(collection(db, "households"), {
            name,
            code,
            createdBy: user.uid,
            members: [],
            createdAt: new Date().toISOString()
        });
    }

    const adminUpdateHousehold = async (id, data) => {
        if (!user || userRole !== 'admin') return;
        await updateDoc(doc(db, "households", id), data);
    }

    const adminSwitchHousehold = async (targetHouseholdId) => {
        if (!user || userRole !== 'admin') return;

        // 1. Ensure Admin is a member of the target household
        const houseRef = doc(db, "households", targetHouseholdId);
        const houseSnap = await getDoc(houseRef);
        if (!houseSnap.exists()) throw new Error("Hogar no encontrado");

        const currentMembers = houseSnap.data().members || [];
        if (!currentMembers.includes(user.uid)) {
            await updateDoc(houseRef, { members: [...currentMembers, user.uid] });
        }

        // 2. Switch Admin to that household
        await updateDoc(doc(db, "users", user.uid), { householdId: targetHouseholdId });
        // The listener in useEffect will handle the context switch
    }

    const adminCreateGhostUser = async (name) => {
        if (!user || userRole !== 'admin') return;
        const fakeUid = `ghost_${Date.now()}`;
        await setDoc(doc(db, "users", fakeUid), {
            uid: fakeUid,
            displayName: name + " (Test)",
            email: `ghost_${Date.now()}@test.local`,
            photoURL: null,
            role: 'user',
            isGhost: true,
            createdAt: new Date().toISOString()
        });
    }

    const adminDeleteUser = async (userId) => {
        if (!user || userRole !== 'admin') return;
        await deleteDoc(doc(db, "users", userId));
    };

    const adminDeleteHousehold = async (householdId) => {
        if (!user || userRole !== 'admin') return;
        await deleteDoc(doc(db, "households", householdId));
    };

    return (
        <StoreContext.Provider value={{
            user, userRole, household, householdMembers, login, logout,
            createHousehold, joinHousehold,
            meals, menu, expenses,
            addMeal, updateMealStock, deleteMeal, setMenuItem, addExpense, updateExpense, deleteExpense,
            // User Actions
            switchHousehold,
            // Admin exports
            adminAddUserToHousehold, adminCreateHousehold, adminUpdateHousehold, adminSwitchHousehold, adminCreateGhostUser,
            adminDeleteUser, adminDeleteHousehold,
            isLoading
        }}>
            {children}
        </StoreContext.Provider>
    );
};
