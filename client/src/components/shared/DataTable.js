import React from 'react';
import './DataTable.css';

const DataTable = ({
  columns = [],
  data = [],
  sort = { col: null, dir: 'asc' },
  onSort = () => {},
  emptyMessage = 'No data available',
  onRowClick = null,
  rowKey = '_id',
  maxHeight = null,
}) => {
  const handleHeaderClick = (colKey) => {
    onSort(colKey);
  };

  const getSortArrow = (colKey) => {
    if (sort.col !== colKey) return null;
    return sort.dir === 'asc' ? '▲' : '▼';
  };

  const containerStyle = maxHeight ? { maxHeight, overflow: 'auto' } : {};

  return (
    <div className="table-wrap" style={maxHeight ? { overflow: 'hidden' } : {}}>
      <div style={containerStyle}>
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleHeaderClick(col.key)}
                  style={{
                    width: col.width,
                    textAlign: col.align || 'left',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  className="sortable-header"
                >
                  <span className="header-content">
                    {col.label}
                    {getSortArrow(col.key) && (
                      <span className="sort-arrow">{getSortArrow(col.key)}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="empty-state"
                  style={{ textAlign: 'center', padding: '40px 20px' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row[rowKey]}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? 'clickable-row' : ''}
                >
                  {columns.map((col) => {
                    const value = row[col.key];
                    const cellContent = col.render
                      ? col.render(value, row)
                      : value;

                    return (
                      <td
                        key={`${row[rowKey]}-${col.key}`}
                        style={{
                          width: col.width,
                          textAlign: col.align || 'left',
                        }}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
