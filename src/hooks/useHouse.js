import { useEffect, useState } from 'react';
import { db, doc, onSnapshot, runTransaction } from '../lib/firebase';
import { houseName, houseCategories } from '../lib/house';

export default function useHouse(householdId) {
    const [state, setState] = useState({ id: null, data: {}, loading: true, error: '' });
    useEffect(() => {
        if (!householdId) return;
        return onSnapshot(doc(db, 'households', householdId), snapshot => {
            setState({ id: householdId, data: snapshot.data()?.houseModule || {}, loading: false, error: snapshot.exists() ? '' : 'Hogar no disponible.' });
        }, () => setState({ id: householdId, data: {}, loading: false, error: 'No se han podido cargar los datos de Casa.' }));
    }, [householdId]);
    async function manageCategory(name, remove = false) {
        const cleanName = name.trim();
        if (!householdId || !cleanName || cleanName.length > 60) throw new Error('Introduce una categoría de hasta 60 caracteres.');
        await runTransaction(db, async transaction => {
            const ref = doc(db, 'households', householdId);
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) throw new Error('Hogar no disponible.');
            const data = snapshot.data().houseModule || {};
            const categories = houseCategories(data);
            const existing = categories.find(c => houseName(c) === houseName(cleanName));
            if (!remove) {
                if (existing) throw new Error('Ya existe una categoría con ese nombre.');
                transaction.update(ref, { 'houseModule.categories': [...categories, cleanName] });
                return;
            }
            if (houseName(cleanName) === houseName('Otros')) throw new Error('La categoría Otros no se puede eliminar.');
            if (!existing) throw new Error('Esta categoría ya se ha eliminado.');
            const items = (data.items || []).map(item => houseName(item.category) === houseName(existing)
                ? { ...item, category: 'Otros', version: (item.version || 0) + 1 } : item);
            transaction.update(ref, {
                'houseModule.categories': categories.filter(c => c !== existing),
                'houseModule.items': items,
            });
        });
    }
    async function change(section, records, remove = false, createCategory = false) {
        if (!householdId) throw new Error('Selecciona un hogar.');
        if (!['items', 'payments', 'savings', 'goals'].includes(section)) throw new Error('Sección no válida.');
        await runTransaction(db, async transaction => {
            const ref = doc(db, 'households', householdId);
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) throw new Error('Hogar no disponible.');
            const data = snapshot.data().houseModule || {};
            const categories = houseCategories(data);
            let categoriesChanged = false;
            let list = [...(data[section] || [])];
            for (const record of records) {
                if (!remove && section === 'items' && record.status === 'purchased' && (!Number.isSafeInteger(record.actual) || record.actual < 0)) throw new Error('Indica el precio real para marcar el objeto como comprado.');
                if (!remove && section === 'items' && record.category && !categories.includes(record.category)) {
                    if (!createCategory) throw new Error('La categoría ha cambiado. Vuelve a seleccionar una categoría.');
                    if (categories.some(c => houseName(c) === houseName(record.category))) throw new Error('La categoría ya existe. Vuelve a seleccionarla.');
                    categories.push(record.category);
                    categoriesChanged = true;
                }
                const existing = list.find(item => item.id === record.id);
                if (existing && (existing.version || 0) !== (record.version || 0)) throw new Error('Este registro ha cambiado. Vuelve a abrirlo para editar.');
                if (!existing && record.version) throw new Error('Este registro ya se ha eliminado.');
                if (!remove && section === 'items' && list.some(item => item.id !== record.id && houseName(item.name) === houseName(record.name))) throw new Error('Ya existe un objeto con ese nombre. Edita el existente o añade una ubicación al nombre.');
                if (!remove && section === 'payments' && record.type === 'monthly' && list.some(item => item.id !== record.id && item.type === 'monthly' && item.due.slice(0, 7) === record.due.slice(0, 7))) throw new Error('Ya existe una mensualidad en ese mes.');
                list = list.filter(item => item.id !== record.id);
                if (!remove) list.push({ ...record, version: (record.version || 0) + 1 });
            }
            transaction.update(ref, { [`houseModule.${section}`]: list, ...(categoriesChanged ? { 'houseModule.categories': categories } : {}) });
        });
    }
    return { ...(state.id === householdId ? state : { data: {}, loading: true, error: '' }), change, manageCategory };
}
