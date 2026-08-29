import React, { useEffect, useState } from 'react';
import './Dashboard.css';
import { saveAs } from 'file-saver';

const StudentList = ({ onBack }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBySurname, setSortBySurname] = useState(false);

  useEffect(() => {
    fetch('http://localhost:5500/api/students') // Backend runs on 5500
      .then(res => res.json())
      .then(data => {
        setStudents(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch students');
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    try {
      const res = await fetch(`http://localhost:5500/api/students/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setStudents(students.filter(s => s._id !== id));
      } else {
        alert('Failed to delete student.');
      }
    } catch (err) {
      alert('Failed to delete student.');
    }
  };

  const handleSortBySurname = () => {
    setSortBySurname(s => !s);
  };

  const filteredStudents = students
    .filter(student => {
      const fullName = `${student.firstname || ''} ${student.middlename || ''} ${student.surname || ''}`.toLowerCase();
      return fullName.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      if (!sortBySurname) return 0;
      const aSurname = (a.surname || '').toLowerCase();
      const bSurname = (b.surname || '').toLowerCase();
      if (aSurname < bSurname) return -1;
      if (aSurname > bSurname) return 1;
      return 0;
    });

  const exportToCSV = () => {
    const headers = [
      'First Name', 'Middle Name', 'Surname', 'Suffix', 'Date of Birth', 'Phone Number', 'Home Address', 'Sex at Birth', 'Civil Status', 'Student Type'
    ];
    const rows = filteredStudents.map(student => [
      student.firstname || '',
      student.middlename || '',
      student.surname || '',
      student.suffix || '',
      student.dateofbirth || '',
      student.phonenumber || '',
      student.homeaddress || '',
      student.sexatbirth || '',
      student.civilstatus || '',
      student.studenttype || ''
    ]);
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(field => '"' + String(field).replace(/"/g, '""') + '"').join(',') + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `students_export_${new Date().toISOString().slice(0,10)}.csv`);
  };

  return (
    <div className="dashboard-section">
      <h2>Student List</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button className="dashboard-logout" onClick={onBack} style={{marginRight: 0}}>Back to Dashboard</button>
        <button className="dashboard-logout" style={{background:'rgb(0, 102, 0)',color:'#fff',padding:'10px 18px',borderRadius:'5px',fontWeight:'bold',fontSize:'1rem'}} onClick={exportToCSV}>
          Export to CSV
        </button>
        <button className="dashboard-logout" style={{background:'#1976d2',color:'#fff',padding:'10px 18px',borderRadius:'5px',fontWeight:'bold',fontSize:'1rem'}} onClick={handleSortBySurname}>
          {sortBySurname ? 'Unsort Surname' : 'Sort by Surname'}
        </button>
      </div>
      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%',
          maxWidth: 400,
          marginBottom: 20,
          padding: '10px 14px',
          borderRadius: 8,
          border: '1.5px solid rgb(0, 102, 0)',
          fontSize: '1.05rem',
          fontFamily: 'Montserrat, Arial, sans-serif',
          outline: 'none',
        }}
      />
      {loading && <p>Loading students...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && filteredStudents.length > 0 && (
        <table className="student-table">
          <thead>
            <tr>
              <th>First Name</th>
              <th>Middle Name</th>
              <th>Surname</th>
              <th>Suffix</th>
              <th>Date of Birth</th>
              <th>Phone Number</th>
              <th>Home Address</th>
              <th>Sex at Birth</th>
              <th>Civil Status</th>
              <th>Student Type</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student, idx) => (
              <tr key={student._id || idx}>
                <td>{student.firstname || ''}</td>
                <td>{student.middlename || ''}</td>
                <td>{student.surname || ''}</td>
                <td>{student.suffix || ''}</td>
                <td>{student.dateofbirth || ''}</td>
                <td>{student.phonenumber || ''}</td>
                <td>{student.homeaddress || ''}</td>
                <td>{student.sexatbirth || ''}</td>
                <td>{student.civilstatus || ''}</td>
                <td>{student.studenttype || ''}</td>
                <td>
                  <button className="dashboard-logout" style={{background:'#d32f2f',color:'#fff',padding:'6px 14px',borderRadius:'5px',fontWeight:'bold',fontSize:'0.98rem'}} onClick={() => handleDelete(student._id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && !error && filteredStudents.length === 0 && <p>No students found.</p>}
    </div>
  );
};

export default StudentList;
