import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PTO_STORAGE_KEY = 'ua_pto_data';

/* ── Time Off Calendar ── */
function TimeOffCalendar({ member, onClose }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [ptoDays, setPtoDays] = useState({});
  const [selectedType, setSelectedType] = useState('pto');

  // Load PTO data from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PTO_STORAGE_KEY) || '{}');
      setPtoDays(stored[member.id] || {});
    } catch { /* noop */ }
  }, [member.id]);

  // Save PTO data
  const savePto = useCallback((updated) => {
    try {
      const stored = JSON.parse(localStorage.getItem(PTO_STORAGE_KEY) || '{}');
      stored[member.id] = updated;
      localStorage.setItem(PTO_STORAGE_KEY, JSON.stringify(stored));
    } catch { /* noop */ }
  }, [member.id]);

  const toggleDay = (dateKey) => {
    setPtoDays(prev => {
      const next = { ...prev };
      if (next[dateKey] === selectedType) {
        delete next[dateKey];
      } else {
        next[dateKey] = selectedType;
      }
      savePto(next);
      return next;
    });
  };

  const setDayType = (dateKey, type) => {
    setPtoDays(prev => {
      const next = { ...prev };
      if (type === 'clear') {
        delete next[dateKey];
      } else {
        next[dateKey] = type;
      }
      savePto(next);
      return next;
    });
  };

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Count PTO days for this month and year total
  const monthPto = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return Object.keys(ptoDays).filter(k => k.startsWith(prefix)).length;
  }, [ptoDays, year, month]);

  const yearPto = useMemo(() => {
    const prefix = `${year}-`;
    return Object.keys(ptoDays).filter(k => k.startsWith(prefix)).length;
  }, [ptoDays, year]);

  const typeColors = {
    pto: { bg: '#e8d4d4', color: '#991b1b', label: 'PTO' },
    sick: { bg: '#dde4e8', color: '#1e40af', label: 'Sick' },
    half: { bg: '#fef3c7', color: '#92400e', label: 'Half' },
    wfh: { bg: '#d1fae5', color: '#065f46', label: 'WFH' },
  };

  const initials = member.full_name.split(' ').map(n => n[0]).join('');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: '28px 32px',
        minWidth: 460, maxWidth: 560, boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
        {/* Member header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: `linear-gradient(135deg, ${member.avatar_color}, ${member.avatar_color}dd)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 16, color: '#fff', flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{member.full_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{member.title}{member.department ? ` · ${member.department}` : ''}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
            color: 'var(--text-muted)', lineHeight: 1,
          }}>&times;</button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-dark)' }}>{monthPto}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>This Month</div>
          </div>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-dark)' }}>{yearPto}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{year} Total</div>
          </div>
        </div>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
          {Object.entries(typeColors).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setSelectedType(key)}
              style={{
                padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, letterSpacing: 0.3, transition: 'all 0.15s',
                background: selectedType === key ? val.bg : 'var(--surface2)',
                color: selectedType === key ? val.color : 'var(--text-muted)',
                outline: selectedType === key ? `2px solid ${val.color}` : '2px solid transparent',
              }}
            >{val.label}</button>
          ))}
        </div>

        {/* Month nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 14, color: 'var(--text-dim)' }}>‹</button>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{MONTH_NAMES[month]} {year}</div>
          <button onClick={nextMonth} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 14, color: 'var(--text-dim)' }}>›</button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {DAYS_OF_WEEK.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 }}>
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayType = ptoDays[dateKey];
            const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
            const tc = dayType ? typeColors[dayType] : null;
            const isWeekend = new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6;

            return (
              <div key={day} style={{ position: 'relative' }}>
                <button
                  onClick={() => toggleDay(dateKey)}
                  onContextMenu={e => {
                    e.preventDefault();
                    const types = ['pto', 'sick', 'half', 'wfh', 'clear'];
                    const current = dayType ? types.indexOf(dayType) : -1;
                    const next = types[(current + 1) % types.length];
                    setDayType(dateKey, next);
                  }}
                  style={{
                    width: '100%', aspectRatio: '1', borderRadius: 8, border: 'none',
                    cursor: 'pointer', fontSize: 13, fontWeight: isToday ? 800 : 500,
                    background: tc ? tc.bg : isWeekend ? 'var(--surface2)' : 'transparent',
                    color: tc ? tc.color : isToday ? 'var(--accent)' : isWeekend ? 'var(--text-muted)' : 'var(--text)',
                    outline: isToday ? '2px solid var(--accent)' : 'none',
                    transition: 'all 0.15s', position: 'relative',
                  }}
                  title={tc ? `${tc.label} — Right-click to cycle type` : 'Click to mark PTO — Right-click to cycle type'}
                >
                  {day}
                </button>
                {tc && (
                  <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', fontSize: 7, fontWeight: 700, color: tc.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>{tc.label}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {Object.entries(typeColors).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: val.bg, border: `1px solid ${val.color}30` }} />
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{val.label}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>Click to toggle · Right-click to cycle type</div>
        </div>
      </div>
    </div>
  );
}

/* ── Mini Month for sidebar ── */
function MiniMonth({ year, month, allPto, typeColors }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  // Collect which days have PTO across all members
  const ptoDots = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const dots = {};
    Object.values(allPto).forEach(memberDays => {
      Object.entries(memberDays).forEach(([dateKey, type]) => {
        if (dateKey.startsWith(prefix)) {
          const day = parseInt(dateKey.split('-')[2], 10);
          if (!dots[day]) dots[day] = new Set();
          dots[day].add(type);
        }
      });
    });
    return dots;
  }, [allPto, year, month]);

  const now = new Date();
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--text)' }}>
        {MONTH_NAMES[month]} {year}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
        {DAYS_OF_WEEK.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', padding: '2px 0', textTransform: 'uppercase', letterSpacing: 0.3 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {days.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const isToday = isCurrentMonth && day === now.getDate();
          const dayTypes = ptoDots[day];
          return (
            <div key={day} style={{ textAlign: 'center', position: 'relative', padding: '3px 0' }}>
              <div style={{
                fontSize: 11, fontWeight: isToday ? 800 : 400,
                color: isToday ? 'var(--accent)' : 'var(--text)',
                lineHeight: 1.2,
              }}>{day}</div>
              {dayTypes && (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 1 }}>
                  {[...dayTypes].slice(0, 3).map(type => (
                    <div key={type} style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: typeColors[type]?.color || '#999',
                    }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════ */
export default function Team() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    api.get('/team')
      .then(res => {
        const seen = new Set();
        const unique = res.data.filter(m => {
          if (seen.has(m.full_name)) return false;
          seen.add(m.full_name);
          return true;
        });
        const sorted = unique.sort((a, b) => a.full_name.localeCompare(b.full_name));
        setMembers(sorted);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Get PTO count for each member this year
  const ptoCounts = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PTO_STORAGE_KEY) || '{}');
      const year = new Date().getFullYear();
      const counts = {};
      Object.entries(stored).forEach(([memberId, days]) => {
        counts[memberId] = Object.keys(days).filter(k => k.startsWith(`${year}-`)).length;
      });
      return counts;
    } catch { return {}; }
  }, [selectedMember]); // eslint-disable-line

  // All PTO data for the mini calendars
  const allPto = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(PTO_STORAGE_KEY) || '{}');
    } catch { return {}; }
  }, [selectedMember]); // eslint-disable-line

  // Next 3 months
  const upcomingMonths = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return months;
  }, []);

  const typeColors = {
    pto: { bg: '#e8d4d4', color: '#991b1b', label: 'PTO' },
    sick: { bg: '#dde4e8', color: '#1e40af', label: 'Sick' },
    half: { bg: '#fef3c7', color: '#92400e', label: 'Half' },
    wfh: { bg: '#d1fae5', color: '#065f46', label: 'WFH' },
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div className="fade-in">
      <PageHeader title="Team" />

      <div style={{ display: 'flex', gap: 28 }}>
        {/* Left: member cards */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 16,
          }}>
            {members.map(m => (
              <div
                key={m.id}
                onClick={() => setSelectedMember(m)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: 20,
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${m.avatar_color}, ${m.avatar_color}dd)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 10px', fontWeight: 700, fontSize: 17, color: '#fff',
                }}>
                  {m.full_name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{m.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.title}</div>
                {m.department && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.department}</div>}
                {ptoCounts[m.id] > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: 'var(--accent-dark)', background: 'var(--accent-dim)', padding: '3px 10px', borderRadius: 10, display: 'inline-block' }}>
                    {ptoCounts[m.id]} day{ptoCounts[m.id] !== 1 ? 's' : ''} off
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: 3-month calendar */}
        <div style={{
          width: 240, flexShrink: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '20px 18px',
        }}>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
            Upcoming
          </div>
          {upcomingMonths.map(m => (
            <MiniMonth
              key={`${m.year}-${m.month}`}
              year={m.year}
              month={m.month}
              allPto={allPto}
              typeColors={typeColors}
            />
          ))}
          {/* Legend */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {Object.entries(typeColors).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: val.color }} />
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{val.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Time Off Calendar Modal */}
      {selectedMember && (
        <TimeOffCalendar
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}
