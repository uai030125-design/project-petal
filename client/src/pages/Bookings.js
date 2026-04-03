import React, { useState, useMemo, useCallback } from 'react';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';
import './Bookings.css';

const MONTHS = [
  'April 2026',
  'May 2026',
  'June 2026',
  'July 2026',
  'August 2026',
  'September 2026',
  'October 2026',
  'November 2026',
  'December 2026'
];

const CATEGORIES = [
  'Missy Dresses',
  'Missy Tops',
  'Junior Dresses',
  'Junior Tops',
  'Scrubs',
  'Caftans'
];

const MONTH_MAP = {
  1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8,
  '01': 0, '02': 1, '03': 2, '04': 3, '05': 4, '06': 5, '07': 6, '08': 7, '09': 8,
  'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5, 'july': 6, 'august': 7, 'september': 8,
  'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8
};

const formatCurrency = (value) => {
  if (!value) return '$0';
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getMonthIndex = (dateStr) => {
  if (!dateStr) return -1;

  const dateObj = new Date(dateStr);
  if (!isNaN(dateObj.getTime())) {
    const month = dateObj.getMonth();
    if (month >= 3 && month <= 11) {
      return month - 3;
    }
    return -1;
  }

  const normalized = String(dateStr).toLowerCase().trim();
  for (const [key, value] of Object.entries(MONTH_MAP)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  return -1;
};

const parseUploadedFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target.result;

        if (file.name.endsWith('.csv')) {
          const rows = data.split('\n').map(row => {
            const cells = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < row.length; i++) {
              const char = row[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                cells.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            if (current) cells.push(current.trim());
            return cells;
          }).filter(row => row.some(cell => cell));

          if (rows.length < 2) {
            reject(new Error('CSV file must have headers and at least one data row'));
            return;
          }

          const headers = rows[0].map(h => h.toLowerCase());
          const dataRows = rows.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, idx) => {
              obj[header] = row[idx] || '';
            });
            return obj;
          });

          resolve(dataRows);
        } else {
          if (!window.XLSX) {
            reject(new Error('SheetJS library not loaded. Please ensure XLSX is available.'));
            return;
          }

          const workbook = window.XLSX.read(data, { type: 'binary' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = window.XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            reject(new Error('No data found in spreadsheet'));
            return;
          }

          resolve(jsonData.map(row => {
            const normalized = {};
            for (const [key, value] of Object.entries(row)) {
              normalized[key.toLowerCase()] = value;
            }
            return normalized;
          }));
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  });
};

