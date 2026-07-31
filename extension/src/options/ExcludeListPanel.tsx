import React, { useEffect, useState } from 'react';

export default function ExcludeListPanel() {
  const [patterns, setPatterns] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get('excludeList').then(({ excludeList }) => {
      if (excludeList && Array.isArray(excludeList)) {
        setPatterns(excludeList.join('\n'));
      }
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const customList = patterns
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // Snapshot the running purge counter so we can report how many buffered
    // events this save removed (the background worker purges on this write).
    const before = (await chrome.storage.local.get('purgedEventsCount'))
      .purgedEventsCount as number ?? 0;

    await chrome.storage.local.set({ excludeList: customList });

    // Give the background storage.onChanged listener a moment to purge.
    setTimeout(async () => {
      const after = (await chrome.storage.local.get('purgedEventsCount'))
        .purgedEventsCount as number ?? 0;
      const purgedNow = Math.max(0, after - before);
      setNotice(
        purgedNow > 0
          ? `Saved. Purged at least ${purgedNow} already-buffered event(s) matching the new list. Any remaining matches are removed on the next sync.`
          : 'Saved. Matching buffered events are purged and future capture is now blocked.'
      );
      setSaving(false);
    }, 600);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Exclusion List</h2>
        <p className="text-sm text-gray-500 mt-1">
          Add specific domains you want to completely block from monitoring. 
          One pattern per line. Do not use wildcards (e.g., use <code>github.com</code> instead of <code>*.github.com</code>).
        </p>
      </div>

      <textarea 
        value={patterns}
        onChange={e => setPatterns(e.target.value)}
        rows={10} 
        placeholder="example.com&#10;reddit.com"
        className="w-full p-3 border rounded-md font-mono text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
      />
      
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 max-w-[80%]">
          <strong>Note:</strong> Built-in defaults (banking, health, auth/OTP) are always excluded automatically and cannot be bypassed.
        </p>
        <button 
          onClick={save}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save List'}
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-700">
          🛡️ {notice}
        </div>
      )}
    </div>
  );
}
