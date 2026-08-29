import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import StudentList from './StudentList.jsx';
import SubjectList from './SubjectList.jsx';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5500'; // Adjust if backend runs elsewhere

const Dashboard = ({ onLogout }) => {
  const [page, setPage] = useState('dashboard');
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('activity', (log) => {
      setActivity(log);
    });
    // Fallback: fetch once on mount in case socket is slow
    fetch('/api/activity').then(r => r.json()).then(setActivity).catch(() => {});
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    let title = 'Admin Dashboard';
    switch (page) {
      case 'students':
        title = 'Student List';
        break;
      case 'subjects':
        title = 'Subject List';
        break;
      case 'settings':
        title = 'Settings';
        break;
      case 'files':
        title = 'File Management';
        break;
      default:
        title = 'Admin Dashboard';
    }
    document.title = title;
  }, [page]);

  const renderContent = () => {
    switch (page) {
      case 'students':
        return <StudentList onBack={() => setPage('dashboard')} />;
      case 'subjects':
        return <SubjectList onBack={() => setPage('dashboard')} />;
      case 'settings':
        return (
          <div className="dashboard-section">
            <h2>Settings</h2>
            <p>Settings management coming soon...</p>
            <button className="dashboard-logout" onClick={() => setPage('dashboard')}>Back to Dashboard</button>
          </div>
        );
      case 'files':
        return (
          <div className="dashboard-section">
            <h2>File Management</h2>
            <p>File management coming soon...</p>
            <button className="dashboard-logout" onClick={() => setPage('dashboard')}>Back to Dashboard</button>
          </div>
        );
      default:
        return (
          <>
            <section className="dashboard-welcome">
              <h2>Welcome, Admin!</h2>
            </section>
            <div className="dashboard-cards">
              <div className="dashboard-card">
                <h3>👥 Students</h3>
                <p>Manage users, reset passwords, and assign roles.</p>
                <button onClick={() => setPage('students')}>Student List</button>
              </div>
              <div className="dashboard-card">
                <h3>📊 Subjects</h3>
                <p>See list of subjects.</p>
                <button onClick={() => setPage('subjects')}>View Subject List</button>
              </div>
              <div className="dashboard-card">
                <h3>⚙️ Settings</h3>
                <p>Configure system preferences and security options.</p>
                <button onClick={() => setPage('settings')}>Settings</button>
              </div>
              <div className="dashboard-card">
                <h3>📁 Files</h3>
                <p>Upload, download, and manage documents.</p>
                <button onClick={() => setPage('files')}>Manage Files</button>
              </div>
            </div>
            <section className="dashboard-activity">
              <h2>Recent Activity</h2>
              <ul>
                {activity.length === 0 && <li>No recent activity.</li>}
                {activity.map((a, i) => (
                  <li key={i}>{a.message} <span className="activity-time">{formatTimeAgo(a.time)}</span></li>
                ))}
              </ul>
            </section>
          </>
        );
    }
  };

  // Helper to format time ago
  function formatTimeAgo(iso) {
    if (!iso) return '';
    const now = new Date();
    const then = new Date(iso);
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return `${diff} sec ago`;
    if (diff < 3600) return `${Math.floor(diff/60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)} hour ago`;
    return then.toLocaleString();
  }

  return (
    <div className="dashboard-bg">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <img src="https://i.ibb.co/6b2H0qQ/avatar.png" alt="Admin Avatar" className="dashboard-avatar" />
          <h1>{(() => {
            switch (page) {
              case 'students': return 'Student List';
              case 'subjects': return 'Subject List';
              case 'settings': return 'Settings';
              case 'files': return 'File Management';
              default: return 'Admin Dashboard';
            }
          })()}</h1>
          <button className="dashboard-logout" onClick={onLogout}>Logout</button>
        </header>
        <main className="dashboard-main">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
