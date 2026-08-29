import React from 'react';
import Dashboard from './components/Dashboard';

function App() {
  const handleLogout = () => {
    console.log("Logged out");
  };

  return <Dashboard onLogout={handleLogout} />;
}

export default App;
