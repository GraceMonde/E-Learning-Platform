document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('userToken');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const courseSelect = document.getElementById('courseSelect');
  const announceSection = document.querySelector('.announce-section');
  const threadSection = document.querySelector('.thread-section');
  const notifSection = document.querySelector('.notification-section');
  const announcementsList = document.getElementById('announcementsList');
  const threadsList = document.getElementById('threadsList');
  const notificationList = document.getElementById('notificationList');
  let currentClassId = '';

  async function loadCourses() {
    try {
      const res = await fetch('/api/classes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      data.forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls.class_id;
        opt.textContent = cls.title;
        courseSelect.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
    }
  }

  courseSelect.addEventListener('change', () => {
    currentClassId = courseSelect.value;
    if (!currentClassId) {
      announceSection.style.display = 'none';
      threadSection.style.display = 'none';
      return;
    }
    announceSection.style.display = 'block';
    threadSection.style.display = 'block';
    loadAnnouncements();
    loadThreads();
  });

  async function loadAnnouncements() {
    announcementsList.innerHTML = '';
    try {
      const res = await fetch(`/api/announcements/class/${currentClassId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      data.forEach(a => {
        const div = document.createElement('div');
        div.className = 'announcement';
        div.textContent = a.message;
        announcementsList.appendChild(div);
      });
    } catch (err) {
      console.error(err);
    }
  }

  document.getElementById('announceForm').addEventListener('submit', async e => {
    e.preventDefault();
    const message = document.getElementById('announceMessage').value.trim();
    if (!message) return;
    try {
      const res = await fetch(`/api/announcements/class/${currentClassId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
      });
      if (res.ok) {
        document.getElementById('announceMessage').value = '';
        loadAnnouncements();
      }
    } catch (err) {
      console.error(err);
    }
  });

  async function loadThreads() {
    threadsList.innerHTML = '';
    try {
      const res = await fetch(`/api/threads/class/${currentClassId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      data.forEach(t => createThreadElement(t));
    } catch (err) {
      console.error(err);
    }
  }

  function createThreadElement(thread) {
    const div = document.createElement('div');
    div.className = 'thread';
    div.innerHTML = `<strong>${thread.title}</strong><p>${thread.content}</p>`;
    const commentsContainer = document.createElement('div');
    div.appendChild(commentsContainer);
    loadComments(thread.thread_id, commentsContainer);

    const form = document.createElement('form');
    form.innerHTML = `<input type="text" class="comment-input" placeholder="Add comment"><button type="submit">Post</button>`;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const input = form.querySelector('input');
      const content = input.value.trim();
      if (!content) return;
      try {
        const res = await fetch(`/api/threads/${thread.thread_id}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content })
        });
        if (res.ok) {
          input.value = '';
          loadComments(thread.thread_id, commentsContainer);
        }
      } catch (err) {
        console.error(err);
      }
    });
    div.appendChild(form);
    threadsList.appendChild(div);
  }

  async function loadComments(threadId, container) {
    container.innerHTML = '';
    try {
      const res = await fetch(`/api/threads/${threadId}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      data.forEach(c => {
        const p = document.createElement('div');
        p.className = 'comment';
        p.textContent = `${c.name}: ${c.content}`;
        container.appendChild(p);
      });
    } catch (err) {
      console.error(err);
    }
  }

  document.getElementById('threadForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('threadTitle').value.trim();
    const content = document.getElementById('threadContent').value.trim();
    if (!title || !content) return;
    try {
      const res = await fetch(`/api/threads/class/${currentClassId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, content })
      });
      if (res.ok) {
        document.getElementById('threadTitle').value = '';
        document.getElementById('threadContent').value = '';
        loadThreads();
      }
    } catch (err) {
      console.error(err);
    }
  });

  async function loadNotifications() {
    notificationList.innerHTML = '';
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      data.forEach(n => {
        const div = document.createElement('div');
        div.className = 'notification';
        div.textContent = n.message;
        notificationList.appendChild(div);
      });
      notifSection.style.display = 'block';
    } catch (err) {
      console.error(err);
    }
  }

  loadCourses();
  loadNotifications();

  const logout = document.getElementById('logout');
  if (logout) {
    logout.addEventListener('click', async e => {
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
