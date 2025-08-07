document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('userToken');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const classSelect = document.getElementById('classSelect');
  const createSection = document.querySelector('.create-assignment');
  const assignmentList = document.getElementById('assignmentList');
  const submitModal = document.getElementById('submitModal');
  const submitFile = document.getElementById('submitFile');
  const submitFileBtn = document.getElementById('submitFileBtn');
  const modalClose = submitModal.querySelector('.close');
  const assnTitle = document.getElementById('assnTitle');
  const assnDesc = document.getElementById('assnDesc');
  const assnDue = document.getElementById('assnDue');
  const assnResource = document.getElementById('assnResource');
  const createBtn = document.getElementById('createAssnBtn');
  let currentAssignment = null;
  let currentClass = null;
  let isInstructor = false;

  // load class list
  fetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` }})
    .then(r => r.json())
    .then(data => {
      data.forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls.class_id;
        opt.textContent = cls.title;
        classSelect.appendChild(opt);
      });
    });

  classSelect.addEventListener('change', () => {
    currentClass = classSelect.value;
    loadAssignments();
  });

  async function loadAssignments() {
    assignmentList.innerHTML = '';
    if (!currentClass) return;
    const res = await fetch(`/api/assignments/class/${currentClass}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) {
      assignmentList.textContent = data.message || 'Failed to load assignments';
      return;
    }
    isInstructor = data.is_instructor;
    createSection.style.display = isInstructor ? 'block' : 'none';
    data.assignments.forEach(a => renderAssignment(a));
  }

  function renderAssignment(a) {
    const card = document.createElement('div');
    card.className = 'assignment-card';
    card.innerHTML = `
      <h4>${a.title}</h4>
      <p>${a.description || ''}</p>
      <p class="due">Due: ${a.due_date || 'N/A'}</p>
    `;

    if (a.resource_url) {
      const resLink = document.createElement('a');
      resLink.href = a.resource_url;
      resLink.textContent = 'Resource';
      resLink.target = '_blank';
      card.appendChild(resLink);
    }

    const now = new Date();
    const due = a.due_date ? new Date(a.due_date) : null;

    if (isInstructor) {
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => editAssignment(a));
      const subsBtn = document.createElement('button');
      subsBtn.textContent = 'Submissions';
      subsBtn.addEventListener('click', () => toggleSubmissions(a.assignment_id, card));
      card.appendChild(editBtn);
      card.appendChild(subsBtn);
    } else {
      if (a.score !== null) {
        const grade = document.createElement('p');
        grade.className = 'grade';
        grade.textContent = `Score: ${a.score}${a.feedback ? ' - ' + a.feedback : ''}`;
        card.appendChild(grade);
      }
      if (!due || due >= now) {
        const submitBtn = document.createElement('button');
        submitBtn.textContent = a.submission_id ? 'Resubmit' : 'Submit';
        submitBtn.addEventListener('click', () => {
          currentAssignment = a.assignment_id;
          submitModal.classList.add('active');
        });
        card.appendChild(submitBtn);
      } else {
        const closed = document.createElement('p');
        closed.className = 'closed';
        closed.textContent = 'Submission closed';
        card.appendChild(closed);
      }
    }
    assignmentList.appendChild(card);
  }

  // create assignment
  createBtn.addEventListener('click', () => {
    if (!currentClass) return;
    const body = {
      title: assnTitle.value,
      description: assnDesc.value,
      due_date: assnDue.value
    };
    const file = assnResource.files[0];
    const send = async (payload) => {
      const res = await fetch(`/api/assignments/class/${currentClass}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to create assignment');
        return;
      }
      assnTitle.value = '';
      assnDesc.value = '';
      assnDue.value = '';
      assnResource.value = '';
      loadAssignments();
    };
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        body.resourceName = file.name;
        body.resourceData = reader.result.split(',')[1];
        send(body);
      };
      reader.readAsDataURL(file);
    } else {
      send(body);
    }
  });

  // edit assignment
  async function editAssignment(a) {
    const title = prompt('Title', a.title);
    if (title === null) return;
    const description = prompt('Description', a.description || '');
    if (description === null) return;
    const due = prompt('Due Date (YYYY-MM-DD)', a.due_date || '');
    const res = await fetch(`/api/assignments/${a.assignment_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, description, due_date: due })
    });
    const data = await res.json();
    if (!res.ok) alert(data.message || 'Update failed');
    loadAssignments();
  }

  // handle submissions view
  async function toggleSubmissions(assignmentId, card) {
    let existing = card.querySelector('.submissions');
    if (existing) {
      existing.remove();
      return;
    }
    const container = document.createElement('div');
    container.className = 'submissions';
    container.textContent = 'Loading...';
    card.appendChild(container);
    const res = await fetch(`/api/assignments/${assignmentId}/submissions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) {
      container.textContent = data.message || 'Failed to load submissions';
      return;
    }
    container.innerHTML = '';
    if (data.length === 0) {
      container.textContent = 'No submissions yet.';
      return;
    }
    data.forEach(sub => {
      const row = document.createElement('div');
      row.className = 'submission-row';
      const name = document.createElement('span');
      name.textContent = sub.name;
      const link = document.createElement('a');
      link.href = sub.file_url;
      link.textContent = 'Download';
      link.target = '_blank';
      const scoreInput = document.createElement('input');
      scoreInput.type = 'number';
      scoreInput.placeholder = 'Score';
      if (sub.score !== null) scoreInput.value = sub.score;
      const fbInput = document.createElement('input');
      fbInput.type = 'text';
      fbInput.placeholder = 'Feedback';
      if (sub.feedback) fbInput.value = sub.feedback;
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', () => gradeSubmission(sub.submission_id, scoreInput.value, fbInput.value));
      row.appendChild(name);
      row.appendChild(link);
      row.appendChild(scoreInput);
      row.appendChild(fbInput);
      row.appendChild(saveBtn);
      container.appendChild(row);
    });
  }

  async function gradeSubmission(id, score, feedback) {
    const res = await fetch(`/api/assignments/submissions/${id}/grade`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ score, feedback })
    });
    const data = await res.json();
    if (!res.ok) alert(data.message || 'Failed to save grade');
  }

  // submit assignment
  submitFileBtn.addEventListener('click', () => {
    const file = submitFile.files[0];
    if (!file || !currentAssignment) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const res = await fetch(`/api/assignments/${currentAssignment}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileName: file.name, fileData: base64 })
      });
      const data = await res.json();
      if (!res.ok) alert(data.message || 'Submission failed');
      submitModal.classList.remove('active');
      submitFile.value = '';
      loadAssignments();
    };
    reader.readAsDataURL(file);
  });

  modalClose.addEventListener('click', () => {
    submitModal.classList.remove('active');
  });

  // logout handling
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