const DetailModal = ({ cell, onClose }) => {
  if (!cell || !cell.items || cell.items.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{cell?.category} - {cell?.month}</h3>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <p>No order details available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{cell.category} - {cell.month}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <table className="detail-table">
            <thead>
              <tr>
                <th>Buyer</th>
                <th>Style</th>
                <th>Units</th>
                <th>Price/Unit</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              {cell.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.buyer || '-'}</td>
                  <td>{item.style || '-'}</td>
                  <td>{item.units || 0}</td>
                  <td>{formatCurrency(item.price)}</td>
                  <td className="total-value">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="4" className="totals-label">Total</td>
                <td className="totals-value">
                  {formatCurrency(cell.items.reduce((sum, item) => sum + (item.total || 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

const UploadZone = ({ onFilesSelected, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.csv') || f.name.endsWith('.xlsb')
    );

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  return (
    <div
      className={`upload-zone ${isDragOver ? 'drag-over' : ''} ${isLoading ? 'loading' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="file-input"
        multiple
        accept=".xlsx,.csv,.xlsb"
        onChange={handleFileInputChange}
        disabled={isLoading}
        style={{ display: 'none' }}
      />
      <label htmlFor="file-input" className="upload-label">
        <div className="upload-icon">📎</div>
        <div className="upload-text">
          {isLoading ? 'Processing...' : 'Drag & drop files or click to upload'}
        </div>
        <div className="upload-hint">.xlsx, .csv, .xlsb</div>
      </label>
    </div>
  );
};

const Bookings = () => {
  const { showToast } = useToast();
  const [bookingsData, setBookingsData] = useState(() => {
    const stored = localStorage.getItem('ua_bookings_data');
    return stored ? JSON.parse(stored) : {};
  });
  const [selectedCell, setSelectedCell] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const matrix = useMemo(() => {
    const grid = {};

    CATEGORIES.forEach(category => {
      grid[category] = {};
      MONTHS.forEach(month => {
        grid[category][month] = {
          category,
          month,
          total: 0,
          items: []
        };
      });
    });

    Object.entries(bookingsData).forEach(([key, items]) => {
      const [category, month] = key.split('|');
      if (grid[category] && grid[category][month]) {
        grid[category][month].items = items;
        grid[category][month].total = items.reduce((sum, item) => sum + (item.total || 0), 0);
      }
    });

    return grid;
  }, [bookingsData]);

  const totalsPerMonth = useMemo(() => {
    const totals = {};
    MONTHS.forEach(month => {
      totals[month] = 0;
      CATEGORIES.forEach(category => {
        totals[month] += matrix[category][month].total || 0;
      });
    });
    return totals;
  }, [matrix]);

  const totalsPerCategory = useMemo(() => {
    const totals = {};
    CATEGORIES.forEach(category => {
      totals[category] = 0;
      MONTHS.forEach(month => {
        totals[category] += matrix[category][month].total || 0;
      });
    });
    return totals;
  }, [matrix]);

  const grandTotal = useMemo(() => {
    return Object.values(totalsPerMonth).reduce((sum, val) => sum + val, 0);
  }, [totalsPerMonth]);

  const handleFilesSelected = useCallback(async (files) => {
    setIsLoading(true);
    try {
      const allData = [];

      for (const file of files) {
        const parsed = await parseUploadedFile(file);
        allData.push(...parsed);
      }

      const newData = { ...bookingsData };

      allData.forEach(row => {
        let category = null;
        let buyer = '';
        let units = 0;
        let price = 0;
        let shipDate = '';
        let style = '';

        for (const [key, value] of Object.entries(row)) {
          const lowerKey = key.toLowerCase();

          if (lowerKey.includes('category') || lowerKey.includes('type') || lowerKey.includes('product')) {
            const val = String(value).toLowerCase();
            for (const cat of CATEGORIES) {
              if (val.includes(cat.toLowerCase())) {
                category = cat;
                break;
              }
            }
          }

          if (lowerKey.includes('buyer') || lowerKey.includes('account') || lowerKey.includes('customer')) {
            buyer = value ? String(value).trim() : '';
          }

          if (lowerKey.includes('unit') || lowerKey.includes('qty') || lowerKey.includes('quantity')) {
            units = parseFloat(value) || 0;
          }

          if (lowerKey.includes('price') || lowerKey.includes('cost') || lowerKey.includes('rate')) {
            price = parseFloat(value) || 0;
          }

          if (lowerKey.includes('ship') || lowerKey.includes('date') || lowerKey.includes('delivery')) {
            shipDate = String(value).trim();
          }

          if (lowerKey.includes('style') || lowerKey.includes('sku') || lowerKey.includes('item')) {
            style = value ? String(value).trim() : '';
          }
        }

        if (!category) {
          category = 'Missy Dresses';
        }

        const monthIndex = getMonthIndex(shipDate);
        if (monthIndex === -1) {
          return;
        }

        const month = MONTHS[monthIndex];
        const key = `${category}|${month}`;
        const total = units * price;

        if (!newData[key]) {
          newData[key] = [];
        }

        newData[key].push({
          buyer,
          units,
          price,
          total,
          style,
          shipDate
        });
      });

      setBookingsData(newData);
      localStorage.setItem('ua_bookings_data', JSON.stringify(newData));
      showToast(`Successfully imported ${allData.length} order(s)`, 'success');
    } catch (error) {
      console.error('Upload error:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [bookingsData, showToast]);

  return (
    <div className="bookings-page">
      <PageHeader title="BOOKINGS" />

      <div className="bookings-container">
        <div className="upload-section">
          <UploadZone onFilesSelected={handleFilesSelected} isLoading={isLoading} />
        </div>

        <div className="matrix-section">
          <div className="matrix-wrapper">
            <table className="bookings-matrix">
              <thead>
                <tr>
                  <th className="row-header">Category</th>
                  {MONTHS.map(month => (
                    <th key={month} className="month-header">{month}</th>
                  ))}
                  <th className="totals-col-header">Total</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map(category => (
                  <tr key={category} className="data-row">
                    <td className="category-label">{category}</td>
                    {MONTHS.map(month => {
                      const cell = matrix[category][month];
                      return (
                        <td
                          key={`${category}-${month}`}
                          className="data-cell"
                          onClick={() => setSelectedCell(cell)}
                        >
                          {formatCurrency(cell.total)}
                        </td>
                      );
                    })}
                    <td className="row-total">{formatCurrency(totalsPerCategory[category])}</td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td className="totals-label">Total</td>
                  {MONTHS.map(month => (
                    <td key={`total-${month}`} className="column-total">
                      {formatCurrency(totalsPerMonth[month])}
                    </td>
                  ))}
                  <td className="grand-total">{formatCurrency(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {selectedCell && (
          <DetailModal cell={selectedCell} onClose={() => setSelectedCell(null)} />
        )}
      </div>
    </div>
  );
};

export default Bookings;
