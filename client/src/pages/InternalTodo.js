import React, { useState, useCallback, useEffect, useRef } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';

const STATUS_OPTIONS = ['Not Started', 'In Process', 'Completed'];
const PAGE_OPTIONS = ['', 'Home', 'Shipping', 'Production', 'Containers', 'Burlington', 'ATS', 'Contact Log', 'Line Sheets', 'Showroom', 'Vendors', 'Model', 'Time Off', 'Team', 'Margin', 'Compliance', 'Chargebacks'];
const LS_KEY = 'ua_internal_todos';

const statusColor = (s) => {
  if (s === 'Completed') return { bg: 'rgba(45,74,52,0.10)', text: 'var(--accent-dark)', border: 'rgba(45,74,52,0.25)' };
  if (s === 'In Process') return { bg: 'rgba(59,130,246,0.10)', text: '#2563EB', border: 'rgba(59,130,246,0.25)' };
  return { bg: 'var(--surface2)', text: 'var(--text-muted)', border: 'var(--border)' };
};

let nextLocalId = Date.now();

const doneByColor = (dateStr) => {
  if (!dateStr) return {};
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = (d - now) / 86400000;
  if (diff < 0) return { color: '#dc2626', fontWeight: 600 }; // overdue
  if (diff <= 3) return { color: '#ea580c', fontWeight: 600 }; // due soon
  if (diff <= 7) return { color: '#ca8a04' }; // this week
  return { color: 'var(--text-dim)' };
};

/* ── Reusable row component ── */
function TodoRow({ todo, i, total, editingComment, setEditingComment, updateTodo, removeTodo, onEnterAdd }) {
  const sc = statusColor(todo.status);
  const dbc = doneByColor(todo.done_by);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '42px 1fr 110px 120px 110px 1fr 36px',
      gap: 0,
      padding: '12px 16px',
      alignItems: 'center',
      borderBottom: i < total - 1 ? '1px solid var(--border)' : 'none',
      transition: 'background 0.12s',
      background: todo.status === 'In Process' ? 'rgba(59,130,246,0.05)' : 'transparent',
    }}>
      <div>
        <input
          type="checkbox"
          checked={todo.done}
          onChange={e => updateTodo(todo.id, 'done', e.target.checked)}
          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
        />
      </div>
      <div style={{ paddingRight: 16 }}>
        <input
          type="text"
          value={todo.title}
          onChange={e => updateTodo(todo.id, 'title', e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && onEnterAdd) { e.preventDefault(); onEnterAdd(); } }}
          data-todo-title={todo.id}
          placeholder="Task title..."
          style={{
            width: '100%', border: 'none', background: 'transparent',
            fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
            fontWeight: todo.done ? 400 : 500,
            textDecoration: todo.done ? 'line-through' : 'none',
            opacity: todo.done ? 0.5 : 1,
            outline: 'none', padding: '4px 0',
          }}
        />
      </div>
      <div>
        <select
          value={todo.page || ''}
          onChange={e => updateTodo(todo.id, 'page', e.target.value)}
          style={{
            appearance: 'none', WebkitAppearance: 'none',
            background: todo.page ? 'rgba(45,74,52,0.06)' : 'transparent',
            color: todo.page ? 'var(--text-dim)' : 'var(--text-muted)',
            border: `1px solid ${todo.page ? 'rgba(45,74,52,0.15)' : 'var(--border)'}`,
            borderRadius: 6, padding: '5px 28px 5px 10px', fontSize: 12,
            fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
            outline: 'none', width: '100%',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          {PAGE_OPTIONS.map(p => <option key={p} value={p}>{p || '—'}</option>)}
        </select>
      </div>
      <div>
        <select
          value={todo.status}
          onChange={e => updateTodo(todo.id, 'status', e.target.value)}
          style={{
            appearance: 'none', WebkitAppearance: 'none',
            background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
            borderRadius: 6, padding: '5px 28px 5px 10px', fontSize: 12,
            fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            outline: 'none', width: '100%',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <input
          type="date"
          value={todo.done_by || ''}
          onChange={e => updateTodo(todo.id, 'done_by', e.target.value || null)}
          style={{
            width: '100%', border: `1px solid var(--border)`, background: 'transparent',
            borderRadius: 6, padding: '5px 6px', fontSize: 11, fontFamily: 'inherit',
            color: todo.done_by ? (dbc.color || 'var(--text-dim)') : 'var(--text-muted)',
            fontWeight: dbc.fontWeight || 400,
            outline: 'none', cursor: 'pointer',
          }}
        />
      </div>
      <div style={{ paddingLeft: 16 }}>
        {editingComment === todo.id ? (
          <input
            type="text"
            autoFocus
            value={todo.comment}
            onChange={e => updateTodo(todo.id, 'comment', e.target.value)}
            onBlur={() => setEditingComment(null)}
            onKeyDown={e => e.key === 'Enter' && setEditingComment(null)}
            style={{
              width: '100%', border: '1px solid var(--border)', background: 'var(--surface)',
              borderRadius: 6, padding: '5px 8px', fontSize: 13, fontFamily: 'inherit',
              color: 'var(--text)', outline: 'none',
            }}
          />
        ) : (
          <div
            onClick={() => setEditingComment(todo.id)}
            style={{
              fontSize: 13, color: todo.comment ? 'var(--text-dim)' : 'var(--text-muted)',
              cursor: 'text', padding: '5px 0', minHeight: 28,
              fontStyle: todo.comment ? 'normal' : 'italic',
            }}
          >
            {todo.comment || 'Add comment...'}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => removeTodo(todo.id)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 4,
            transition: 'color 0.15s', fontFamily: 'inherit',
          }}
          title="Remove"
        >
          ×
        </button>
      </div>
    </div>
  );
}

const MARGIN_SEED_KEY = 'ua_margin_tasks_seeded';
const MARGIN_SEED_TASKS = [
  { id: 900001, title: 'Calculate landed margin per style (caftans) — include freight, duty, chargebacks', done: false, status: 'Not Started', page: 'Margin', comment: 'Need cost sheets from Gary', done_by: null },
  { id: 900002, title: 'Calculate landed margin per style (scrubs)', done: false, status: 'Not Started', page: 'Margin', comment: '', done_by: null },
  { id: 900003, title: 'Build margin-per-buyer breakdown: Burlington, Ross Missy, Ross Petite, Ross Plus, Bealls', done: false, status: 'Not Started', page: 'Margin', comment: 'Compare FOB vs landed by account', done_by: null },
  { id: 900004, title: 'Identify bottom 5 styles by gross margin — flag for review', done: false, status: 'Not Started', page: 'Margin', comment: '', done_by: null },
  { id: 900005, title: 'Compare Q1 2026 margin vs Q4 2025 by buyer', done: false, status: 'Not Started', page: 'Margin', comment: 'Pull from Model page data', done_by: null },
  { id: 900006, title: 'Set up margin threshold alerts (flag styles below 35% GM)', done: false, status: 'Not Started', page: 'Margin', comment: '', done_by: null },
];

/* Helpers for localStorage persistence */
const loadLocal = () => {
  try {
    let todos = JSON.parse(localStorage.getItem(LS_KEY)) || [];
    // Seed margin tasks once
    if (!localStorage.getItem(MARGIN_SEED_KEY)) {
      todos = [...MARGIN_SEED_TASKS, ...todos];
      localStorage.setItem(LS_KEY, JSON.stringify(todos));
      localStorage.setItem(MARGIN_SEED_KEY, '1');
    }
    return todos;
  }
  catch { return []; }
};
const saveLocal = (todos) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(todos)); }
  catch { /* ignore */ }
};

