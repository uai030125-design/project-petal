import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ─── Utilities ───
const VIEWS = ['hour', 'day', 'week', 'month', 'year'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

function fmtTime(h, m = 0) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return m ? `${hr}:${String(m).padStart(2, '0')} ${ampm}` : `${hr} ${ampm}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d) {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Data Store (in-memory) ───
const INITIAL_ITEMS = [];

// ─── Modal Component ───
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─── Main Calendar App ───
export default function CalendarApp() {
  const [view, setView] = useState('day');
  const [focusDate, setFocusDate] = useState(new Date());
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ title: '', type: 'event', date: '', startHour: 9, startMin: 0, endHour: 10, endMin: 0, color: COLORS[0] });
  const scrollRef = useRef(null);

  // Scroll to current hour on day/hour view mount
  useEffect(() => {
    if ((view === 'day' || view === 'hour') && scrollRef.current) {
      const now = new Date();
      const targetScroll = Math.max(0, (now.getHours() - 1) * 60);
      scrollRef.current.scrollTop = targetScroll;
    }
  }, [view, focusDate]);

  // Navigation
  const navigate = useCallback((dir) => {
    setFocusDate(prev => {
      const d = new Date(prev);
      if (view === 'hour') d.setHours(d.getHours() + dir);
      else if (view === 'day') d.setDate(d.getDate() + dir);
      else if (view === 'week') d.setDate(d.getDate() + dir * 7);
      else if (view === 'month') d.setMonth(d.getMonth() + dir);
      else if (view === 'year') d.setFullYear(d.getFullYear() + dir);
      return d;
    });
  }, [view]);

  const goToday = () => setFocusDate(new Date());

  // Items for a given date
  const itemsForDate = useCallback((date) => {
    return items.filter(it => sameDay(new Date(it.date), date));
  }, [items]);

  // Open add modal
  const openAdd = (date, hour) => {
    setEditingItem(null);
    setForm({
      title: '',
      type: 'event',
      date: dateKey(date || focusDate),
      startHour: hour ?? 9,
      startMin: 0,
      endHour: (hour ?? 9) + 1,
      endMin: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    setModalOpen(true);
  };

  // Open edit modal
  const openEdit = (item) => {
    setEditingItem(item);
    setForm({ ...item });
    setModalOpen(true);
  };

  // Save item
  const saveItem = () => {
    if (!form.title.trim()) return;
    if (editingItem) {
      setItems(prev => prev.map(it => it.id === editingItem.id ? { ...form, id: it.id } : it));
    } else {
      setItems(prev => [...prev, { ...form, id: generateId() }]);
    }
    setModalOpen(false);
  };

  // Delete item
  const deleteItem = (id) => {
    setItems(prev => prev.filter(it => it.id !== id));
    setModalOpen(false);
  };

  // Header title
  const headerTitle = useMemo(() => {
    const d = focusDate;
    if (view === 'hour') return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} — ${fmtTime(d.getHours())}`;
    if (view === 'day') return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
    if (view === 'week') {
      const ws = startOfWeek(d);
      const we = addDays(ws, 6);
      return `${SHORT_MONTHS[ws.getMonth()]} ${ws.getDate()} — ${SHORT_MONTHS[we.getMonth()]} ${we.getDate()}`;
    }
    if (view === 'month') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    return `${d.getFullYear()}`;
  }, [focusDate, view]);

  // Zoom handlers
  const zoomIn = () => {
    const idx = VIEWS.indexOf(view);
    if (idx > 0) setView(VIEWS[idx - 1]);
  };
  const zoomOut = () => {
    const idx = VIEWS.indexOf(view);
    if (idx < VIEWS.length - 1) setView(VIEWS[idx + 1]);
  };

  // ─── Render Views ───

  // Hour View — single hour expanded with 5-min slots
  const renderHourView = () => {
    const hour = focusDate.getHours();
    const dayItems = itemsForDate(focusDate).filter(it => it.startHour === hour);
    const slots = Array.from({ length: 12 }, (_, i) => i * 5);

    return (
      <div style={{ padding: 16 }}>
        <div style={S.hourLabel}>{fmtTime(hour)}</div>
        {slots.map(min => {
          const slotItems = dayItems.filter(it => (it.startMin || 0) <= min && min < (it.endMin || 60));
          return (
            <div key={min} style={S.slot} onClick={() => openAdd(focusDate, hour)}>
              <span style={S.slotTime}>{fmtTime(hour, min)}</span>
              <div style={{ flex: 1 }}>
                {slotItems.map(it => (
                  <div key={it.id} style={{ ...S.chip, background: it.color + '18', borderLeft: `3px solid ${it.color}` }} onClick={e => { e.stopPropagation(); openEdit(it); }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: it.color }}>{it.type === 'task' ? '☐ ' : ''}{it.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Day View — 24 hours
  const renderDayView = () => {
    const dayItems = itemsForDate(focusDate);
    const now = new Date();
    const isToday = sameDay(focusDate, now);

    return (
      <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1 }}>
        {HOURS.map(h => {
          const hourItems = dayItems.filter(it => it.startHour <= h && h < it.endHour);
          const isNow = isToday && now.getHours() === h;
          return (
            <div key={h} style={{ ...S.hourRow, background: isNow ? '#6366f108' : 'transparent' }} onClick={() => openAdd(focusDate, h)}>
              <div style={S.hourTime}>{fmtTime(h)}</div>
              <div style={S.hourContent}>
                {isNow && <div style={S.nowLine} />}
                {hourItems.map(it => (
                  <div key={it.id} style={{ ...S.eventBlock, background: it.color + '15', borderLeft: `3px solid ${it.color}` }} onClick={e => { e.stopPropagation(); openEdit(it); }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e' }}>{it.type === 'task' ? '☐ ' : ''}{it.title}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{fmtTime(it.startHour)} — {fmtTime(it.endHour)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Week View — 7 day columns
  const renderWeekView = () => {
    const ws = startOfWeek(focusDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const now = new Date();

    return (
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {weekDays.map(day => {
          const isToday = sameDay(day, now);
          const dayItemsList = itemsForDate(day);
          return (
            <div key={dateKey(day)} style={S.weekCol} onClick={() => { setFocusDate(day); setView('day'); }}>
              <div style={{ ...S.weekDayHeader, color: isToday ? '#6366f1' : '#6b7280' }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{DAYS[day.getDay()]}</div>
                <div style={{ ...S.weekDayNum, ...(isToday ? S.todayCircle : {}) }}>{day.getDate()}</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 2px' }}>
                {dayItemsList.slice(0, 6).map(it => (
                  <div key={it.id} style={{ ...S.weekEvent, background: it.color + '15', borderLeft: `2px solid ${it.color}` }} onClick={e => { e.stopPropagation(); openEdit(it); }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.type === 'task' ? '☐ ' : ''}{it.title}
                    </div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>{fmtTime(it.startHour)}</div>
                  </div>
                ))}
                {dayItemsList.length > 6 && <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', padding: 2 }}>+{dayItemsList.length - 6} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Month View — grid
  const renderMonthView = () => {
    const year = focusDate.getFullYear();
    const month = focusDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = new Date(year, month, 1).getDay();
    const cells = [];
    const now = new Date();

    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

    return (
      <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={S.monthDayRow}>
          {DAYS.map(d => <div key={d} style={S.monthDayLabel}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, flex: 1 }}>
          {cells.map((cell, i) => {
            if (!cell) return <div key={`e-${i}`} />;
            const isToday = sameDay(cell, now);
            const dayItemsList = itemsForDate(cell);
            return (
              <div key={i} style={S.monthCell} onClick={() => { setFocusDate(cell); setView('day'); }}>
                <div style={{ ...S.monthDate, ...(isToday ? S.todayCircle : {}) }}>{cell.getDate()}</div>
                {dayItemsList.slice(0, 3).map(it => (
                  <div key={it.id} style={{ ...S.monthDot, background: it.color }}>
                    <span style={{ fontSize: 9, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                  </div>
                ))}
                {dayItemsList.length > 3 && <div style={{ fontSize: 9, color: '#9ca3af' }}>+{dayItemsList.length - 3}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Year View — 12 month mini calendars
  const renderYearView = () => {
    const year = focusDate.getFullYear();
    const now = new Date();

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 12, overflowY: 'auto', flex: 1 }}>
        {Array.from({ length: 12 }, (_, m) => {
          const daysInM = getDaysInMonth(year, m);
          const firstDay = new Date(year, m, 1).getDay();
          const isCurrentMonth = now.getFullYear() === year && now.getMonth() === m;
          return (
            <div key={m} style={{ ...S.yearMonth, ...(isCurrentMonth ? { border: '1px solid #6366f1' } : {}) }} onClick={() => { setFocusDate(new Date(year, m, 1)); setView('month'); }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: isCurrentMonth ? '#6366f1' : '#374151' }}>{SHORT_MONTHS[m]}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>
                {DAYS.map(d => <div key={d}>{d[0]}</div>)}
                {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInM }, (_, d) => {
                  const thisDay = new Date(year, m, d + 1);
                  const isToday = sameDay(thisDay, now);
                  const hasItems = items.some(it => sameDay(new Date(it.date), thisDay));
                  return (
                    <div key={d} style={{ padding: '1px 0', color: isToday ? '#fff' : hasItems ? '#6366f1' : '#6b7280', background: isToday ? '#6366f1' : 'transparent', borderRadius: '50%', fontWeight: isToday || hasItems ? 600 : 400, lineHeight: '18px' }}>
                      {d + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerTop}>
          <h1 style={S.title}>{headerTitle}</h1>
          <button style={S.todayBtn} onClick={goToday}>Today</button>
        </div>
        <div style={S.headerNav}>
          <button style={S.navBtn} onClick={() => navigate(-1)}>‹</button>
          <button style={S.navBtn} onClick={() => navigate(1)}>›</button>
          <div style={{ flex: 1 }} />
          <button style={S.zoomBtn} onClick={zoomIn} disabled={view === 'hour'}>+</button>
          <div style={S.viewLabel}>{view}</div>
          <button style={S.zoomBtn} onClick={zoomOut} disabled={view === 'year'}>−</button>
        </div>
        {/* View pills */}
        <div style={S.viewPills}>
          {VIEWS.map(v => (
            <button key={v} style={{ ...S.pill, ...(view === v ? S.pillActive : {}) }} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={S.body}>
        {view === 'hour' && renderHourView()}
        {view === 'day' && renderDayView()}
        {view === 'week' && renderWeekView()}
        {view === 'month' && renderMonthView()}
        {view === 'year' && renderYearView()}
      </div>

      {/* FAB */}
      <button style={S.fab} onClick={() => openAdd(focusDate)}>+</button>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{editingItem ? 'Edit' : 'New'} Item</h3>

        <div style={S.formGroup}>
          <label style={S.label}>Title</label>
          <input style={S.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What's on the schedule?" autoFocus />
        </div>

        <div style={S.formRow}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['event', 'task'].map(t => (
                <button key={t} style={{ ...S.typeBtn, ...(form.type === t ? S.typeBtnActive : {}) }} onClick={() => setForm(f => ({ ...f, type: t }))}>
                  {t === 'event' ? '📅 Event' : '☑️ Task'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Date</label>
            <input type="date" style={S.input} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
        </div>

        <div style={S.formRow}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Start</label>
            <select style={S.input} value={form.startHour} onChange={e => setForm(f => ({ ...f, startHour: +e.target.value }))}>
              {HOURS.map(h => <option key={h} value={h}>{fmtTime(h)}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>End</label>
            <select style={S.input} value={form.endHour} onChange={e => setForm(f => ({ ...f, endHour: +e.target.value }))}>
              {HOURS.map(h => <option key={h} value={h}>{fmtTime(h)}</option>)}
            </select>
          </div>
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Color</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {COLORS.map(c => (
              <button key={c} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid #1a1a2e' : '3px solid transparent', cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, color: c }))} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          {editingItem && <button style={S.deleteBtn} onClick={() => deleteItem(editingItem.id)}>Delete</button>}
          <div style={{ flex: 1 }} />
          <button style={S.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
          <button style={S.saveBtn} onClick={saveItem}>Save</button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Styles ───
const S = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', background: '#fafafa', fontFamily: "'Inter', -apple-system, system-ui, sans-serif", color: '#1a1a2e', overflow: 'hidden' },
  header: { padding: '16px 16px 8px', background: '#fff', borderBottom: '1px solid #e5e7eb' },
  headerTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: 700, margin: 0 },
  todayBtn: { fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6366f1' },
  headerNav: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  navBtn: { width: 32, height: 32, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' },
  zoomBtn: { width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' },
  viewLabel: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#9ca3af', minWidth: 40, textAlign: 'center' },
  viewPills: { display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 3 },
  pill: { flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 8, background: 'transparent', color: '#6b7280', cursor: 'pointer' },
  pillActive: { background: '#fff', color: '#6366f1', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },

  // Hour view
  hourLabel: { fontSize: 24, fontWeight: 300, color: '#6b7280', marginBottom: 12 },
  slot: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderTop: '1px solid #f3f4f6', cursor: 'pointer', minHeight: 36 },
  slotTime: { fontSize: 11, color: '#9ca3af', width: 60, flexShrink: 0, paddingTop: 2 },
  chip: { padding: '4px 8px', borderRadius: 6, marginBottom: 2 },

  // Day view
  hourRow: { display: 'flex', minHeight: 60, borderBottom: '1px solid #f3f4f6', cursor: 'pointer' },
  hourTime: { width: 56, fontSize: 11, color: '#9ca3af', paddingTop: 4, paddingLeft: 12, flexShrink: 0 },
  hourContent: { flex: 1, position: 'relative', padding: '4px 8px 4px 0' },
  nowLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: '#ef4444', borderRadius: 1, zIndex: 1 },
  eventBlock: { padding: '6px 10px', borderRadius: 6, marginBottom: 3, cursor: 'pointer' },

  // Week view
  weekCol: { flex: 1, borderRight: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', cursor: 'pointer', minWidth: 0 },
  weekDayHeader: { textAlign: 'center', padding: '10px 0 6px' },
  weekDayNum: { fontSize: 18, fontWeight: 600, lineHeight: '28px', color: '#1a1a2e' },
  weekEvent: { padding: '3px 4px', borderRadius: 4, marginBottom: 2 },

  // Month view
  monthDayRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 },
  monthDayLabel: { fontSize: 10, fontWeight: 600, color: '#9ca3af', textAlign: 'center', textTransform: 'uppercase' },
  monthCell: { padding: 4, minHeight: 50, cursor: 'pointer', borderRadius: 6, transition: 'background 0.15s' },
  monthDate: { fontSize: 12, fontWeight: 500, textAlign: 'center', marginBottom: 2, lineHeight: '22px', width: 22, height: 22, margin: '0 auto 2px', borderRadius: '50%' },
  monthDot: { borderRadius: 3, padding: '1px 3px', marginBottom: 1, overflow: 'hidden' },

  // Year view
  yearMonth: { padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#fff' },

  // Common
  todayCircle: { background: '#6366f1', color: '#fff', borderRadius: '50%' },

  // FAB
  fab: { position: 'fixed', bottom: 24, right: 24, width: 52, height: 52, borderRadius: '50%', background: '#6366f1', color: '#fff', fontSize: 28, fontWeight: 300, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },

  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal: { background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto' },
  formGroup: { marginBottom: 14 },
  formRow: { display: 'flex', gap: 12, marginBottom: 14 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input: { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', background: '#fafafa' },
  typeBtn: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fafafa', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  typeBtnActive: { border: '1px solid #6366f1', background: '#eef2ff', color: '#6366f1' },
  saveBtn: { padding: '10px 24px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { padding: '10px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#6b7280' },
  deleteBtn: { padding: '10px 16px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 14, cursor: 'pointer', color: '#dc2626', fontWeight: 500 },
};
