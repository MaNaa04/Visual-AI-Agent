import React, { useState } from 'react';
import { API_BASE_URL } from '../lib/constants';

// We need getClientId from storage.ts but it's an async getter
async function getClientId(): Promise<string> {
  const result = await chrome.storage.local.get('clientId');
  return (result['clientId'] as string) ?? 'unknown';
}

function authHeaders(clientId: string): Record<string, string> {
  return { 'X-Client-ID': clientId };
}

export default function PrivacyPanel() {
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<{success: boolean, msg: string} | null>(null);
  
  const handleExport = async () => {
    try {
      const clientId = await getClientId();
      const res = await fetch(`${API_BASE_URL}/api/events/export`, {
        headers: authHeaders(clientId)
      });
      if (!res.ok) throw new Error('Export failed');
      
      const data = await res.json();
      
      // Create a blob and trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visual-ai-agent-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data. Ensure backend is running.');
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return;
    
    setDeleting(true);
    setDeleteStatus(null);
    try {
      const clientId = await getClientId();
      const res = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'DELETE',
        headers: authHeaders(clientId)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Delete failed');
      
      setDeleteStatus({
        success: data.failed_files === 0, 
        msg: `Deleted ${data.deleted_records} records. ${data.failed_files > 0 ? `Failed to remove ${data.failed_files} screenshot files.` : ''}`
      });
      setDeleteConfirm('');
    } catch (err) {
      console.error('Delete error:', err);
      setDeleteStatus({ success: false, msg: 'Failed to communicate with backend.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Consent Section */}
      <section className="bg-blue-50 p-4 rounded-md border border-blue-100">
        <h2 className="text-blue-800 font-semibold mb-2">Data Collection & Privacy</h2>
        <p className="text-sm text-blue-900 leading-relaxed">
          This extension tracks your web navigation, clicks, scrolling, and periodically captures screenshots to build a 
          first-person dataset of your digital activity. 
          <br /><br />
          <strong>Your data is yours.</strong> It is stored locally in your own self-hosted backend infrastructure. 
          It is never sent to third-party analytics services. Sensitive domains (banking, health, passwords) are 
          hard-blocked from capture.
        </p>
      </section>

      {/* Export Section */}
      <section>
        <h3 className="font-semibold mb-2">Export Data</h3>
        <p className="text-sm text-gray-500 mb-4">
          Download a complete JSON dump of all behavioral events and screenshot references currently stored in your backend.
        </p>
        <button 
          onClick={handleExport}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 font-medium rounded-md transition-colors"
        >
          Export as JSON
        </button>
      </section>

      <hr className="border-gray-200" />

      {/* Delete Section */}
      <section>
        <h3 className="font-semibold text-red-600 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-600 mb-4">
          Permanently delete all your events and physical screenshot files from the backend. This action cannot be undone.
        </p>
        
        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-medium text-gray-500 mb-1">Type DELETE to confirm</label>
            <input 
              type="text" 
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              className="w-full p-2 border border-red-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="DELETE"
            />
          </div>
          <button 
            onClick={handleDelete}
            disabled={deleteConfirm !== 'DELETE' || deleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium rounded-md transition-colors"
          >
            {deleting ? 'Deleting...' : 'Delete All Data'}
          </button>
        </div>
        
        {deleteStatus && (
          <p className={`mt-3 text-sm font-medium ${deleteStatus.success ? 'text-green-600' : 'text-red-600'}`}>
            {deleteStatus.msg}
          </p>
        )}
      </section>
    </div>
  );
}
