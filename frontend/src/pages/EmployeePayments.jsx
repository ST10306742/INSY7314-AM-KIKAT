import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Employee Payments Page for reviewing, verifying, and submitting payments to SWIFT
export default function EmployeePayments() {
  const nav = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingIds, setLoadingIds] = useState([]);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc'); //Ascending or descending
  const debounceRef = useRef(null);
  const [status, setStatus] = useState({ type: "", message: "" });

  //JWT token that contains all the user information for admins, also allows access to employee page
  const authHeaders = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    const fetchTransactions = async () => {
      try {
        // Fetch employee payments from backend
        const res = await axios.get('https://localhost:5001/api/employeepayments/getall', { headers: authHeaders });
        if (!mounted) return;

        //returned data is normalized for table
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
            swiftResponse: p.swiftResponse || null,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date()
          }));
          setTransactions(normalized);
          return;
        }
      } catch (err) {
        console.warn('Could not fetch employee payments from backend.', err?.message);
        setStatus({ type: 'error', message: 'Failed to load payments: ' + (err?.response?.data?.message || err.message) });
      }
    };

    fetchTransactions();
    return () => { mounted = false; };
  }, []);

  // State helpers
  const updateTransaction = (id, patch) => {
    setTransactions(txs => txs.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const setLoading = (id, on = true) => {
    setLoadingIds(ids => on ? Array.from(new Set([...ids, id])) : ids.filter(i => i !== id));
  };

  //status message
  const showStatus = (type, msg) => {
    setStatus({ type, message: msg });
    setMessage(msg);
    setTimeout(() => setStatus({ type: "", message: "" }), 5000);
  };

  // Filtered and sorted view
  const displayed = useMemo(() => {
    const q = (debouncedQuery || '').toLowerCase();
    let items = transactions;
    if (q) {
      items = items.filter(t => {
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
    const dir = sortDir === 'asc' ? 1 : -1;
    items = [...items].sort((a, b) => {
      const A = a[sortField];
      const B = b[sortField];
      if (sortField === 'createdAt') {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return (ta - tb) * dir;
      }
      if (sortField === 'amount') {
        return (Number(A || 0) - Number(B || 0)) * dir;
      }
      const sa = (A || '').toString().toLowerCase();
      const sb = (B || '').toString().toLowerCase();
      if (sa < sb) return -1 * dir;
      if (sa > sb) return 1 * dir;
      return 0;
    });
    return items;
  }, [transactions, debouncedQuery, sortField, sortDir]);

  //backend calls
  const verifyAccount = async (transaction) => {
    const body = {
      accountNumber: transaction.accountNumber || '',
      senderEmail: transaction.senderEmail || '',
      accountInfo: transaction.accountInfo || '',
      receiverEmail: transaction.receiverEmail || ''
    };
    //post to backend verify-account endpoint
    const res = await axios.post('https://localhost:5001/api/employeepayments/verify-account', body, { headers: authHeaders });
    return res.data;
  };

  //swift verification backend call
  const verifySwift = async (swiftCode) => {
    const res = await axios.post('https://localhost:5001/api/employeepayments/verify-swift', { swiftCode }, { headers: authHeaders });
    return res.data;
  };

  //persist verification to backend
  const persistVerification = async (transaction) => {
    const body = {
      _id: transaction.id,
      accountsVerified: !!transaction.accountValid,
      swiftCodeVerified: !!transaction.swiftValid
    };
    const res = await axios.patch('https://localhost:5001/api/employeepayments/update-verification', body, { headers: authHeaders });
    return res.data;
  };

  //persist unverify to backend
  const persistUnverify = async (transaction) => {
    const res = await axios.patch('https://localhost:5001/api/employeepayments/unverify', { _id: transaction.id }, { headers: authHeaders });
    return res.data;
  };

  //Combined check handler
  const checkRecord = async (transaction) => {
    setMessage('');
    setLoading(transaction.id, true);
    updateTransaction(transaction.id, { accountValid: null, swiftValid: null });
    try {
      const accountRes = await verifyAccount(transaction);
      const accountsOk = !!accountRes.verified;
      let swiftOk = false;
      try {
        const swiftRes = await verifySwift(transaction.swiftCode || '');
        swiftOk = !!swiftRes.valid;
      } catch (e) { swiftOk = false; }
      updateTransaction(transaction.id, { accountValid: accountsOk, swiftValid: swiftOk });
      showStatus(accountsOk && swiftOk ? 'success' : 'info', accountRes.message || (accountsOk && swiftOk ? 'Checks passed — click Submit to SWIFT to persist and submit.' : 'Checks completed'));
    } catch (err) {
      const srvMsg = err.response?.data?.message || err.message || 'Verification failed';
      updateTransaction(transaction.id, { accountValid: false, swiftValid: false, verified: false });
      showStatus('error', srvMsg);
    } finally {
      setLoading(transaction.id, false);
    }
  };

  //submit single (uses update-verification endpoint per API)
  const submitToSwift = async (transaction) => {
    setMessage('');
    if (!transaction.accountValid || !transaction.swiftValid || !transaction.verified) {
      showStatus('error', 'Payment must be verified before submission.');
      return;
    }
    setLoading(transaction.id, true);
    try {
      // Ensure verification persisted first
      await axios.patch(
        'https://localhost:5001/api/employeepayments/update-verification',
        {
          _id: transaction.id,
          accountsVerified: !!transaction.accountValid,
          swiftCodeVerified: !!transaction.swiftValid
        },
        { headers: authHeaders }
      );

      // Now call submit-to-swift to mark submitted + set swiftResponse on the server
      const res = await axios.patch(
        'https://localhost:5001/api/employeepayments/submit-to-swift',
        { _id: transaction.id },
        { headers: authHeaders }
      );

      const updated = res.data.payment;
      updateTransaction(transaction.id, {
        submitted: !!updated.submitted,
        swiftResponse: updated.swiftResponse || transaction.swiftResponse,
        reason: updated.reason || transaction.reason,
        verified: !!updated.verified
      });

      showStatus('success', res.data.message || 'Payment submitted to SWIFT.');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to submit to SWIFT';
      showStatus('error', errMsg);
    } finally {
      setLoading(transaction.id, false);
    }
  };

  //mark verified handler
  const handleMarkVerified = async (transaction) => {
    setMessage('');
    if (!(transaction.accountValid && transaction.swiftValid)) {
      showStatus('error', 'Run both checks and ensure they pass before marking verified.');
      return;
    }
    setLoading(transaction.id, true);
    try {
      const res = await persistVerification(transaction);
      const updated = res.payment;
      updateTransaction(transaction.id, { verified: !!updated.verified, reason: updated.reason || transaction.reason, createdAt: updated.createdAt ? new Date(updated.createdAt) : transaction.createdAt });
      showStatus('success', res.message || 'Verified and persisted.');
    } catch (err) {
      const srvMsg = err.response?.data?.message || err.message || 'Failed to persist verification';
      showStatus('error', srvMsg);
    } finally {
      setLoading(transaction.id, false);
    }
  };

  //mark unverified handler
  const handleUnverify = async (transaction) => {
    setMessage('');
    setLoading(transaction.id, true);
    try {
      const res = await persistUnverify(transaction);
      const updated = res.payment;
      updateTransaction(transaction.id, { verified: !!updated.verified, reason: updated.reason || transaction.reason, accountValid: null, swiftValid: null, submitted: !!updated.submitted });
      showStatus('success', res.message || 'Unverified and persisted.');
    } catch (err) {
      const srvMsg = err.response?.data?.message || err.message || 'Failed to unverify';
      showStatus('error', srvMsg);
    } finally {
      setLoading(transaction.id, false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  //Bulk submit sequentially via backend
  const bulkSubmit = async () => {
    setMessage('');
    const toSubmit = transactions.filter(t => selectedIds.includes(t.id) && t.accountValid && t.swiftValid && !t.submitted);
    if (!toSubmit.length) {
      showStatus('info', 'No verified selections to submit.');
      return;
    }

    for (const t of toSubmit) {
      setLoading(t.id, true);
      try {
        // persist verification first
        await axios.patch(
          'https://localhost:5001/api/employeepayments/update-verification',
          { _id: t.id, accountsVerified: !!t.accountValid, swiftCodeVerified: !!t.swiftValid },
          { headers: authHeaders }
        );

        // then submit to SWIFT
        const res = await axios.patch(
          'https://localhost:5001/api/employeepayments/submit-to-swift',
          { _id: t.id },
          { headers: authHeaders }
        );

        const updatedPayment = res.data.payment;
        updateTransaction(t.id, {
          verified: !!updatedPayment.verified,
          submitted: !!updatedPayment.submitted,
          swiftResponse: updatedPayment.swiftResponse || null,
          createdAt: updatedPayment.createdAt ? new Date(updatedPayment.createdAt) : t.createdAt
        });

        showStatus('success', `Submitted ${t.id}`);
      } catch (err) {
        updateTransaction(t.id, { submitted: false });
        const errMsg = err.response?.data?.message || err.message || `Failed to submit ${t.id}`;
        showStatus('error', errMsg);
      } finally {
        setLoading(t.id, false);
      }
    }

    setSelectedIds([]);
    showStatus('success', `Submitted ${toSubmit.length} transaction(s).`);
  };

  //Bulk delete backend call
  const bulkDeleteBackend = async (ids) => {
    const res = await axios.post('https://localhost:5001/api/employeepayments/delete-multiple', { ids }, { headers: authHeaders, timeout: 20000 });
    return res.data;
  };

  const deletePaymentBackend = async (transactionId) => {
    // send id in query string because some servers/apps don't parse DELETE bodies reliably
    const res = await axios.delete(
      `https://localhost:5001/api/employeepayments/delete?id=${encodeURIComponent(transactionId)}`,
      { headers: authHeaders, timeout: 20000 }
    );
    return res.data;
  };

  //Single delete handler (existing)
  const handleDelete = async (transaction) => {
    if (!transaction || !transaction.id) return;
    const ok = window.confirm(`Delete transaction ${transaction.id}? This action cannot be undone.`);
    if (!ok) return;
    setLoading(transaction.id, true);
    try {
      const res = await deletePaymentBackend(transaction.id);
      setTransactions(prev => prev.filter(t => t.id !== transaction.id));
      setSelectedIds(prev => prev.filter(id => id !== transaction.id));
      showStatus('success', res.message || 'Transaction deleted.');
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to delete transaction';
      showStatus('error', errMsg);
    } finally {
      setLoading(transaction.id, false);
    }
  };

  //Bulk delete handler
  const handleBulkDelete = async () => {
    if (!selectedIds.length) {
      showStatus('info', 'No selections to delete.');
      return;
    }
    const ok = window.confirm(`Delete ${selectedIds.length} transaction(s)? This action cannot be undone.`);
    if (!ok) return;

    //mark all selected as loading
    selectedIds.forEach(id => setLoading(id, true));

    try {
      const res = await bulkDeleteBackend(selectedIds);
      //remove deleted from local state
      setTransactions(prev => prev.filter(t => !selectedIds.includes(t.id)));
      setSelectedIds([]);
      showStatus('success', res.message || `Deleted ${res.deletedCount || selectedIds.length} transaction(s).`);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to delete selected transactions';
      showStatus('error', errMsg);
    } finally {
      //unset loading for all
      selectedIds.forEach(id => setLoading(id, false));
    }
  };

  //Format status cell
  const formatStatus = ({ accountValid, swiftValid, verified, submitted }) => {
    if (submitted) return { text: 'Submitted', color: 'green' };
    if (verified) return { text: 'Verified', color: 'green' };
    if (accountValid === null || swiftValid === null) return { text: 'Unchecked', color: '#555' };
    if (accountValid && swiftValid) return { text: 'Checks OK', color: 'green' };
    return { text: 'Mismatch', color: 'red' };
  };

  //styles
  const cellStyle = { maxWidth: 220, wordBreak: 'break-word', whiteSpace: 'normal', overflowWrap: 'break-word' };
  const smallCell = { maxWidth: 120, wordBreak: 'break-word', whiteSpace: 'normal', overflowWrap: 'break-word' };

  const bannerText = status.message || message || '';
  const bannerColor = status.type === 'error' || (message && /fail|error|failed/i.test(message)) ? '#ffe6e6' : status.type === 'success' || (message && /success|submitted|persisted|saved|ok/i.test(message)) ? '#e9ffed' : '#fff7e6';
  const bannerBorder = status.type === 'error' ? '#ff4d4f' : status.type === 'success' ? '#2ecc71' : '#ffcc66';

  //frontend UI
  return (
    <div style={{ padding: 24 }}>
      <h2>International Payments — Employee Portal</h2>
      <p style={{ color: '#666' }}>Review incoming transactions, validate payee account & SWIFT, verify and submit to SWIFT.</p>

      {bannerText ? (
        <div style={{
          marginBottom: 12,
          padding: '10px 14px',
          background: bannerColor,
          borderLeft: `6px solid ${bannerBorder}`,
          borderRadius: 6,
          color: '#222',
          fontWeight: 600,
        }}>
          {bannerText}
        </div>
      ) : null}

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

        <button className="btn btn-sm btn-primary" onClick={bulkSubmit} disabled={!selectedIds.length}>
          Submit Selected
        </button>

        <button className="btn btn-sm btn-danger" onClick={handleBulkDelete} disabled={!selectedIds.length}>
          Delete Selected
        </button>

        <div style={{ marginLeft: 'auto', color: '#333' }}>{/* lightweight inline status */}</div>
      </div>

      <table className="table table-striped" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ width: 36 }}></th>
            <th style={{ width: 120 }}>ID</th>
            <th style={{ width: 160 }}>Date</th>
            <th style={{ width: 180 }}>Sender</th>
            <th style={{ width: 200 }}>Receiver</th>
            <th style={{ width: 120 }}>Amount</th>
            <th style={{ width: 140 }}>Provider</th>
            <th style={{ width: 260 }}>Account Info</th>
            <th style={{ width: 160 }}>SWIFT</th>
            <th style={{ width: 120 }}>Status</th>
            <th style={{ minWidth: 260 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map(transaction => {
            const st = formatStatus(transaction);
            const isLoading = loadingIds.includes(transaction.id);
            return (
              <tr key={transaction.id}>
                <td style={smallCell}><input type="checkbox" checked={selectedIds.includes(transaction.id)} onChange={() => toggleSelect(transaction.id)} disabled={transaction.submitted} /></td>
                <td style={{ ...smallCell, fontSize: 12 }}>{transaction.id}</td>
                <td style={smallCell}>{transaction.createdAt ? transaction.createdAt.toLocaleString() : '—'}</td>
                <td style={cellStyle}><div style={{ overflowWrap: 'break-word' }}>{transaction.senderEmail}</div></td>
                <td style={cellStyle}><div style={{ overflowWrap: 'break-word' }}>{transaction.receiverEmail}</div></td>
                <td style={smallCell}>{transaction.amount} {transaction.currency}</td>
                <td style={cellStyle}><div style={{ overflowWrap: 'break-word' }}>{transaction.provider}</div></td>
                <td style={{ maxWidth: 260, wordBreak: 'break-word', whiteSpace: 'normal', overflowWrap: 'break-word' }}><div>{transaction.accountInfo}</div></td>
                <td style={smallCell}><div style={{ overflowWrap: 'break-word' }}>{transaction.swiftCode}</div></td>
                <td style={{ color: st.color, fontWeight: 600 }}>{st.text}</td>
                <td>
                  {transaction.submitted ? (
                    <div style={{ color: 'green', fontWeight: 600 }}>Submitted to SWIFT</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => checkRecord(transaction)} disabled={isLoading}>
                        {isLoading ? 'Checking...' : 'Check Account & SWIFT'}
                      </button>
                      {transaction.verified ? (
                        <button className="btn btn-outline-danger btn-sm" onClick={() => handleUnverify(transaction)} disabled={isLoading}>
                          Un-verify
                        </button>
                      ) : (
                        <button className="btn btn-outline-success btn-sm" onClick={() => handleMarkVerified(transaction)} disabled={isLoading || !(transaction.accountValid && transaction.swiftValid)}>
                          Mark Verified
                        </button>
                      )}
                      <button className="btn btn-primary btn-sm" onClick={() => submitToSwift(transaction)} disabled={isLoading || !transaction.verified}>
                        {isLoading ? 'Submitting...' : 'Submit to SWIFT'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(transaction)} disabled={isLoading} title="Delete this transaction from database">
                        Delete
                      </button>
                    </div>
                  )}
                  {st.text !== 'Submitted' && (
                    <div style={{ marginTop: 6, color: transaction.accountValid === false || transaction.swiftValid === false ? 'red' : '#666', fontSize: 13 }}>
                      {transaction.accountValid === null ? 'Account: unchecked' : `Account: ${transaction.accountValid ? 'OK' : 'Not found'}`} · {transaction.swiftValid === null ? 'SWIFT: unchecked' : `SWIFT: ${transaction.swiftValid ? 'OK' : 'Mismatch'}`}
                      {transaction.swiftResponse ? <div style={{ marginTop: 6, color: '#444', fontSize: 12 }}>SWIFT: {JSON.stringify(transaction.swiftResponse)}</div> : null}
                    </div>
                  )}
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