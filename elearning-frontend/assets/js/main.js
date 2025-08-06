document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('userToken');
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const welcome = document.getElementById('welcomeMessage');
  if (userInfo.name && welcome) {
    welcome.textContent = `Welcome, ${userInfo.name}!`;
  }

  // Redirect to login if no token
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const list = document.getElementById('classesList');
  try {
    const res = await fetch('http://localhost:5000/api/classes', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load classes');

    if (data.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No classes found.';
      list.appendChild(li);
    } else {
      data.forEach(cls => {
        const li = document.createElement('li');
        li.textContent = `${cls.title} (Code: ${cls.invite_code})`;
        list.appendChild(li);
      });
    }
  } catch (err) {
    const li = document.createElement('li');
    li.textContent = err.message;
    list.appendChild(li);
  }

  const logout = document.getElementById('logout');
  if (logout) {
    logout.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('userToken');
      localStorage.removeItem('userInfo');
      window.location.href = 'login.html';
    });
  }
});
