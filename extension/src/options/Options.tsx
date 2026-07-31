import React from 'react';
import ReactDOM from 'react-dom/client';

// Options page — Phase 2.10 implementation goes here.
// Shows: exclude-list editor, monitoring preferences.

function Options(): React.JSX.Element {
  return (
    <div style={{ padding: '1.5rem', maxWidth: '40rem', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Visual AI Agent — Settings
      </h1>
      <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
        Options UI — coming in Phase 2
      </p>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>
  );
}
