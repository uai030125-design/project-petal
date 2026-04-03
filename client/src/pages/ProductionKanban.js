import React, { useState, useEffect } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  GripVertical,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';
import api from '../utils/api';
import '../styles/kanban.css';

const STAGES = [
  { id: 'pending', label: 'Pending', color: '#6b7280' },
  { id: 'fabric_in', label: 'Fabric In', color: '#f59e0b' },
  { id: 'cutting', label: 'Cutting', color: '#f97316' },
  { id: 'sewing', label: 'Sewing', color: '#3b82f6' },
  { id: 'finishing', label: 'Finishing', color: '#14b8a6' },
  { id: 'qc', label: 'QC', color: '#a855f7' },
  { id: 'complete', label: 'Complete', color: '#22c55e' },
  { id: 'delayed', label: 'Delayed', color: '#ef4444' },
];

const STATUS_BADGE_MAP = {
  pending: 'badge-neutral',
  fabric_in: 'badge-warning',
  cutting: 'badge-warning',
  sewing: 'badge-blue',
  finishing: 'badge-blue',
  qc: 'badge-blue',
  complete: 'badge-success',
  delayed: 'badge-danger',
};

export default function ProductionKanban() {
  const [tickets, setTickets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('board');
  const [draggedCard, setDraggedCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/production');
      setTickets(response.data || []);
    } catch (error) {
      showToast('Failed to load tickets', 'error');
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (ticketId, newStatus) => {
    try {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return;

      await api.put(`/production/${ticketId}`, {
        ...ticket,
        status: newStatus,
      });

      setTickets(
        tickets.map((t) =>
          t.id === ticketId ? { ...t, status: newStatus } : t
        )
      );
      showToast(`Ticket moved to ${getStageLabel(newStatus)}`, 'success');
    } catch (error) {
      showToast('Failed to update ticket', 'error');
      console.error('Error updating ticket:', error);
    }
  };

  const getStageLabel = (status) => {
    const stage = STAGES.find((s) => s.id === status);
    return stage ? stage.label : status;
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

  const getDueDateBadgeClass = (dueDate) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    const daysUntil = Math.floor((due - today) / (1000 * 60 * 60 * 24));

    if (isOverdue(dueDate)) return 'badge-danger';
    if (daysUntil <= 2) return 'badge-warning';
    return 'badge-blue';
  };

  const filteredTickets = tickets.filter((ticket) => {
    const query = searchQuery.toLowerCase();
    return (
      (ticket.ct_number && ticket.ct_number.toLowerCase().includes(query)) ||
      (ticket.po_number && ticket.po_number.toLowerCase().includes(query)) ||
      (ticket.customer && ticket.customer.toLowerCase().includes(query))
    );
  });

  const getTicketsByStage = (stageId) => {
    return filteredTickets.filter((ticket) => ticket.status === stageId);
  };

  const stats = {
    total: filteredTickets.length,
    inProgress: filteredTickets.filter(
      (t) => !['pending', 'complete', 'delayed'].includes(t.status)
    ).length,
    complete: filteredTickets.filter((t) => t.status === 'complete').length,
    delayed: filteredTickets.filter((t) => t.status === 'delayed').length,
  };

  const handleDragStart = (e, ticket) => {
    setDraggedCard(ticket);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    if (draggedCard && draggedCard.status !== stageId) {
      handleStatusUpdate(draggedCard.id, stageId);
    }
    setDraggedCard(null);
  };

  if (loading) {
    return (
      <div className="fade-in">
        <PageHeader title="Production Board" />
        <div className="flex items-center justify-center h-96">
          <Clock className="animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Production Board"
        action={
          <div className="flex items-center gap-2">
            <button
              className={`btn btn-sm ${viewMode === 'board' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid size={16} />
              Board
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('table')}
            >
              <List size={16} />
              Table
            </button>
          </div>
        }
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-text-dim">
            Total Tickets
          </div>
          <div className="text-3xl font-bold text-text mt-2">{stats.total}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-text-dim">
            In Progress
          </div>
          <div className="text-3xl font-bold text-accent mt-2">
            {stats.inProgress}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-text-dim">
            Complete
          </div>
          <div className="text-3xl font-bold text-success mt-2">
            {stats.complete}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-text-dim">
            Delayed
          </div>
          <div className="text-3xl font-bold text-danger mt-2">
            {stats.delayed}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Search by CT#, PO, or Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input pl-10 w-full"
          />
        </div>
      </div>

      {viewMode === 'board' ? (
        /* Kanban Board View */
        <div className="grid grid-cols-8 gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageTickets = getTicketsByStage(stage.id);
            return (
              <div
                key={stage.id}
                className="flex-shrink-0 w-72"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Column Header */}
                <div
                  className="card mb-4 p-3 border-t-4"
                  style={{ borderTopColor: stage.color }}
                >
                  <h3 className="font-semibold text-text">{stage.label}</h3>
                  <div className="badge-neutral mt-2 inline-block">
                    {stageTickets.length}
                  </div>
                </div>

                {/* Scrollable Card List */}
                <div className="space-y-3 max-h-screen-kanban overflow-y-auto">
                  {stageTickets.length === 0 ? (
                    <div className="text-center py-8 text-text-muted text-sm">
                      No tickets
                    </div>
                  ) : (
                    stageTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, ticket)}
                        className="card p-3 cursor-move hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <GripVertical
                            size={14}
                            className="text-text-muted flex-shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-text truncate">
                              {ticket.ct_number}
                            </div>
                            <div className="text-xs text-text-dim mt-1">
                              PO: {ticket.po_number}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-text-muted mb-2 truncate">
                          {ticket.customer}
                        </div>

                        {ticket.due_date && (
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar size={12} className="text-text-muted" />
                            <span className="text-xs text-text-muted">
                              {new Date(ticket.due_date).toLocaleDateString()}
                            </span>
                            {(isOverdue(ticket.due_date) ||
                              Math.floor(
                                (new Date(ticket.due_date) - new Date()) /
                                  (1000 * 60 * 60 * 24)
                              ) <= 2) && (
                              <span
                                className={`badge-sm ${getDueDateBadgeClass(ticket.due_date)}`}
                              >
                                {isOverdue(ticket.due_date) ? 'Overdue' : 'Soon'}
                              </span>
                            )}
                          </div>
                        )}

                        {ticket.comment && (
                          <div className="text-xs bg-surface3 rounded p-2 mt-2 text-text-dim">
                            {ticket.comment}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs uppercase text-text-dim font-semibold">
                  CT #
                </th>
                <th className="text-left p-4 text-xs uppercase text-text-dim font-semibold">
                  PO
                </th>
                <th className="text-left p-4 text-xs uppercase text-text-dim font-semibold">
                  Customer
                </th>
                <th className="text-left p-4 text-xs uppercase text-text-dim font-semibold">
                  Vendor
                </th>
                <th className="text-left p-4 text-xs uppercase text-text-dim font-semibold">
                  Due Date
                </th>
                <th className="text-left p-4 text-xs uppercase text-text-dim font-semibold">
                  Status
                </th>
                <th className="text-left p-4 text-xs uppercase text-text-dim font-semibold">
                  Comment
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-text-muted">
                    No tickets found
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="border-b border-border hover:bg-surface2 transition-colors"
                  >
                    <td className="p-4 font-semibold text-text">
                      {ticket.ct_number}
                    </td>
                    <td className="p-4 text-text-dim">{ticket.po_number}</td>
                    <td className="p-4 text-text-dim">{ticket.customer}</td>
                    <td className="p-4 text-text-dim">{ticket.vendor}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {ticket.due_date && (
                          <>
                            <span className="text-text-dim text-sm">
                              {new Date(
                                ticket.due_date
                              ).toLocaleDateString()}
                            </span>
                            {isOverdue(ticket.due_date) && (
                              <AlertTriangle size={14} className="text-danger" />
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <select
                        value={ticket.status}
                        onChange={(e) =>
                          handleStatusUpdate(ticket.id, e.target.value)
                        }
                        className={`text-xs px-2 py-1 rounded font-medium ${STATUS_BADGE_MAP[ticket.status]}`}
                      >
                        {STAGES.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 text-text-muted text-sm max-w-xs truncate">
                      {ticket.comment}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
