import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  Clock,
  Package,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Edit3,
  DollarSign,
} from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';
import api from '../utils/api';
import '../styles/pages/vendor-hub.css';

const DEFAULT_VENDORS = [
  {
    id: 'vendor-3',
    name: 'WinFashion',
    category: 'Services',
    status: 'Active',
    contact: { name: '', email: '', phone: '' },
    leadTime: 'N/A',
    openInvoices: 0,
    lastOrderDate: '',
    communications: [],
    notes: [],
  },
  {
    id: 'vendor-4',
    name: 'StreetAccount',
    category: 'Services',
    status: 'Active',
    contact: { name: '', email: '', phone: '' },
    leadTime: 'N/A',
    openInvoices: 0,
    lastOrderDate: '',
    communications: [],
    notes: [],
  },
];

const CATEGORIES = ['All', 'Manufacturers', 'Suppliers', 'Fabric', 'Trim', 'Services'];

export default function VendorHub() {
  const { showToast } = useToast();
  const [vendors, setVendors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedVendor, setExpandedVendor] = useState(null);
  const [expandedComm, setExpandedComm] = useState(null);
  const [noteInput, setNoteInput] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVendor, setNewVendor] = useState({
    name: '',
    category: 'Manufacturer',
    contact: { name: '', email: '', phone: '' },
    leadTime: '',
    status: 'Active',
  });

  useEffect(() => {
    const stored = localStorage.getItem('ua_vendor_hub');
    setVendors(stored ? JSON.parse(stored) : DEFAULT_VENDORS);
  }, []);

  useEffect(() => {
    localStorage.setItem('ua_vendor_hub', JSON.stringify(vendors));
  }, [vendors]);

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch =
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.contact.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'All' || vendor.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const totalVendors = vendors.length;
  const openInvoicesCount = vendors.reduce((sum, v) => sum + v.openInvoices, 0);
  const vendorsWithLead = vendors.filter((v) => v.leadTime && v.leadTime !== 'N/A' && !isNaN(parseInt(v.leadTime)));
  const avgLeadTime = vendorsWithLead.length > 0
    ? Math.round(vendorsWithLead.reduce((sum, v) => sum + parseInt(v.leadTime.split(' ')[0]), 0) / vendorsWithLead.length)
    : 0;

  const handleAddNote = (vendorId, text) => {
    if (!text.trim()) return;
    setVendors((prevVendors) =>
      prevVendors.map((v) =>
        v.id === vendorId
          ? {
              ...v,
              notes: [...(v.notes || []), { id: Date.now(), text, date: new Date().toISOString() }],
            }
          : v
      )
    );
    setNoteInput((prev) => ({ ...prev, [vendorId]: '' }));
    showToast('Note added successfully', 'success');
  };

  const handleAddVendor = () => {
    if (!newVendor.name || !newVendor.contact.email) {
      showToast('Please fill in vendor name and email', 'warning');
      return;
    }
    const vendor = {
      ...newVendor,
      id: `vendor-${Date.now()}`,
      openInvoices: 0,
      lastOrderDate: new Date().toISOString().split('T')[0],
      communications: [],
      notes: [],
    };
    setVendors([...vendors, vendor]);
    setNewVendor({
      name: '',
      category: 'Manufacturer',
      contact: { name: '', email: '', phone: '' },
      leadTime: '',
      status: 'Active',
    });
    setShowAddModal(false);
    showToast('Vendor added successfully', 'success');
  };

  const getCategoryBadgeColor = (category) => {
    const colors = {
      Manufacturer: 'badge-blue',
      Fabric: 'badge-purple',
      Trim: 'badge-amber',
      Services: 'badge-green',
      Supplier: 'badge-indigo',
    };
    return colors[category] || 'badge-gray';
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Vendor Hub"
        icon={<Building2 size={32} />}
        action={
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            Add Vendor
          </button>
        }
      />

      {/* Search and Filters */}
      <div className="vendor-controls">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search vendors by name, contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`filter-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="vendors-grid">
        {filteredVendors.map((vendor) => (
          <div key={vendor.id} className="card vendor-card">
            {/* Header */}
            <div className="vendor-card-header">
              <div className="vendor-title">
                <h3>{vendor.name}</h3>
                <span className={`badge ${getCategoryBadgeColor(vendor.category)}`}>
                  {vendor.category}
                </span>
              </div>
              <span className={`status-badge ${vendor.status === 'Active' ? 'status-active' : 'status-inactive'}`}>
                {vendor.status}
              </span>
            </div>

          </div>
        ))}
      </div>

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add New Vendor</h2>
            <div className="form-group">
              <label>Vendor Name *</label>
              <input
                type="text"
                className="input"
                value={newVendor.name}
                onChange={(e) =>
                  setNewVendor({ ...newVendor, name: e.target.value })
                }
                placeholder="e.g., Vendor Name"
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                className="input"
                value={newVendor.category}
                onChange={(e) =>
                  setNewVendor({ ...newVendor, category: e.target.value })
                }
              >
                {['Manufacturer', 'Fabric', 'Trim', 'Services', 'Supplier'].map(
                  (cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="form-group">
              <label>Contact Name</label>
              <input
                type="text"
                className="input"
                value={newVendor.contact.name}
                onChange={(e) =>
                  setNewVendor({
                    ...newVendor,
                    contact: { ...newVendor.contact, name: e.target.value },
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                className="input"
                value={newVendor.contact.email}
                onChange={(e) =>
                  setNewVendor({
                    ...newVendor,
                    contact: { ...newVendor.contact, email: e.target.value },
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                className="input"
                value={newVendor.contact.phone}
                onChange={(e) =>
                  setNewVendor({
                    ...newVendor,
                    contact: { ...newVendor.contact, phone: e.target.value },
                  })
                }
              />
            </div>
            <div className="form-group">
              <label>Lead Time</label>
              <input
                type="text"
                className="input"
                value={newVendor.leadTime}
                onChange={(e) =>
                  setNewVendor({ ...newVendor, leadTime: e.target.value })
                }
                placeholder="e.g., 30 days"
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAddVendor}>
                Add Vendor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
