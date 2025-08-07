document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('userToken');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const profileForm = document.getElementById('profileForm');
  const passwordForm = document.getElementById('passwordForm');
  const profileMsg = document.getElementById('profileMsg');
  const passwordMsg = document.getElementById('passwordMsg');

  // Load profile info
  fetch('http://localhost:5000/api/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => {
      if (data.name) nameInput.value = data.name;
      if (data.email) emailInput.value = data.email;
    })
    .catch(() => {
      profileMsg.textContent = 'Failed to load profile.';
    });

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    profileMsg.textContent = '';
    try {
      const res = await fetch('http://localhost:5000/api/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: nameInput.value.trim(),
          email: emailInput.value.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      profileMsg.textContent = 'Profile updated successfully.';
      const info = JSON.parse(localStorage.getItem('userInfo') || '{}');
      info.name = nameInput.value.trim();
      info.email = emailInput.value.trim();
      localStorage.setItem('userInfo', JSON.stringify(info));
    } catch (err) {
      profileMsg.textContent = err.message;
    }
  });

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    passwordMsg.textContent = '';
    try {
      const res = await fetch('http://localhost:5000/api/profile/password', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: document.getElementById('currentPassword').value,
          newPassword: document.getElementById('newPassword').value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Password change failed');
      passwordMsg.textContent = 'Password changed successfully.';
      passwordForm.reset();
    } catch (err) {
      passwordMsg.textContent = err.message;
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
      } catch (err) {
        // ignore errors
      }
      localStorage.removeItem('userToken');
      localStorage.removeItem('userInfo');
      window.location.href = 'login.html';
    });
  }
});
