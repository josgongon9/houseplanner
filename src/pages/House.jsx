import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Home, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import useHouse from '../hooks/useHouse';
import { HOUSE_STATUSES, INVENTORY_COLUMNS, compareHouseItems, money, cents, today, hasItem, houseName, houseCategories, inventoryTotals, monthlyPayments, houseProjection } from '../lib/house';
import './House.css';

const priceValue = value => value == null ? '' : value / 100;
function Field({ label, children }) { return <label className="house-field"><span>{label}</span>{children}</label>; }
function Stat({ label, value }) { return <div className="house-stat"><span>{label}</span><strong>{value}</strong></div>; }
function Progress({ value, total }) {
    const percent = total > 0 ? Math.max(0, Math.min(100, Math.round(value / total * 100))) : 0;
    return <div className="house-progress"><progress value={percent} max="100" aria-label="Progreso" /><span>{percent}%</span></div>;
}
function Actions({ name, edit, remove }) { return <div className="house-actions"><button aria-label={`Editar ${name}`} onClick={edit}><Pencil size={17} /></button><button aria-label={`Eliminar ${name}`} onClick={remove}><Trash2 size={17} /></button></div>; }

export default function House() {
    const { household, userData } = useStore();
    if (!userData?.houseEnabled) return <Navigate to="/profile" replace />;
    return <HousePanel key={household.id} householdId={household.id} />;
}

