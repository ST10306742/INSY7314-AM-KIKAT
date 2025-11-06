// frontend/src/pages/Register.jsx
import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Register() {
const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
    const [idNumber, setIdNumber] = useState('');           
  const [accountNumber, setAccountNumber] = useState(''); 
  const [username, setUsername] = useState('');           
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setStatus('');
    if (!firstName || !lastName || !idNumber || !accountNumber || !username || !email || !password || !phoneNumber || !country || !address || !city || !postalCode) {
      setStatus('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('Passwords do not match');
      return;
    }

    const payload = { firstName, lastName, idNumber, accountNumber, username, email, password, phoneNumber, country, address, city, postalCode };

    try {
      // try backend first
      const res = await axios.post('https://localhost:5001/api/auth/register', payload);
      setStatus(res.data?.message ?? 'Registered successfully');
      nav('/login');
    } catch (err) {
      console.error('Registration error:', err);
      setStatus(err.response?.data?.message || 'Registration failed. Please try again.');
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
        <h3 style={{ margin: 4, fontSize: 26 }}>Create account</h3>
        <p style={{ marginTop: 8, marginBottom: 18, color: '#555' }}>Fill in your personal and account details.</p>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14, width: '100%' }}>
          <section style={{ display: 'grid', gap: 10 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Personal details</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <input
                className="form-control"
                placeholder="First name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', fontSize: 18 }}
              />
              <input
                className="form-control"
                placeholder="Last name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', fontSize: 18 }}
              />
              <input
                className="form-control"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: '12px 14px', fontSize: 18 }}
              />
              <input
                className="form-control"
                placeholder="Phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={{ padding: '12px 14px', fontSize: 18 }}
              />
              <input
                className="form-control"
                placeholder="ID number"
                value={idNumber}
                onChange={e => setIdNumber(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', fontSize: 18 }}
              />
               <input
                className="form-control"
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{ padding: '12px 14px', fontSize: 18 }}
              />
              <input
                className="form-control"
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ padding: '12px 14px', fontSize: 18 }}
              />
              <input
                className="form-control"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{ padding: '12px 14px', fontSize: 18 }}
              />
              <input
                className="form-control"
                placeholder="Postal Code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                style={{ padding: '12px 14px', fontSize: 18 }}
              />
            </div>
          </section>

          <section style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Account details</p>
            <div style={{ display: 'grid', gap: 10 }}>
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
              <input
                className="form-control"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', fontSize: 18 }}
              />
            </div>
          </section>

          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <button className="btn btn-success btn-lg" style={{ flex: 1, fontSize: 18 }} type="submit">Register</button>
          </div>

          {status && <div style={{ color: 'red', fontSize: 16 }}>{status}</div>}
        </form>
      </div>
    </div>
  );
}  