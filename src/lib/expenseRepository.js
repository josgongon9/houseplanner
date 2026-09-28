import { db, doc, runTransaction } from './firebase';
import { validateExpenseAllocation } from './expenseAllocation';
import { reimbursedCents, validateReimbursedEdit } from './commonAccount';

async function editRecord(collection, householdId, id, data) {
    const payload = { ...data };
    if ('amount' in payload) payload.amount = Number(payload.amount);
    const ref = doc(db, collection, id);
    await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists() || snapshot.data().householdId !== householdId) throw new Error('No se encuentra el registro.');
        const current = snapshot.data();
        validateExpenseAllocation({ ...current, ...payload });
        if (collection === 'expenses') validateReimbursedEdit(current, payload);
        transaction.update(ref, payload);
    });
}

export const editExpenseRecord = (householdId, id, data) => editRecord('expenses', householdId, id, data);
// Rules affect future generation only; existing monthly expenses remain snapshots.
export const editRecurringRecord = (householdId, id, data) => editRecord('recurringExpenses', householdId, id, data);

export async function deleteExpenseRecord(householdId, id) {
    const ref = doc(db, 'expenses', id);
    await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists() || snapshot.data().householdId !== householdId) throw new Error('No se encuentra el gasto.');
        if (reimbursedCents(snapshot.data())) throw new Error('Anula los reembolsos antes de eliminar este gasto.');
        transaction.delete(ref);
    });
}
