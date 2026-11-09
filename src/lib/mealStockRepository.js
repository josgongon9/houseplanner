import { db, collection, getDocs, query, where, writeBatch } from './firebase';

export async function clearMealStock(householdId) {
    if (!householdId) throw new Error('No hay un hogar seleccionado.');

    const snapshot = await getDocs(query(collection(db, 'meals'), where('householdId', '==', householdId)));
    // Firestore batches support up to 500 writes.
    for (let offset = 0; offset < snapshot.docs.length; offset += 500) {
        const batch = writeBatch(db);
        snapshot.docs.slice(offset, offset + 500).forEach(meal => batch.update(meal.ref, { quantity: 0 }));
        await batch.commit();
    }
}
