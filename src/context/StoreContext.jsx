import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
    db, auth, googleProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged,
    collection, addDoc, updateDoc, setDoc, deleteDoc, doc, onSnapshot, getDoc, getDocs,
    query, orderBy, where, serverTimestamp, runTransaction
} from "../lib/firebase";

const StoreContext = createContext();

export const useStore = () => useContext(StoreContext);

export const StoreProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null); // Full user profile including settings
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
    const userListenerRef = useRef(null);

    // 1. Authentication & Profile Sync
    useEffect(() => {
        if (!auth) { setIsLoading(false); return; }

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setUserData(null);
                setHousehold(null);
                setHouseholdMembers([]);
                setMeals([]);
                setMenu({});
                setExpenses([]);
                setUserRole(null);
                setIsLoading(false);
                if (userListenerRef.current) userListenerRef.current();
            } else {
                // Real-time listener for User Profile
                if (userListenerRef.current) userListenerRef.current();
                userListenerRef.current = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserData(data);
                        setUserRole(data.role || 'user');

                        // Handle Household connection
                        if (data.householdId && (!household || household.id !== data.householdId)) {
                            fetchHousehold(data.householdId);
                        } else if (!data.householdId) {
                            setHousehold(null);
                            setIsLoading(false);
                        }
                    } else {
                        // Create Profile if missing
                        setDoc(doc(db, "users", currentUser.uid), {
                            email: currentUser.email,
                            displayName: currentUser.displayName,
                            photoURL: currentUser.photoURL,
                            role: 'user',
                            createdAt: new Date().toISOString()
                        });
                    }
                }, (error) => {
                    console.error("Error fetching user", error);
                    setIsLoading(false);
                });
            }
        });

        return () => {
            unsubscribeAuth();
            if (userListenerRef.current) userListenerRef.current();
        };
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
                // Store the entire data object to support both formats
                menuData[localKey] = d.data();
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

        // E. Process past days to update stock
        processPassedDays();

        return () => {
            unsubMeals();
            unsubMenu();
            unsubExpenses();
            unsubMembers();
        };
    }, [household]); // Re-run if household changes

    // Process passed days to automatically reduce stock
    const processPassedDays = async () => {
        if (!user || !household) return;

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get all menu entries for this household
            const menuQuery = query(
                collection(db, "menu"),
                where("householdId", "==", household.id)
            );
            const menuSnapshot = await getDocs(menuQuery);

            // Get all meals to build a map
            const mealsQuery = query(
                collection(db, "meals"),
                where("householdId", "==", household.id)
            );
            const mealsSnapshot = await getDocs(mealsQuery);
            const mealsMap = {};
            mealsSnapshot.docs.forEach(doc => {
                mealsMap[doc.id] = { id: doc.id, ...doc.data() };
            });

            let processedCount = 0;

            // Process each menu entry using transactions (prevents race conditions)
            for (const menuDoc of menuSnapshot.docs) {
                const menuData = menuDoc.data();
                const menuDate = new Date(menuData.date);
                menuDate.setHours(0, 0, 0, 0);

                // Only process if date is in the past
                if (menuDate < today) {
                    try {
                        // Use a transaction to atomically check and mark as processed
                        await runTransaction(db, async (transaction) => {
                            const menuRef = doc(db, "menu", menuDoc.id);
                            const freshMenuDoc = await transaction.get(menuRef);

                            if (!freshMenuDoc.exists()) return;

                            const freshMenuData = freshMenuDoc.data();

                            // Check if already processed (inside transaction)
                            if (freshMenuData.processed) {
                                return; // Already processed, skip
                            }

                            // Calculate stock reductions
                            let mealsToProcess = [];
                            if (freshMenuData.meals && Array.isArray(freshMenuData.meals)) {
                                mealsToProcess = freshMenuData.meals;
                            } else if (freshMenuData.mealId) {
                                mealsToProcess = [{ mealId: freshMenuData.mealId, portion: 1 }];
                            }

                            // Perform all READS first
                            const mealUpdates = [];
                            for (const { mealId, portion } of mealsToProcess) {
                                const mealRef = doc(db, "meals", mealId);
                                const mealDoc = await transaction.get(mealRef);
                                if (mealDoc.exists()) {
                                    const currentQuantity = mealDoc.data().quantity || 0;
                                    const newQuantity = Math.max(0, Number(currentQuantity) - Number(portion));
                                    mealUpdates.push({ mealRef, newQuantity });
                                }
                            }

                            // Perform all WRITES after
                            transaction.update(menuRef, { processed: true });
                            for (const update of mealUpdates) {
                                transaction.update(update.mealRef, { quantity: update.newQuantity });
                            }

                            processedCount++;
                        });
                    } catch (error) {
                        if (error.code === 'aborted') {
                            // Transaction was aborted (likely due to concurrent modification)
                            // This is normal and expected in race conditions
                            console.log('Transaction aborted for', menuDoc.id, '- Already processed by another user');
                        } else {
                            console.error('Error processing menu entry', menuDoc.id, error);
                        }
                    }
                }
            }

            if (processedCount > 0) {
                console.log(`✅ Procesados ${processedCount} días pasados y stock actualizado`);
            }
        } catch (error) {
            console.error("Error processing passed days:", error);
        }
    };

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

    const updateMeal = async (id, data) => {
        if (!user) return;
        await updateDoc(doc(db, "meals", id), data);
    };

    const deleteMeal = async (id) => {
        if (!user) return;
        await deleteDoc(doc(db, "meals", id));
    };

    const setMenuItem = async (date, type, meals) => {
        if (!user || !household) return;
        const localKey = `${date}-${type}`;
        const compositeId = `${household.id}_${localKey}`;
        const menuRef = doc(db, "menu", compositeId);

        if (!meals || meals.length === 0) {
            await deleteDoc(menuRef);
        } else {
            await setDoc(menuRef, {
                meals, // Array of {mealId, portion}
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

    const leaveHousehold = async (householdId) => {
        await removeMember(householdId, user.uid);
    };

    const removeMember = async (householdId, memberId) => {
        if (!user) return;

        // 1. Remove from Household members
        const houseRef = doc(db, "households", householdId);
        const houseSnap = await getDoc(houseRef);
        if (houseSnap.exists()) {
            const currentMembers = houseSnap.data().members || [];
            const newMembers = currentMembers.filter(uid => uid !== memberId);
            await updateDoc(houseRef, { members: newMembers });
        }

        // 2. Clear user's active household if it's the one they are leaving/removed from
        const userRef = doc(db, "users", memberId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().householdId === householdId) {
            await updateDoc(userRef, { householdId: null });
        }

        // If current user left their active household, reload
        if (memberId === user.uid && householdId === household?.id) {
            window.location.reload();
        }
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

    const addExpenseCategory = async (name, icon) => {
        if (!user || !household) return;
        const newCategory = {
            id: `custom_${Date.now()}`,
            name,
            icon: icon || '📦',
            color: '#64748B' // Default slate color
        };
        const currentCategories = household.expenseCategories || [];
        await updateDoc(doc(db, "households", household.id), {
            expenseCategories: [...currentCategories, newCategory]
        });
    };

    const deleteExpenseCategory = async (categoryId) => {
        if (!user || !household) return;
        const currentCategories = household.expenseCategories || [];
        await updateDoc(doc(db, "households", household.id), {
            expenseCategories: currentCategories.filter(c => c.id !== categoryId)
        });
    };

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

    const toggleFinanceModule = async (enabled) => {
        if (!user) return;
        await updateDoc(doc(db, "users", user.uid), { financeEnabled: enabled });
        // The user listener will pick this up automatically as it syncs the 'user' state
    };

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
            user, userData, userRole, household, householdMembers, login, logout,
            createHousehold, joinHousehold,
            meals, menu, expenses,
            addMeal, updateMealStock, updateMeal, deleteMeal, setMenuItem, addExpense, updateExpense, deleteExpense,
            addExpenseCategory, deleteExpenseCategory,
            // User Actions
            switchHousehold, leaveHousehold, removeMember,
            // Admin exports
            adminAddUserToHousehold, adminCreateHousehold, adminUpdateHousehold, adminSwitchHousehold, adminCreateGhostUser,
            adminDeleteUser, adminDeleteHousehold,
            toggleFinanceModule,
            isLoading
        }}>
            {children}
        </StoreContext.Provider>
    );
};