export default function InternalTodo() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingComment, setEditingComment] = useState(null);
  const [filterPage, setFilterPage] = useState('All');
  const useApi = useRef(false);
  const saveTimers = useRef({});

  /* Load: try API first, fall back to localStorage */
  useEffect(() => {
    api.get('/todos').then(res => {
      useApi.current = true;
      setTodos(res.data);
    }).catch(() => {
      useApi.current = false;
      setTodos(loadLocal());
    }).finally(() => setLoading(false));
  }, []);

  /* Persist helper — saves to API or localStorage */
  const persist = useCallback((updatedTodos) => {
    if (!useApi.current) {
      saveLocal(updatedTodos);
    }
  }, []);

  /* Debounced save to server */
  const saveToServer = useCallback((id, fields) => {
    if (!useApi.current) return;
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => {
      api.put(`/todos/${id}`, fields).catch(err => console.error('Save failed:', err));
    }, 400);
  }, []);

  const addTodo = useCallback(async () => {
    let newId;
    if (useApi.current) {
      try {
        const res = await api.post('/todos', { title: '', done: false, status: 'Not Started', page: '', comment: '', done_by: null });
        newId = res.data.id;
        setTodos(prev => { const next = [...prev, res.data]; return next; });
      } catch (err) {
        console.error('Failed to add todo:', err);
        return;
      }
    } else {
      newId = nextLocalId++;
      const newTodo = { id: newId, title: '', done: false, status: 'Not Started', page: '', comment: '', done_by: null };
      setTodos(prev => { const next = [...prev, newTodo]; saveLocal(next); return next; });
    }
    // Focus the new row's title input after render
    setTimeout(() => {
      const el = document.querySelector(`[data-todo-title="${newId}"]`);
      if (el) el.focus();
    }, 50);
  }, []);

  const updateTodo = useCallback((id, field, value) => {
    setTodos(prev => {
      const next = prev.map(t => {
        if (t.id !== id) return t;
        const updated = { ...t, [field]: value };
        if (field === 'done' && value) updated.status = 'Completed';
        if (field === 'done' && !value && t.status === 'Completed') updated.status = 'Not Started';
        if (field === 'status' && value === 'Completed') updated.done = true;
        if (field === 'status' && value !== 'Completed') updated.done = false;
        return updated;
      });
      persist(next);
      return next;
    });

    /* Also save to server if available */
    const fields = { [field]: value };
    if (field === 'done' && value) fields.status = 'Completed';
    if (field === 'done' && !value) fields.status = 'Not Started';
    if (field === 'status' && value === 'Completed') fields.done = true;
    if (field === 'status' && value !== 'Completed') fields.done = false;
    saveToServer(id, fields);
  }, [persist, saveToServer]);

  const removeTodo = useCallback((id) => {
    setTodos(prev => {
      const next = prev.filter(t => t.id !== id);
      persist(next);
      return next;
    });
    if (useApi.current) {
      api.delete(`/todos/${id}`).catch(err => console.error('Failed to delete todo:', err));
    }
  }, [persist]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading tasks...</div>;
  }

  return (
    <div className="fade-in">
      <PageHeader title="To Do" />
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div />
        <button onClick={addTodo} style={{
          background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', letterSpacing: 0.3, transition: 'opacity 0.15s',
        }}>
          + Add Task
        </button>
      </div>

      {/* Page filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {['All', ...PAGE_OPTIONS.filter(Boolean)].map(p => (
          <button
            key={p}
            onClick={() => setFilterPage(p)}
            style={{
              padding: '5px 14px', fontSize: 12, fontWeight: filterPage === p ? 600 : 400,
              borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
              border: filterPage === p ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: filterPage === p ? 'var(--accent)' : 'transparent',
              color: filterPage === p ? '#fff' : 'var(--text-dim)',
              transition: 'all 0.15s',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '42px 1fr 110px 120px 110px 1fr 36px',
        gap: 0,
        padding: '10px 16px',
        background: 'var(--surface2)',
        borderRadius: '10px 10px 0 0',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={colHead}></div>
        <div style={colHead}>Title</div>
        <div style={colHead}>Page</div>
        <div style={colHead}>Status</div>
        <div style={colHead}>Done By</div>
        <div style={colHead}>Comments</div>
        <div style={colHead}></div>
      </div>

      {/* Active Rows */}
      <div style={{ background: 'var(--surface)', borderRadius: '0 0 10px 10px', border: '1px solid var(--border)', borderTop: 'none' }}>
        {(() => {
          const filtered = filterPage === 'All' ? todos : todos.filter(t => (t.page || '') === filterPage);
          const active = filtered.filter(t => t.status !== 'Completed');
          const sorted = [...active].sort((a, b) => {
            const pa = (a.page || '').toLowerCase();
            const pb = (b.page || '').toLowerCase();
            if (pa < pb) return -1;
            if (pa > pb) return 1;
            return 0;
          });
          if (sorted.length === 0) return (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {todos.filter(t => t.status !== 'Completed').length === 0 ? 'No active tasks. Click "+ Add Task" to get started.' : `No active tasks for "${filterPage}".`}
            </div>
          );
          return sorted.map((todo, i) => <TodoRow key={todo.id} todo={todo} i={i} total={sorted.length} editingComment={editingComment} setEditingComment={setEditingComment} updateTodo={updateTodo} removeTodo={removeTodo} onEnterAdd={addTodo} />);
        })()}
      </div>

      {/* Completed Section */}
      {(() => {
        const filtered = filterPage === 'All' ? todos : todos.filter(t => (t.page || '') === filterPage);
        const completed = filtered.filter(t => t.status === 'Completed');
        if (completed.length === 0) return null;
        return (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '42px 1fr 110px 120px 110px 1fr 36px',
              gap: 0,
              padding: '10px 16px',
              background: 'var(--surface2)',
              borderRadius: '10px 10px 0 0',
              borderBottom: '1px solid var(--border)',
              marginTop: 28,
            }}>
              <div style={colHead}></div>
              <div style={colHead}>Completed ({completed.length})</div>
              <div style={colHead}>Page</div>
              <div style={colHead}>Status</div>
              <div style={colHead}>Comments</div>
              <div style={colHead}></div>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: '0 0 10px 10px', border: '1px solid var(--border)', borderTop: 'none' }}>
              {completed.map((todo, i) => <TodoRow key={todo.id} todo={todo} i={i} total={completed.length} editingComment={editingComment} setEditingComment={setEditingComment} updateTodo={updateTodo} removeTodo={removeTodo} onEnterAdd={addTodo} />)}
            </div>
          </>
        );
      })()}

      {/* Summary */}
      <div style={{ marginTop: 16, display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>{todos.length} total</span>
        <span>{todos.filter(t => t.status === 'Completed').length} completed</span>
        <span>{todos.filter(t => t.status === 'In Process').length} in process</span>
        <span>{todos.filter(t => t.status === 'Not Started').length} not started</span>
      </div>
    </div>
  );
}

const colHead = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: 0.8,
};
