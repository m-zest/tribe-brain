import React from 'react'

const VIEW_LABELS = {
  lateral_left: 'L · Lateral',
  medial_left: 'L · Medial',
  medial_right: 'R · Medial',
  lateral_right: 'R · Lateral',
}

const VIEW_ORDER = ['lateral_left', 'medial_left', 'medial_right', 'lateral_right']

export default function BrainViewer({ images, loading, timestep }) {
  return (
    <div style={{ height: '100%' }}>
      <div className="brain-views-row" style={{ height: '100%' }}>
        {VIEW_ORDER.map(viewName => {
          const imgData = images?.[viewName]
          const label = VIEW_LABELS[viewName]

          return (
            <div
              key={viewName}
              className={`brain-view ${loading && !imgData ? 'loading' : ''}`}
            >
              {imgData ? (
                <img
                  src={`data:image/png;base64,${imgData}`}
                  alt={label}
                  draggable={false}
                />
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: 0.3,
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                    <path d="M12 2c-2.5 0-4.5 4.48-4.5 10s2 10 4.5 10 4.5-4.48 4.5-10-2-10-4.5-10z" />
                    <path d="M2 12h20" />
                  </svg>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                    {loading ? 'Loading...' : 'No data'}
                  </span>
                </div>
              )}
              <div className="view-label">{label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
