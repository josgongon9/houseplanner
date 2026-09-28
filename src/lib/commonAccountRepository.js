import { db, doc, runTransaction } from './firebase';
import { appendReimbursement, isCommonExpense, pendingCents, expenseDay } from './commonAccount';

// Read every advance before writing: a monthly settlement succeeds in full or not at all.
export async function settleCommonMonth(householdId, payerId, month, items, payment) {
    if (!householdId || !payerId || !items.length || new Set(items.map(item => item.id)).size !== items.length) throw new Error('No hay saldo para liquidar.');
    const refs = items.map(item => doc(db, 'expenses', item.id));
    await runTransaction(db, async transaction => {
        const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
        const updates = snapshots.map((snapshot, index) => {
            const expense = snapshot.exists() && snapshot.data();
            if (!expense || expense.householdId !== householdId || expense.payerId !== payerId || !isCommonExpense(expense) || expenseDay(expense).slice(0, 7) !== month) throw new Error('Los gastos han cambiado. Revisa el saldo e inténtalo de nuevo.');
            const existing = (expense.reimbursements || []).find(item => item.id === payment.id);
            if (existing && existing.amountCents === items[index].amountCents) return null;
            if (pendingCents(expense) !== items[index].amountCents) throw new Error('El saldo ha cambiado. Revísalo antes de liquidar.');
            return appendReimbursement(expense, { ...payment, amountCents: items[index].amountCents });
        });
        updates.forEach((reimbursements, index) => { if (reimbursements) transaction.update(refs[index], { reimbursements }); });
    });
}

export async function undoCommonSettlement(householdId, expenseIds, paymentId) {
    const refs = expenseIds.map(id => doc(db, 'expenses', id));
    await runTransaction(db, async transaction => {
        const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
        const updates = snapshots.map(snapshot => {
            if (!snapshot.exists() || snapshot.data().householdId !== householdId) throw new Error('No se encuentra la liquidación.');
            return (snapshot.data().reimbursements || []).filter(item => item.id !== paymentId);
        });
        updates.forEach((reimbursements, index) => transaction.update(refs[index], { reimbursements }));
    });
}

export async function saveCommonReimbursement(householdId, expenseId, reimbursement) {
    if (!householdId || !expenseId) throw new Error('Selecciona un hogar.');
    const ref = doc(db, 'expenses', expenseId);
    await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists() || snapshot.data().householdId !== householdId) throw new Error('No se encuentra el gasto.');
        transaction.update(ref, { reimbursements: appendReimbursement(snapshot.data(), reimbursement) });
    });
}

export async function removeCommonReimbursement(householdId, expenseId, reimbursementId) {
    const ref = doc(db, 'expenses', expenseId);
    await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists() || snapshot.data().householdId !== householdId) throw new Error('No se encuentra el gasto.');
        transaction.update(ref, { reimbursements: (snapshot.data().reimbursements || []).filter(item => item.id !== reimbursementId) });
    });
}
