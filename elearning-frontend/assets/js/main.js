document.addEventListener('DOMContentLoaded', () => {
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

  const container = document.getElementById('classesContainer');
  const annContainer = document.getElementById('announcementsContainer');
  const tasksContainer = document.getElementById('tasksContainer');
  const modal = document.getElementById('classModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalDescription = document.getElementById('modalDescription');
  const modalSave = document.getElementById('modalSave');
  const modalClose = document.querySelector('#classModal .close');
  let editingClassId = null;

  modalClose.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modalSave.addEventListener('click', async () => {
    if (!editingClassId) return;
    try {
      const res = await fetch(`/api/classes/${editingClassId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: modalTitle.value,
          description: modalDescription.value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update class');
      const card = document.querySelector(`.class-card[data-id="${editingClassId}"]`);
      card.querySelector('h4').textContent = modalTitle.value;
      card.querySelector('p.description').textContent = modalDescription.value;
      modal.classList.remove('active');
    } catch (err) {
      alert(err.message);
    }
  });

  async function loadClasses() {
    container.innerHTML = '';
    try {
      const res = await fetch('/api/classes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load classes');

      if (data.length === 0) {
        const div = document.createElement('div');
        div.textContent = 'No classes found.';
        container.appendChild(div);
      } else {
        data.forEach(cls => createClassCard(cls));
      }

      loadAnnouncements(data);
      loadUpcomingTasks(data);
    } catch (err) {
      const div = document.createElement('div');
      div.textContent = err.message === 'Failed to fetch'
        ? 'Unable to connect to the server.'
        : err.message;
      container.appendChild(div);
      if (annContainer) annContainer.textContent = err.message;
      if (tasksContainer) tasksContainer.textContent = err.message;
    }
  }

  async function loadAnnouncements(classes) {
    if (!annContainer) return;
    annContainer.textContent = '';
    const items = [];
    for (const cls of classes) {
      try {
        const res = await fetch(`/api/announcements/class/${cls.class_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          data.forEach(a => items.push({
            classTitle: cls.title,
            message: a.message,
            posted_at: a.posted_at
          }));
        }
      } catch (_) {
        /* ignore individual class errors */
      }
    }
    if (items.length === 0) {
      annContainer.textContent = 'No announcements.';
      return;
    }
    items.sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at));
    items.slice(0, 5).forEach(item => {
      const p = document.createElement('p');
      p.innerHTML = `<strong>${item.classTitle}:</strong> ${item.message}`;
      annContainer.appendChild(p);
    });
  }

  async function loadUpcomingTasks(classes) {
    if (!tasksContainer) return;
    tasksContainer.textContent = '';
    const items = [];
    const now = new Date();
    for (const cls of classes) {
      try {
        const res = await fetch(`/api/assignments/class/${cls.class_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.assignments)) {
          data.assignments.forEach(a => {
            if (a.due_date) {
              const due = new Date(a.due_date);
              if (due >= now) {
                items.push({
                  classTitle: cls.title,
                  title: a.title,
                  due_date: a.due_date
                });
              }
            }
          });
        }
      } catch (_) {
        /* ignore individual class errors */
      }
    }
    if (items.length === 0) {
      tasksContainer.textContent = 'No upcoming tasks.';
      return;
    }
    items.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    items.slice(0, 5).forEach(item => {
      const p = document.createElement('p');
      const date = new Date(item.due_date).toLocaleDateString();
      p.innerHTML = `<strong>${item.classTitle}:</strong> ${item.title} - ${date}`;
      tasksContainer.appendChild(p);
    });
  }

  function createClassCard(cls) {
    const card = document.createElement('div');
    card.className = 'class-card';
    card.dataset.id = cls.class_id;
    card.innerHTML = `
      <h4>${cls.title}</h4>
      <p class="description">${cls.description || ''}</p>
      <p class="invite">Code: ${cls.invite_code}</p>
    `;

    if (cls.is_instructor) {
      const actions = document.createElement('div');
      actions.className = 'class-actions';
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.classList.add('edit-btn');
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.classList.add('delete-btn');
      const requestsBtn = document.createElement('button');
      requestsBtn.textContent = 'Requests';
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      actions.appendChild(requestsBtn);
      card.appendChild(actions);

      editBtn.addEventListener('click', () => {
        editingClassId = cls.class_id;
        modalTitle.value = cls.title;
        modalDescription.value = cls.description || '';
        modal.classList.add('active');
      });

      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete this class?')) return;
        try {
          const res = await fetch(`/api/classes/${cls.class_id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Failed to delete class');
          card.remove();
        } catch (err) {
          alert(err.message);
        }
      });

      requestsBtn.addEventListener('click', () => toggleRequests(cls.class_id, card));
    }

    container.appendChild(card);
  }

  async function toggleRequests(classId, card) {
    let existing = card.querySelector('.request-container');
    if (existing) {
      existing.remove();
      return;
    }

    const reqContainer = document.createElement('div');
    reqContainer.className = 'request-container';
    card.appendChild(reqContainer);

    try {
      const res = await fetch(`/api/classes/${classId}/enrollments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load requests');
      reqContainer.textContent = '';
      if (data.length === 0) {
        reqContainer.textContent = 'No pending requests.';
      } else {
        data.forEach(req => {
          const row = document.createElement('div');
          row.className = 'request-row';
          const name = document.createElement('span');
          name.textContent = req.name;
          const approve = document.createElement('button');
          approve.textContent = 'Approve';
          approve.classList.add('approve-btn');
          const reject = document.createElement('button');
          reject.textContent = 'Reject';
          reject.classList.add('reject-btn');
          row.appendChild(name);
          row.appendChild(approve);
          row.appendChild(reject);
          reqContainer.appendChild(row);

          approve.addEventListener('click', () => handleEnrollment(classId, req.enrollment_id, 'approved', row));
          reject.addEventListener('click', () => handleEnrollment(classId, req.enrollment_id, 'rejected', row));
        });
      }
    } catch (err) {
      reqContainer.textContent = err.message;
    }
  }

  async function handleEnrollment(classId, enrollmentId, status, row) {
    try {
      const res = await fetch(`/api/classes/${classId}/enrollments/${enrollmentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update enrollment');
      row.remove();
    } catch (err) {
      alert(err.message);
    }
  }

  loadClasses();

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

