// Handle join and create class actions

document.addEventListener('DOMContentLoaded', () => {
  const joinBtn = document.getElementById('openJoin');
  const createBtn = document.getElementById('openCreate');
  const materialsBtn = document.getElementById('openMaterials');
  const joinModal = document.getElementById('joinModal');
  const createModal = document.getElementById('createModal');
  const closeButtons = document.querySelectorAll('.close');

  // Open modals
  joinBtn.addEventListener('click', () => joinModal.classList.add('active'));
  createBtn.addEventListener('click', () => createModal.classList.add('active'));
  materialsBtn.addEventListener('click', () => {
    window.location.href = 'materials.html?classId=1';
  });

  // Close modals
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-close');
      document.getElementById(id).classList.remove('active');
    });
  });

  // Join class form
  document.getElementById('joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('classCode').value.trim();
    const token = localStorage.getItem('userToken');
    if (!token) {
      alert('You must be logged in to join a class.');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/classes/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ invite_code: code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to join class');
      alert('Request to join class sent successfully.');
      window.location.href = 'dashboard.html';
    } catch (err) {
      alert(err.message);
    }
  });

  // Create class form
  document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('classTitle').value.trim();
    const description = document.getElementById('classDescription').value.trim();
    const token = localStorage.getItem('userToken');
    if (!token) {
      alert('You must be logged in to create a class.');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, description })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create class');
      alert('Class created successfully.');
      window.location.href = 'dashboard.html';
    } catch (err) {
      alert(err.message);
    }
  });
});
