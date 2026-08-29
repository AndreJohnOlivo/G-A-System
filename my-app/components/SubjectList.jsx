import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const SubjectList = ({ onBack }) => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ course: '', year: '', semester: '', code: '', title: '', units: '' });
  const [formMsg, setFormMsg] = useState('');

  useEffect(() => {
    async function fetchSubjects() {
      try {
        const res = await fetch('/api/subjects');
        const data = await res.json();
        console.log('Initial subjects:', data); // Debug log
        setSubjects(data);
      } catch (err) {
        setError('Failed to fetch subjects');
      } finally {
        setLoading(false);
      }
    }
    fetchSubjects();
  }, []);

  // Debug: log subjects before grouping
  console.log('Subjects before grouping:', subjects);
  // Group by course, year, semester, using fallback labels for missing fields and trimming whitespace
  const grouped = {};
  subjects.forEach(subj => {
    const course = subj.course && subj.course.trim() ? subj.course.trim() : 'Unknown Course';
    const year = subj.year && subj.year.trim() ? subj.year.trim() : 'Unknown Year';
    const semester = subj.semester && subj.semester.trim() ? subj.semester.trim() : 'Unknown Semester';
    if (!grouped[course]) grouped[course] = {};
    if (!grouped[course][year]) grouped[course][year] = {};
    if (!grouped[course][year][semester]) grouped[course][year][semester] = [];
    grouped[course][year][semester].push({
      ...subj,
      code: subj.code ? subj.code.trim() : '',
      title: subj.title ? subj.title.trim() : '',
      units: subj.units ? subj.units.trim() : ''
    });
  });
  // Debug: log grouped subjects
  console.log('Grouped subjects:', grouped);

  const handleFormChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async e => {
    e.preventDefault();
    setFormMsg('');
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        // Try to parse error details from backend
        let errMsg = 'Failed to add subject';
        try {
          const errData = await res.json();
          if (errData && errData.error) errMsg = errData.error + (errData.details ? `: ${errData.details}` : '');
        } catch {}
        throw new Error(errMsg);
      }
      setFormMsg('Subject added!');
      setForm({ course: '', year: '', semester: '', code: '', title: '', units: '' });
      setShowForm(false);
      // Refresh subject list
      const updated = await fetch('/api/subjects').then(r => r.json());
      console.log('Fetched subjects after add:', updated); // Debug log
      setSubjects(updated);
    } catch (err) {
      setFormMsg('Error: ' + err.message);
      // Optionally log error for debugging
      console.error('Add subject error:', err);
    }
  };

  return (
    <div className="dashboard-section">
      <h2>Subjects per Course</h2>
      <button className="dashboard-logout" onClick={onBack} style={{marginBottom: 20}}>Back to Dashboard</button>
      <button onClick={() => setShowForm(f => !f)} style={{marginBottom: 20}}>
        {showForm ? 'Cancel' : 'Add Subject'}
      </button>
      {showForm && (
        <form onSubmit={handleFormSubmit} style={{marginBottom: 20, background: '#f5f5f5', padding: 16, borderRadius: 8, maxWidth: 500}}>
          <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
            <input name="course" value={form.course} onChange={handleFormChange} placeholder="Course (e.g. BSCS)" required style={{flex: 1}} />
            <input name="year" value={form.year} onChange={handleFormChange} placeholder="Year (e.g. First Year)" required style={{flex: 1}} />
            <input name="semester" value={form.semester} onChange={handleFormChange} placeholder="Semester (e.g. 1st Semester)" required style={{flex: 1}} />
          </div>
          <div style={{display: 'flex', gap: 8, marginTop: 8}}>
            <input name="code" value={form.code} onChange={handleFormChange} placeholder="Code" required style={{flex: 1}} />
            <input name="title" value={form.title} onChange={handleFormChange} placeholder="Title" required style={{flex: 2}} />
            <input name="units" value={form.units} onChange={handleFormChange} placeholder="Units" style={{flex: 1}} />
          </div>
          <button type="submit" style={{marginTop: 10}}>Save Subject</button>
          {formMsg && <div style={{color: formMsg.startsWith('Error') ? 'red' : 'green', marginTop: 8}}>{formMsg}</div>}
        </form>
      )}
      {loading && <p>Loading subjects...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && subjects.length > 0 && (
        <div style={{ width: '100%', maxWidth: 900 }}>
          {Object.entries(grouped).map(([course, years]) => (
            <div key={course} style={{ marginBottom: 32 }}>
              <h3 style={{ color: '#1976d2', marginBottom: 10 }}>{course}</h3>
              {Object.entries(years).map(([year, semesters]) => (
                <div key={year} style={{ marginLeft: 16, marginBottom: 16 }}>
                  <strong>{year}</strong>
                  {Object.entries(semesters).map(([semester, subs]) => (
                    <div key={semester} style={{ marginLeft: 16, marginBottom: 8 }}>
                      <em>{semester}</em>
                      <ul>
                        {subs.map((subj, i) => (
                          <li key={i}>{subj.code} - {subj.title} {subj.units ? `(${subj.units} units)` : ''}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SubjectList;
