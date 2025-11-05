import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function EmployeePayments() {
  const nav = useNavigate();
  const [txns, setTxns] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingIds, setLoadingIds] = useState([]); // ids currently in-flight
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const debounceRef = useRef(null);

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('currentUser')); } catch { return null; }
  })();

  const authHeaders = currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {};

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    const fetchTxns = async () => {
      try {
        // use relative or absolute backend URL as in your project
        const res = await axios.get('https://localhost:5001/api/employeepayments/getall', { headers: authHeaders });
        if (!mounted) return;

        if (Array.isArray(res.data)) {
          const normalized = res.data.map(p => ({
            id: p._id || p.id,
            username: p.username || '',
            senderEmail: p.senderEmail || '',
            receiverEmail: p.receiverEmail || '',
            amount: (typeof p.amount === 'number') ? p.amount : Number(p.amount || 0),
            currency: p.currency || 'USD',
            provider: p.provider || '',
            accountInfo: p.accountInfo || '',
            accountNumber: p.accountNumber || '',
            swiftCode: p.swiftCode || '',
            reason: p.reason || '',
            verified: !!p.verified,
            accountValid: null,
            swiftValid: null,
            submitted: !!p.submitted,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(p._id ? undefined : Date.now())
          }));
          setTxns(normalized);
          return;
        }
      } catch (err) {
        console.warn('Could not fetch employee payments from backend.', err?.message);
      }
    };

    fetchTxns();
    return () => { mounted = false; };
  }, []); // authHeaders may be added to deps if tokens change

  const updateTxn = (id, patch) => {
    setTxns(txs => txs.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const setLoading = (id, on = true) => {
    setLoadingIds(ids => on ? Array.from(new Set([...ids, id])) : ids.filter(i => i !== id));
  };

  // filtering across all fields using single text box
  const displayed = useMemo(() => {
    const q = (debouncedQuery || '').toLowerCase();
    let items = txns;

    if (q) {
      items = items.filter(t => {
        // check string fields plus amount and createdAt ISO/local string
        const checks = [
          t.username,
          t.accountNumber,
          String(t.amount),
          t.currency,
          t.provider,
          t.accountInfo,
          t.swiftCode,
          t.senderEmail,
          t.receiverEmail,
          t.reason,
          t.createdAt ? t.createdAt.toISOString() : ''
        ].filter(Boolean).map(s => String(s).toLowerCase());

        return checks.some(s => s.includes(q));
      });
    }

    // sorting
    const dir = sortDir === 'asc' ? 1 : -1;
    items = [...items].sort((a, b) => {
      const A = a[sortField];
      const B = b[sortField];

      // handle createdAt as Date
      if (sortField === 'createdAt') {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return (ta - tb) * dir;
      }

      // numeric compare for amount
      if (sortField === 'amount') {
        return (Number(A || 0) - Number(B || 0)) * dir;
      }

      // fallback string compare
      const sa = (A || '').toString().toLowerCase();
      const sb = (B || '').toString().toLowerCase();
      if (sa < sb) return -1 * dir;
      if (sa > sb) return 1 * dir;
      return 0;
    });

    return items;
  }, [txns, debouncedQuery, sortField, sortDir]);

  // Use the provided POST /verify-account route to validate account/receiver/sender
  const checkRecord = async (txn) => {
    setMessage('');
    setLoading(txn.id, true);

    updateTxn(txn.id, { accountValid: null, swiftValid: null });

    try {
      const body = {
        accountNumber: txn.accountNumber || '',
        senderEmail: txn.senderEmail || '',
        accountInfo: txn.accountInfo || '',
        receiverEmail: txn.receiverEmail || ''
      };

      const res = await axios.post('https://localhost:5001/api/employeepayments/verify-account', body, { headers: authHeaders });

      const { verified = false, message: srvMsg = '' } = res.data || {};

      if (verified) {
        updateTxn(txn.id, { accountValid: true, swiftValid: true, verified: true });
        setMessage(srvMsg || 'Sender and receiver verified.');
      } else {
        updateTxn(txn.id, { accountValid: false, swiftValid: false, verified: false });
        setMessage(srvMsg || 'Verification failed.');
      }
    } catch (err) {
      const status = err.response?.status;
      const srvMsg = err.response?.data?.message || err.message || 'Verification failed';
      const lower = (srvMsg || '').toLowerCase();
      let accountValid = null, swiftValid = null;

      if (status === 404) {
        if (lower.includes('sender')) accountValid = false;
        if (lower.includes('receiver')) swiftValid = false;
      } else if (status === 400) {
        if (lower.includes('sender') || lower.includes('account number does not match')) accountValid = false;
        if (lower.includes('receiver') || lower.includes('does not match records')) swiftValid = false;
      }

      if (accountValid === null && swiftValid === null) {
        accountValid = false;
        swiftValid = false;
      }

      updateTxn(txn.id, { accountValid, swiftValid, verified: false });
      setMessage(srvMsg);
    } finally {
      setLoading(txn.id, false);
    }
  };

  // the rest of action handlers unchanged (toggleVerify, submitToSwift, bulkSubmit)...
  const toggleVerify = async (txn) => {
    setMessage('');
    if (txn.accountValid === null || txn.swiftValid === null) {
      setMessage('Run checks first before toggling verification.');
      return;
    }
    const newVerified = !txn.verified;
    updateTxn(txn.id, { verified: newVerified });
    setMessage(newVerified ? 'Marked verified (local change)' : 'Verification removed (local change)');
  };

  const submitToSwift = async (txn) => {
    setMessage('');
    if (!txn.verified) {
      setMessage('Only verified transactions can be submitted to SWIFT.');
      return;
    }
    setLoading(txn.id, true);
    try {
      updateTxn(txn.id, { submitted: true, swiftResponse: { simulated: true } });
      setMessage('Submitted to SWIFT (simulated). Implement server-side submit endpoint to persist.');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to submit to SWIFT';
      setMessage(errMsg);
    } finally {
      setLoading(txn.id, false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const bulkSubmit = async () => {
    setMessage('');
    const toSubmit = txns.filter(t => selectedIds.includes(t.id) && t.verified && !t.submitted);
    if (!toSubmit.length) {
      setMessage('No verified selections to submit.');
      return;
    }
    for (const t of toSubmit) {
      setLoading(t.id, true);
      try {
        updateTxn(t.id, { submitted: true, swiftResponse: { simulated: true } });
      } catch {
        updateTxn(t.id, { submitted: false });
      } finally {
        setLoading(t.id, false);
      }
    }
    setSelectedIds([]);
    setMessage(`Bulk submit simulated for ${toSubmit.length} transaction(s).`);
  };

  const formatStatus = ({ accountValid, swiftValid, verified, submitted }) => {
    if (submitted) return { text: 'Submitted', color: 'green' };
    if (verified) return { text: 'Verified', color: 'green' };
    if (accountValid === null || swiftValid === null) return { text: 'Unchecked', color: '#555' };
    if (accountValid && swiftValid) return { text: 'Checks OK', color: 'green' };
    return { text: 'Mismatch', color: 'red' };
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>International Payments — Employee Portal</h2>
      <p style={{ color: '#666' }}>Review incoming transactions, validate payee account & SWIFT, verify and submit to SWIFT.</p>

      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          placeholder="Search any field (username, account, email, amount, provider, date...)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ padding: 8, flex: 1 }}
        />

        <select value={sortField} onChange={e => setSortField(e.target.value)} style={{ padding: 8 }}>
          <option value="createdAt">Date</option>
          <option value="username">Username</option>
          <option value="accountNumber">Account</option>
          <option value="amount">Amount</option>
          <option value="currency">Currency</option>
          <option value="provider">Provider</option>
          <option value="senderEmail">Sender Email</option>
          <option value="receiverEmail">Receiver Email</option>
        </select>

        <button className="btn btn-sm btn-outline-secondary" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          {sortDir === 'asc' ? 'Asc' : 'Desc'}
        </button>

        <button className="btn btn-sm btn-secondary" onClick={() => { setQuery(''); setDebouncedQuery(''); }}>
          Clear
        </button>

        <div style={{ marginLeft: 'auto', color: '#333' }}>{message}</div>
      </div>

      <table className="table table-striped">
        <thead>
          <tr>
            <th style={{ width: 36 }}></th>
            <th>ID</th>
            <th>Date</th>
            <th>Sender</th>
            <th>Receiver</th>
            <th>Amount</th>
            <th>Provider</th>
            <th>Account Info</th>
            <th>SWIFT</th>
            <th>Status</th>
            <th style={{ minWidth: 260 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map(txn => {
            const st = formatStatus(txn);
            const isLoading = loadingIds.includes(txn.id);
            return (
              <tr key={txn.id}>
                <td><input type="checkbox" checked={selectedIds.includes(txn.id)} onChange={() => toggleSelect(txn.id)} disabled={txn.submitted} /></td>
                <td>{txn.id}</td>
                <td>{txn.createdAt ? txn.createdAt.toLocaleString() : '—'}</td>
                <td style={{ maxWidth: 160 }}>{txn.senderEmail}</td>
                <td style={{ maxWidth: 180 }}>{txn.receiverEmail}</td>
                <td>{txn.amount} {txn.currency}</td>
                <td>{txn.provider}</td>
                <td>{txn.accountInfo}</td>
                <td>{txn.swiftCode}</td>
                <td style={{ color: st.color, fontWeight: 600 }}>{st.text}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline-primary btn-sm" onClick={() => checkRecord(txn)} disabled={isLoading}>
                      {isLoading ? 'Checking...' : 'Check Account & SWIFT'}
                    </button>
                    <button className="btn btn-outline-success btn-sm" onClick={() => toggleVerify(txn)} disabled={isLoading || txn.submitted || !(txn.accountValid !== null && txn.swiftValid !== null)}>
                      {txn.verified ? 'Un-verify' : 'Mark Verified'}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => submitToSwift(txn)} disabled={isLoading || txn.submitted || !txn.verified}>
                      {isLoading ? 'Submitting...' : txn.submitted ? 'Submitted' : 'Submit to SWIFT'}
                    </button>
                  </div>
                  <div style={{ marginTop: 6, color: txn.accountValid === false || txn.swiftValid === false ? 'red' : '#666' }}>
                    {txn.accountValid === null ? 'Account: unchecked' : `Account: ${txn.accountValid ? 'OK' : 'Not found'}`} · {txn.swiftValid === null ? 'SWIFT: unchecked' : `SWIFT: ${txn.swiftValid ? 'OK' : 'Mismatch'}`}
                    {txn.swiftResponse ? <div style={{ marginTop: 6, color: '#444' }}>SWIFT: {JSON.stringify(txn.swiftResponse)}</div> : null}
                  </div>
                </td>
              </tr>
            );
          })}

          {displayed.length === 0 && (
            <tr><td colSpan={11} style={{ textAlign: 'center' }}>No results</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}