// frontend/src/App.jsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Payments from './pages/PaymentPage';
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import EmployeePayments from './pages/EmployeePayments';
import backgroundImage from './assets/marble-background.jpg';

export default function App() {
  const [testMsg, setTestMsg] = useState('');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('currentUser')) || null;
    } catch {
      return null;
    }
  });

  // background image styling
  const backgroundStyle = {
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    minHeight: '100vh',
    backgroundPosition: 'center',
    width: '100%',
  };

  // backend test connectivity check
  useEffect(() => {
    axios.get('https://localhost:5001/test')
      .then(res => setTestMsg(res.data?.message ?? ''))
      .catch(() => {
        // fallback if localhost test fails
        axios.get('/test')
          .then(res => setTestMsg(res.data?.message ?? ''))
          .catch(() => setTestMsg('No response from backend'));
      });
  }, []);

  const handleLogin = (userObj) => {
    setUser(userObj);
    localStorage.setItem('currentUser', JSON.stringify(userObj));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
    window.location.reload();
  };

  return (
    <BrowserRouter>
      <header>
        <nav
          className="navbar navbar-expand-lg bg-primary"
          data-bs-theme="dark"
          style={{ padding: 12 }}
        >
          <div className="container-fluid" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link className="navbar-brand text-white" to="/">
              CBA Banking <span style={{ marginLeft: 6, marginRight: 6 }}>|</span>
            </Link>

            <div className="collapse navbar-collapse" id="navbarColor01" style={{ flex: 1 }}>
              <ul
                className="navbar-nav me-auto mb-2 mb-lg-0"
                style={{ display: 'flex', gap: 12, alignItems: 'center' }}
                >
                {/* Only show Payments link if user is logged in */}
                {user?.role === 'user' && (
                  <li className="nav-item">
                    <Link className="nav-link text-white" to="/payments">Payments</Link>
                  </li>
                )}
                {user?.role === 'employee' && (
                  <li className="nav-item">
                    <Link className="nav-link text-white" to="/employee-payments">Employee Payments</Link>
                  </li>
                )}
              </ul>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {!user && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
                    <Link className="nav-link text-white" to="/register" style={{ padding: '6px 10px' }}>Register</Link>
                    <Link className="nav-link text-white" to="/login" style={{ padding: '6px 10px' }}>Login</Link>
                  </div>
                )}

                {user && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
                    <span className="text-white" style={{ fontWeight: 600 }}>{user.username}</span>
                    <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>Logout</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>
      </header>

      <main style={{ padding: 20, ...backgroundStyle }}>
        <Routes>
          <Route
            path="/"
            element={
              <>
              <br/> <br/>
              <div className="container justify-content-center align-items-center" style={{textAlign: 'center', marginTop: 50, backgroundColor: 'rgba(255, 255, 255, 0.5)', padding: 30, borderRadius: 10}}>
                <h1 style={{fontSize: 50}}>Welcome to CBA banking</h1>
                <br/>
                <i className="" style={{fontSize: 25}}>Banking. Simplified.</i>
                <br/>
                <br/>
                <p style={{fontSize: 20}}>{user ? `Logged in as ${user.username}` : 'Please register or login before continuing'}</p>
              </div>
              </>
            }
          />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-cancel" element={<PaymentCancel />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          {/* Payments page is now accessible without login */}
          <Route path="/payments" element={<Payments user={user} />} />
          <Route
            path="/employee-payments"
            element={user?.role === 'employee' ? <EmployeePayments /> : <Login onLogin={handleLogin} />}
          />

        </Routes>
      </main>
    </BrowserRouter>
  );
}
