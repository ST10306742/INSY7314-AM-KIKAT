// frontend/src/pages/PaymentPage.jsx
import { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function PaymentPage() {
  const [senderEmail, setSenderEmail] = useState('');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD'); // default currency
  const [provider, setProvider] = useState('');
  const [accountInfo, setAccountInfo] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [status, setStatus] = useState('');
  const [statusColor, setStatusColor] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);
  const nav = useNavigate();
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('currentUser')) || null;
    } catch {
      return null;
    }
  });
  const [senderEmail, setSenderEmail] = useState(() => user?.email || '');

  const currencies = [
    'USD','EUR','GBP','AUD','CAD','ZAR','JPY','CNY','INR','NZD','CHF','SGD','HKD'
  ];

  const startProgress = () => {
    setProgress(6);
    progressRef.current = setInterval(() => {
      setProgress(p => Math.min(90, p + Math.floor(Math.random() * 8) + 4));
    }, 300);
  };

  const stopProgress = (final = 100) => {
    if (progressRef.current) clearInterval(progressRef.current);
    progressRef.current = null;
    setProgress(final);
    setTimeout(() => setProgress(0), 600);
  };

  // Combined payment function
  const handlePayment = async (e) => {
    e.preventDefault();
    if (loading) return;

    setStatus('');
    setStatusColor('');

    // frontend validation
    if (!senderEmail || !receiverEmail || !amount || !currency || !provider || !accountInfo || !swiftCode) {
      setStatus('All fields are required.');
      setStatusColor('red');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderEmail) || !emailRegex.test(receiverEmail)) {
      setStatus('Please enter valid email addresses.');
      setStatusColor('red');
      return;
    }

    const payload = { senderEmail, receiverEmail, amount, currency, provider, accountInfo, swiftCode };

    try {
      setLoading(true);
      startProgress();

      // 1️⃣ Submit regular payment
      const res = await axios.post('https://localhost:5000/api/payments', payload);
      setStatus(res.data?.message || 'Payment recorded');
      setStatusColor('green');

      // 2️⃣ Then initiate PayFast payment
      const payFastRes = await axios.post('https://localhost:5000/api/payfast/create', {
        amount,
        item_name: `Payment to ${receiverEmail}`,
        buyer_email: senderEmail,
      });

      if (payFastRes.data?.url) {
        setStatus('Redirecting to PayFast...');
        setStatusColor('green');
        window.open(payFastRes.data.url, '_blank', 'noopener,noreferrer');
      } else {
        console.warn('No PayFast URL returned.');
      }

      stopProgress(100);
      setTimeout(() => nav('/payment-success', { state: payload }), 400);
    } catch (err) {
      stopProgress(100);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to process payment';
      console.error("Payment error:", errorMessage);
      setStatus(errorMessage);
      setStatusColor('red');
    } finally {
      setLoading(false);
      setSenderEmail('');
      setReceiverEmail('');
      setAmount('');
      setCurrency('USD');
      setProvider('');
      setAccountInfo('');
      setSwiftCode('');
    }
  };

  if (!user || user?.role !== 'user') {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>You cannot access the Payment Page.</h2>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 32, gap: 24 }}>
      <div style={{
        width: '100%',
        maxWidth: 900,
        background: 'rgba(255,255,255,0.92)',
        padding: 28,
        borderRadius: 10,
        boxShadow: '0 6px 20px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ margin: 4, fontSize: 26 }}>International Payment</h3>
        <p style={{ marginTop: 8, marginBottom: 18, color: '#555' }}>
          Enter the payment details below to complete your transaction.
        </p>

        <form onSubmit={handlePayment} style={{ display: 'grid', gap: 14, width: '100%' }}>
          <input className="form-control" type="email" placeholder="Sender Email"
            value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} />
          <input className="form-control" type="email" placeholder="Receiver Email"
            value={receiverEmail} onChange={(e) => setReceiverEmail(e.target.value)} disabled={loading} />
          <input className="form-control" type="number" placeholder="Amount"
            value={amount} onChange={(e) => setAmount(e.target.value)} disabled={loading} />
          <select className="form-control" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={loading}>
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="form-control" placeholder="Provider (SWIFT)"
            value={provider} onChange={(e) => setProvider(e.target.value)} disabled={loading} />
          <input className="form-control" placeholder="Account Information (Receiver Info)"
            value={accountInfo} onChange={(e) => setAccountInfo(e.target.value)} disabled={loading} />
          <input className="form-control" placeholder="SWIFT Code"
            value={swiftCode} onChange={(e) => setSwiftCode(e.target.value)} disabled={loading} />

          {progress > 0 && (
            <div className="progress" style={{ height: 10, marginTop: 8 }}>
              <div className={`progress-bar progress-bar-striped ${loading ? 'progress-bar-animated' : ''}`}
                role="progressbar"
                style={{ width: `${progress}%` }}
                aria-valuenow={progress}
                aria-valuemin="0"
                aria-valuemax="100" />
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <button className="btn btn-primary btn-lg" style={{ flex: 1, fontSize: 18 }} type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Pay Now'}
            </button>
          </div>

          {status && <div style={{ color: statusColor, fontSize: 16, marginTop: 8 }}>{status}</div>}
        </form>
      </div>
    </div>
  );
}
