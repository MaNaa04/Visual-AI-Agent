import React from 'react';
import ReactDOM from 'react-dom/client';

import StatusPanel from './StatusPanel';
import ExcludeListPanel from './ExcludeListPanel';
import PrivacyPanel from './PrivacyPanel';

function Options(): React.JSX.Element {
  const [tab, setTab] = React.useState<'status' | 'excludes' | 'privacy'>('status');

  return (
    <div className="max-w-2xl mx-auto p-6 font-sans text-gray-800">
      <h1 className="text-2xl font-bold mb-6">Settings & Options</h1>
      
      <nav className="flex gap-6 border-b mb-6 text-sm font-medium">
        {(['status', 'excludes', 'privacy'] as const).map(t => (
          <button 
            key={t} 
            onClick={() => setTab(t)} 
            className={`pb-2 capitalize transition-colors border-b-2 ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>
      
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        {tab === 'status' && <StatusPanel />}
        {tab === 'excludes' && <ExcludeListPanel />}
        {tab === 'privacy' && <PrivacyPanel />}
      </div>
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
