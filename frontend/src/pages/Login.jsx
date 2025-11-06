import { useState } from 'react';
import axios from 'axios';
import {jwtDecode} from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setStatus('');

    if (!username || !accountNumber || !password) {
      setStatus('Username, account number and password are required');
      return;
    }

    const payload = { username, accountNumber, password };

    try {
      const res = await axios.post('https://localhost:5001/api/auth/login', payload);
      
      const token = res.data?.token;

      if (!token) {
        setStatus('No token received from server');
        return;
      }

      const decoded = jwtDecode(token);
      console.log("Decoded token:", decoded);

      localStorage.setItem("token", token);
      localStorage.setItem("currentUser", JSON.stringify(decoded));

      // optional callback to update app state
      onLogin(decoded);

      console.log("Login successful:", decoded);
      setStatus("Login successful");

      nav('/payments');
    } catch (err) {
      console.error("Login error:", err);
      setStatus('Login failed');
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: 32,
      gap: 24
    }}>
      <div style={{
        width: '100%',
        maxWidth: 900,
        background: 'rgba(255,255,255,0.92)',
        padding: 28,
        borderRadius: 10,
        boxShadow: '0 6px 20px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ margin: 4, fontSize: 26 }}>Login</h3>
        <p style={{ marginTop: 8, marginBottom: 18, color: '#555' }}>
          Enter your username, account number and password.
        </p>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14, width: '100%' }}>
          <input
            className="form-control"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', fontSize: 18 }}
          />
          <input
            className="form-control"
            placeholder="Account number"
            value={accountNumber}
            onChange={e => setAccountNumber(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', fontSize: 18 }}
          />
          <input
            className="form-control"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', fontSize: 18 }}
          />

          <button className="btn btn-success btn-lg" style={{ fontSize: 18 }} type="submit">
            Login
          </button>

          {status && <div style={{ color: 'red', fontSize: 16 }}>{status}</div>}
        </form>
      </div>
    </div>
  );
}
