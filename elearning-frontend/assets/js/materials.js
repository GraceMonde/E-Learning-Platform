document.addEventListener('DOMContentLoaded', () => {
  const classId = new URLSearchParams(window.location.search).get('classId') || 1;
  const uploadForm = document.getElementById('uploadForm');
  const materialsContainer = document.getElementById('materialsContainer');

  async function loadMaterials() {
    materialsContainer.innerHTML = '';
    try {
      const res = await fetch(`http://localhost:5000/api/materials/class/${classId}`);
      const data = await res.json();
      const grouped = {};
      data.forEach(m => {
        const folder = m.folder || 'General';
        if (!grouped[folder]) grouped[folder] = [];
        grouped[folder].push(m);
      });
      Object.keys(grouped).forEach(folder => {
        const section = document.createElement('div');
        section.classList.add('folder-section');
        const h4 = document.createElement('h4');
        h4.textContent = folder;
        section.appendChild(h4);
        grouped[folder].forEach(mat => {
          const card = document.createElement('div');
          card.classList.add('material-card');

          const title = document.createElement('span');
          title.classList.add('material-title');
          title.textContent = mat.title;
          card.appendChild(title);

          if (mat.tags) {
            const tagsDiv = document.createElement('div');
            mat.tags.split(',').forEach(t => {
              const tag = document.createElement('span');
              tag.classList.add('tag');
              tag.textContent = t.trim();
              tagsDiv.appendChild(tag);
            });
            card.appendChild(tagsDiv);
          }

          const link = document.createElement('a');
          const url = mat.file_url.startsWith('http') ? mat.file_url : `http://localhost:5000${mat.file_url}`;
          link.href = url;
          link.textContent = 'Download';
          link.classList.add('download-link');
          card.appendChild(link);

          const actions = document.createElement('div');
          actions.classList.add('card-actions');
          const editBtn = document.createElement('button');
          editBtn.textContent = 'Edit';
          editBtn.addEventListener('click', () => editMaterial(mat));
          const delBtn = document.createElement('button');
          delBtn.textContent = 'Delete';
          delBtn.addEventListener('click', () => deleteMaterial(mat.material_id));
          actions.appendChild(editBtn);
          actions.appendChild(delBtn);
          card.appendChild(actions);

          section.appendChild(card);
        });
        materialsContainer.appendChild(section);
      });
    } catch (err) {
      materialsContainer.textContent = 'Failed to load materials.';
    }
  }

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file');
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const body = {
        title: uploadForm.title.value,
        folder: uploadForm.folder.value,
        tags: uploadForm.tags.value,
        uploaded_by: 1,
        fileName: file.name,
        fileData: base64
      };
      await fetch(`http://localhost:5000/api/materials/class/${classId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      uploadForm.reset();
      loadMaterials();
    };
    reader.readAsDataURL(file);
  });

  async function deleteMaterial(id) {
    if (!confirm('Delete this material?')) return;
    await fetch(`http://localhost:5000/api/materials/${id}`, { method: 'DELETE' });
    loadMaterials();
  }

  async function editMaterial(mat) {
    const newTitle = prompt('Title', mat.title);
    if (newTitle === null) return;
    const newFolder = prompt('Folder', mat.folder || '');
    if (newFolder === null) return;
    const newTags = prompt('Tags', mat.tags || '');
    if (newTags === null) return;
    await fetch(`http://localhost:5000/api/materials/${mat.material_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, folder: newFolder, tags: newTags })
    });
    loadMaterials();
  }

  loadMaterials();
});