export function HousePanel({ householdId }) {
    const { data, loading, error: loadError, change, manageCategory } = useHouse(householdId);
    const [tab, setTab] = useState('items');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState('');
    const [sortKey, setSortKey] = useState('category');
    const [sortDirection, setSortDirection] = useState('asc');
    const sortBy = key => { setSortKey(key); setSortDirection(sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc'); };
    const [target, setTarget] = useState(today());
    const [editor, setEditor] = useState(null);
    const [deletion, setDeletion] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [categoryManager, setCategoryManager] = useState(false);
    const [categoryName, setCategoryName] = useState('');
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const modalOpen = Boolean(editor || deletion || categoryManager);
    useEffect(() => {
        if (!modalOpen) return;
        const modal = document.querySelector('.house-dialog');
        const controls = () => [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
        if (!modal.contains(document.activeElement)) controls()[0]?.focus();
        const keydown = event => {
            if (event.key === 'Escape' && !busy) { setEditor(null); setDeletion(null); setCategoryManager(false); }
            if (event.key !== 'Tab') return;
            const elements = controls(), first = elements[0], last = elements[elements.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', keydown);
        return () => document.removeEventListener('keydown', keydown);
    }, [modalOpen, busy]);
    const items = data.items || [], payments = data.payments || [], savings = data.savings || [], goals = data.goals || [];
    const allCategories = houseCategories(data);
    useEffect(() => {
        if (category && !houseCategories(data).includes(category)) setCategory('');
    }, [data, category]);
    const filtered = items.filter(i => houseName(i.name).includes(houseName(search)) && (!category || i.category === category) && (!status || (status === 'available' ? hasItem(i) : status === 'received' ? i.status === 'gift' && i.received : status === 'gift' ? i.status === 'gift' && !i.received : i.status === status))).sort((a, b) => compareHouseItems(a, b, sortKey, sortDirection));
    const totals = inventoryTotals(filtered);
    const projection = houseProjection(data, target);
    const open = (section, record = {}) => { setError(''); setEditor({ section, record }); };
    async function commit(section, records, remove = false, createCategory = false) {
        setBusy(true); setError('');
        try {
            if (createCategory) await change(section, records, remove, true);
            else await change(section, records, remove);
            setEditor(null); setDeletion(null);
        }
        catch (e) { setError(e.message || 'No se ha podido guardar. Inténtalo de nuevo.'); }
        finally { setBusy(false); }
    }
    async function saveCategory(name, remove = false) {
        setBusy(true); setError('');
        try {
            await manageCategory(name, remove);
            setCategoryName(''); setCategoryToDelete(null);
            if (remove && category === name) setCategory('');
        } catch (e) { setError(e.message || 'No se ha podido guardar la categoría.'); }
        finally { setBusy(false); }
    }
    async function save(event) {
        event.preventDefault();
        const f = Object.fromEntries(new FormData(event.currentTarget));
        const { section, record } = editor;
        const base = { ...record, id: record.id || crypto.randomUUID() };
        try {
            if (section === 'monthly') {
                const rows = monthlyPayments(f.start, f.end, cents(f.amount), Number(f.day));
                if (payments.some(p => rows.some(r => r.id === p.id || (p.type === 'monthly' && p.due.slice(0, 7) === r.due.slice(0, 7))))) throw new Error('Ya hay mensualidades en ese periodo. Edita las existentes o elige otro periodo.');
                await commit('payments', rows); return;
            }
            let result;
            if (section === 'items') {
                const selectedCategory = (f.category || f.newCategory || '').trim();
                f.category = allCategories.find(c => houseName(c) === houseName(selectedCategory)) || selectedCategory;
            }
            if (section === 'items') result = { ...base, name: f.name.trim(), category: f.category.trim(), status: f.status, received: f.received === 'on', payer: f.payer.trim(), estimated: cents(f.estimated), actual: cents(f.actual), notes: f.notes.trim() };
            if (section === 'payments') result = { ...base, name: f.name.trim(), type: f.type, amount: cents(f.amount), due: f.due, paidOn: f.paidOn };
            if (section === 'savings') result = { ...base, name: f.name.trim(), date: f.date, amount: cents(f.amount, true) };
            if (section === 'goals') result = { ...base, name: f.name.trim(), date: f.date, amount: cents(f.amount) };
            if (!result?.name || (section === 'items' && !result.category)) throw new Error('Completa los campos obligatorios.');
            if (section === 'items' && result.status === 'purchased' && result.actual == null) throw new Error('Indica el precio real para marcar el objeto como comprado.');
            if (section !== 'items' && (result.amount == null || result.amount === 0)) throw new Error('Introduce un importe distinto de cero.');
            if (section === 'payments' && result.paidOn > today()) throw new Error('La fecha de pago no puede ser futura.');
            await commit(section, [result], false, section === 'items' && !allCategories.includes(result.category));
        } catch (e) { setError(e.message); }
    }
    const remove = (section, record) => { setError(''); setDeletion({ section, record }); };
    if (loading) return <div className="house-page" role="status">Cargando Casa…</div>;
    if (loadError) return <div className="house-page" role="alert">{loadError}</div>;
    return <main className="house-page">
        <header className="house-header"><h1><Home size={26} /> Casa</h1><button className="house-primary" onClick={() => open(tab === 'items' ? 'items' : 'payments')}><Plus size={18} /> {tab === 'items' ? 'Añadir objeto' : 'Añadir pago'}</button></header>
        <nav className="house-tabs" aria-label="Secciones de Casa"><button aria-pressed={tab === 'items'} onClick={() => setTab('items')}>Inventario <span>{items.length}</span></button><button aria-pressed={tab === 'plan'} onClick={() => setTab('plan')}>Pagos y ahorro</button></nav>
        {error && !editor && !deletion && !categoryManager && <p role="alert" className="house-error">{error}</p>}
        {tab === 'items' ? <>
            <div className="house-category-toolbar"><button onClick={() => { setError(''); setCategoryToDelete(null); setCategoryName(''); setCategoryManager(true); }}>Gestionar categorías</button></div>
            <div className="house-filters"><Field label="Buscar"><input type="search" placeholder="Buscar objeto" value={search} onChange={e => setSearch(e.target.value)} /></Field><Field label="Categoría"><select value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas</option>{allCategories.map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Estado"><select className={`house-status-filter ${['purchased', 'received', 'available'].includes(status) ? 'house-have' : status === 'pending' ? 'house-pending' : status === 'gift' ? 'house-gift' : ''}`} value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option><option value="available">🟢 Ya lo tenemos</option><option value="pending">🟠 Pendiente</option><option value="gift">🔵 Regalo por recibir</option><option value="received">🟢 Regalo recibido</option><option value="purchased">🟢 Comprado</option></select></Field></div>
            <div className="house-stats"><Stat label="Estimado · selección" value={money(totals.estimated)} /><Stat label="Real · selección" value={money(totals.actual)} /><Stat label="Por comprar · sin regalos" value={money(totals.pending)} /><Stat label="Desviación · comprados" value={`${totals.difference > 0 ? '+' : ''}${money(totals.difference)}`} /></div>
            {!!totals.missingPrices && <p className="house-muted">{totals.missingPrices} objetos pendientes sin estimación</p>}
            <div className="house-inventory"><div className="house-table-head">{Object.entries(INVENTORY_COLUMNS).map(([key, label]) => <button key={key} aria-label={`Ordenar por ${label}`} aria-pressed={sortKey === key} onClick={() => sortBy(key)}>{label}<span aria-hidden="true">{sortKey === key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span></button>)}<span>Acciones</span></div>
                {filtered.map(item => <article className="house-item" key={item.id}>
                    <div><span className="house-mobile-label">Objeto</span><h3>{item.name}</h3>{item.notes && <p className="house-muted">{item.notes}</p>}</div>
                    <div className="house-cell house-category-cell"><span className="house-mobile-label">Categoría</span><span className="house-category-tag">{item.category}</span></div>
                    <div><span className={`house-badge ${hasItem(item) ? 'house-have' : item.status === 'gift' ? 'house-gift' : 'house-pending'}`}>{item.status === 'gift' && item.received ? 'Regalo recibido' : HOUSE_STATUSES[item.status]}</span>{item.status === 'gift' && !item.received && <small className="house-muted">Por recibir</small>}{item.status === 'pending' && <button className="house-link" onClick={() => open('items', { ...item, status: 'purchased' })}>Marcar comprado</button>}</div>
                    <div className="house-cell"><span className="house-mobile-label">Paga / regala</span>{item.payer || '—'}</div>
                    <div className="house-cell"><span className="house-mobile-label">Estimado</span>{item.estimated == null ? '—' : money(item.estimated)}</div>
                    <div className="house-cell"><span className="house-mobile-label">Real</span>{item.actual == null ? '—' : money(item.actual)}</div>
                    <Actions name={item.name} edit={() => open('items', item)} remove={() => remove('items', item)} />
                </article>)}
                {!filtered.length && <p className="house-empty">{items.length ? 'No hay objetos con estos filtros.' : 'Todavía no hay objetos.'}</p>}
            </div><p className="house-muted">{filtered.length} objetos · {filtered.filter(hasItem).length} disponibles · {filtered.filter(i => !hasItem(i)).length} por tener</p>
        </> : <>
            <div className="house-stats"><Stat label="Saldo disponible para la vivienda" value={money(projection.balance)} /><Stat label="Pagado · vivienda" value={money(projection.paid)} /><Stat label="Pendiente · vivienda" value={money(projection.remaining)} /><Stat label="Pagos vencidos" value={money(projection.overdue)} /></div>
            <section className="house-card"><div className="house-section-heading"><h2>Plan de pagos</h2><button onClick={() => open('monthly')}>Configurar mensualidades</button></div><Progress value={projection.paid} total={projection.total} /><p className="house-muted">{money(projection.paid)} de {money(projection.total)}</p>
                <div className="house-payment-list">{[...payments].sort((a, b) => a.due.localeCompare(b.due)).map(p => <article className="house-payment" key={p.id}><div><h3>{p.name}</h3><span className="house-muted">{p.due.split('-').reverse().join('/')} · {p.paidOn ? `Pagado ${p.paidOn.split('-').reverse().join('/')}` : p.due < today() ? 'Vencido' : 'Pendiente'}</span></div><strong>{money(p.amount)}</strong><div className="house-actions">{!p.paidOn && <button aria-label={`Registrar pago ${p.name}`} onClick={() => open('payments', { ...p, paidOn: today() })}><Check size={18} /></button>}<Actions name={p.name} edit={() => open('payments', p)} remove={() => remove('payments', p)} /></div></article>)}</div>{!payments.length && <p className="house-empty">Sin pagos planificados</p>}
            </section>
            <section className="house-card"><h2>Previsión por fecha</h2><Field label="Fecha de consulta"><input type="date" required value={target} onChange={e => setTarget(e.target.value || today())} /></Field><div className="house-stats"><Stat label="Pendiente hasta esa fecha" value={money(projection.due)} /><Stat label="Saldo tras esos pagos · sin nuevas aportaciones" value={money(projection.projected)} /></div></section>
            <div className="house-columns"><section className="house-card"><div className="house-section-heading"><h2>Aportaciones de ahorro</h2><button aria-label="Añadir aportación" onClick={() => open('savings')}><Plus size={18} /></button></div><p className="house-muted">Saldo inicial y aportaciones. Los pagos realizados se descuentan del saldo; las compras del inventario se registran aparte.</p>{[...savings].sort((a, b) => b.date.localeCompare(a.date)).map(s => <article className="house-payment" key={s.id}><div><h3>{s.name}</h3><span className="house-muted">{s.date.split('-').reverse().join('/')}{s.date > today() ? ' · Prevista' : ''}</span></div><strong>{money(s.amount)}</strong><Actions name={s.name} edit={() => open('savings', s)} remove={() => remove('savings', s)} /></article>)}{!savings.length && <p className="house-empty">Sin aportaciones registradas</p>}</section>
            <section className="house-card"><div className="house-section-heading"><h2>Objetivos de ahorro</h2><button aria-label="Añadir objetivo" onClick={() => open('goals')}><Plus size={18} /></button></div>{[...goals].sort((a, b) => a.date.localeCompare(b.date)).map(g => {
                const forecast = houseProjection(data, g.date);
                const missing = Math.max(0, g.amount - forecast.projected);
                return <article className="house-goal" key={g.id}><div className="house-section-heading"><h3>{g.name}</h3><Actions name={g.name} edit={() => open('goals', g)} remove={() => remove('goals', g)} /></div><p>{money(g.amount)} · {g.date.split('-').reverse().join('/')}</p><Progress value={forecast.projected} total={g.amount} /><p className="house-muted">Pagos pendientes hasta la fecha: {money(forecast.due)}</p><p>Falta aportar: <strong>{money(missing)}</strong></p></article>;
            })}{!goals.length && <p className="house-empty">Sin objetivos definidos</p>}</section></div>
        </>}
        {categoryManager && <div className="house-overlay"><section role="dialog" aria-modal="true" aria-labelledby="house-categories-title" className="house-dialog">
            <div className="house-section-heading"><h2 id="house-categories-title">Categorías</h2><button aria-label="Cerrar categorías" disabled={busy} onClick={() => setCategoryManager(false)}><X size={20} /></button></div>
            <form className="house-category-create" onSubmit={e => { e.preventDefault(); saveCategory(categoryName); }}>
                <Field label="Nombre de la categoría"><input required maxLength={60} value={categoryName} disabled={busy} onChange={e => setCategoryName(e.target.value)} placeholder="Ej. Terraza" /></Field>
                <button type="submit" className="house-primary" disabled={busy || !categoryName.trim()}><Plus size={18} /> Crear</button>
            </form>
            {error && <p role="alert" className="house-error">{error}</p>}
            <ul className="house-category-list">{allCategories.map(name => <li key={name}>
                <div><strong>{name}</strong><span className="house-muted">{items.filter(i => houseName(i.category) === houseName(name)).length} objetos</span></div>
                {name === 'Otros' ? <span className="house-muted">Predeterminada</span> : <button disabled={busy} aria-label={`Eliminar categoría ${name}`} onClick={() => { setError(''); setCategoryToDelete(name); }}><Trash2 size={17} /></button>}
            </li>)}</ul>
            {categoryToDelete && <div className="house-category-confirm"><p>¿Eliminar «{categoryToDelete}»? Sus objetos pasarán a «Otros».</p><div className="house-form-actions"><button disabled={busy} onClick={() => setCategoryToDelete(null)}>Cancelar</button><button className="house-danger" disabled={busy} onClick={() => saveCategory(categoryToDelete, true)}>Eliminar categoría</button></div></div>}
        </section></div>}
        {editor && <div className="house-overlay"><section role="dialog" aria-modal="true" aria-labelledby="house-editor-title" className="house-dialog"><div className="house-section-heading"><h2 id="house-editor-title">{editor.record.id ? 'Editar' : 'Añadir'} { { items: 'objeto', payments: 'pago', savings: 'aportación', goals: 'objetivo', monthly: 'mensualidades' }[editor.section]}</h2><button aria-label="Cerrar" disabled={busy} onClick={() => setEditor(null)}><X size={20} /></button></div>
            <form onSubmit={save}><fieldset disabled={busy} className="house-form">
                {editor.section !== 'monthly' && <Field label="Nombre"><input name="name" required autoFocus maxLength={120} defaultValue={editor.record.name || ''} /></Field>}
                {editor.section === 'items' ? <>
                    <div className="house-form-row">
                        <Field label="Categoría"><select name="category" defaultValue={editor.record.category || 'Otros'} onChange={e => setEditor(prev => ({ ...prev, customCategory: e.target.value === '' }))}>{allCategories.map(c => <option key={c} value={c}>{c}</option>)}<option value="">+ Nueva categoría</option></select></Field>
                        <Field label="Estado"><select name="status" defaultValue={editor.record.status || 'pending'} onChange={e => setEditor(prev => ({ ...prev, itemStatus: e.target.value }))}>{Object.entries(HOUSE_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
                    </div>
                    {editor.customCategory && <Field label="Nueva categoría"><input name="newCategory" required maxLength={60} placeholder="Nombre de la categoría" /></Field>}
                    {(editor.itemStatus || editor.record.status) === 'gift' && <label className="house-check"><input type="checkbox" name="received" defaultChecked={editor.record.received} /> Regalo recibido</label>}
                    <Field label="Paga / regala"><input name="payer" maxLength={100} placeholder="Nosotros, familiar…" defaultValue={editor.record.payer || ''} /></Field>
                    <div className="house-form-row"><Field label="Estimado (€)"><input type="number" min="0" max="100000000" step="0.01" name="estimated" defaultValue={priceValue(editor.record.estimated)} /></Field><Field label="Real (€)"><input type="number" required={(editor.itemStatus || editor.record.status) === 'purchased'} min="0" max="100000000" step="0.01" name="actual" aria-label="Real (€)" defaultValue={priceValue(editor.record.actual)} />{(editor.itemStatus || editor.record.status) === 'purchased' && <small className="house-muted">Obligatorio para comprados</small>}</Field></div>
                    <Field label="Notas"><textarea name="notes" maxLength={1000} defaultValue={editor.record.notes || ''} /></Field>
                </> : <>
                    <Field label={editor.section === 'savings' ? 'Importe (€) · negativo para retirada' : editor.section === 'goals' ? 'Saldo que queremos conservar (€)' : 'Importe (€)'}><input name="amount" type="number" required min={editor.section === 'savings' ? '-100000000' : '0.01'} max="100000000" step="0.01" defaultValue={priceValue(editor.record.amount)} /></Field>
                    {editor.section === 'monthly' ? <><Field label="Primer mes"><input type="month" name="start" required /></Field><Field label="Último mes"><input type="month" name="end" required /></Field><Field label="Día de pago"><input type="number" name="day" required min="1" max="31" defaultValue="1" /></Field></> : <Field label={editor.section === 'payments' ? 'Vencimiento' : 'Fecha'}><input type="date" name={editor.section === 'payments' ? 'due' : 'date'} required defaultValue={editor.record.due || editor.record.date || today()} /></Field>}
                    {editor.section === 'payments' && <><Field label="Tipo"><select name="type" defaultValue={editor.record.type || 'initial'}><option value="initial">Entrada</option><option value="monthly">Mensualidad</option><option value="extra">Extraordinario</option><option value="final">Entrega / final</option></select></Field><Field label="Fecha de pago · vacío si pendiente"><input type="date" name="paidOn" max={today()} defaultValue={editor.record.paidOn || ''} /></Field></>}
                </>}
                {error && <p role="alert" className="house-error">{error}</p>}<div className="house-form-actions"><button type="button" onClick={() => setEditor(null)}>Cancelar</button><button type="submit" className="house-primary">{busy ? 'Guardando…' : 'Guardar'}</button></div>
            </fieldset></form></section></div>}
        {deletion && <div className="house-overlay"><section role="dialog" aria-modal="true" aria-labelledby="house-delete-title" className="house-dialog"><h2 id="house-delete-title">Eliminar {deletion.record.name}</h2><p>Se eliminará del hogar compartido.</p>{error && <p role="alert" className="house-error">{error}</p>}<div className="house-form-actions"><button disabled={busy} onClick={() => setDeletion(null)}>Cancelar</button><button disabled={busy} className="house-danger" onClick={() => commit(deletion.section, [deletion.record], true)}>{busy ? 'Eliminando…' : 'Eliminar'}</button></div></section></div>}
    </main>;
}
