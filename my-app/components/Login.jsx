import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    // Premade login: allow login if username is 'admin' and password is 'admin'
    if (username === 'admin' && password === 'Uccadmin2025!') {
      setMessage('Login successful!');
      setTimeout(() => {
        setMessage('');
        onLogin && onLogin({ username: 'admin', role: 'admin' });
      }, 800);
    } else {
      setMessage('Invalid username or password');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    setLoading(false);
  };

  return (
    <div className="login-bg">
      <div className={`login-container${shake ? ' shake' : ''}`}> 
        <div className="login-avatar">
          <img src="https://i.ibb.co/6b2H0qQ/avatar.png" alt="avatar" />
        </div>
        <h2 className="login-title">Welcome Back!</h2>
        <form onSubmit={handleLogin}>
          <div className="login-field">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoFocus
            />
          </div>
          <div className="login-field">
            <label>Password</label>
            <div className="login-password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button type="button" className="login-show-btn" onClick={() => setShowPassword(v => !v)}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <span className="login-spinner"></span> : 'Login'}
          </button>
        </form>
        {message && (
          <div className={`login-message${message.includes('successful') ? ' success' : ' error'}`}>{message}</div>
        )}
      </div>
    </div>
  );
};

export default Login;
