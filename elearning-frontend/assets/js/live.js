document.addEventListener('DOMContentLoaded', () => {
  const scheduleForm = document.getElementById('scheduleForm');
  const joinForm = document.getElementById('joinForm');
  const shareForm = document.getElementById('shareForm');
  const refreshBtn = document.getElementById('refreshAnalytics');
  const analyticsOutput = document.getElementById('analyticsOutput');
  const token = localStorage.getItem('userToken');

  scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('lectureTitle').value.trim();
    const time = document.getElementById('lectureTime').value;
    try {
      const res = await fetch('http://localhost:5000/api/lectures/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, time })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to schedule');
      alert(`Lecture scheduled with ID ${data.id}`);
    } catch (err) {
      alert(err.message);
    }
  });

  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('lectureId').value;
    try {
      const res = await fetch(`http://localhost:5000/api/lectures/${id}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to join');
      alert('Joined lecture.');
    } catch (err) {
      alert(err.message);
    }
  });

  shareForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('shareLectureId').value;
    try {
      const res = await fetch(`http://localhost:5000/api/lectures/${id}/share-screen`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to share screen');
      alert('Screen sharing started.');
    } catch (err) {
      alert(err.message);
    }
  });

  refreshBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('http://localhost:5000/api/analytics/lectures', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch analytics');
      analyticsOutput.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      alert(err.message);
    }
  });

  const logout = document.getElementById('logout');
  if (logout) {
    logout.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('http://localhost:5000/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (_) {
        // ignore errors
      }
      localStorage.removeItem('userToken');
      localStorage.removeItem('userInfo');
      window.location.href = 'login.html';
    });
  }
});
