const express = require('express');
const router = express.Router();
const db = require('../config/db');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// List materials for a class with optional folder filter
router.get('/class/:classId', (req, res) => {
  const classId = req.params.classId;
  const { folder } = req.query;
  let sql = 'SELECT * FROM materials WHERE class_id = ?';
  const params = [classId];
  if (folder) {
    sql += ' AND folder = ?';
    params.push(folder);
  }
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json(results);
  });
});

// Upload new material
router.post('/class/:classId', (req, res) => {
  const classId = req.params.classId;
  const { title, tags, folder, uploaded_by, fileName, fileData } = req.body;
  if (!fileName || !fileData) {
    return res.status(400).json({ message: 'File data is required' });
  }
  const buffer = Buffer.from(fileData, 'base64');
  const storedName = `${Date.now()}-${fileName}`;
  const filePath = path.join(uploadDir, storedName);
  fs.writeFile(filePath, buffer, (err) => {
    if (err) return res.status(500).json({ message: 'File save error', error: err });
    const fileUrl = `/uploads/${storedName}`;
    const sql = 'INSERT INTO materials (class_id, title, file_url, folder, tags, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [classId, title, fileUrl, folder, tags, uploaded_by], (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error', error: err });
      res.json({ material_id: result.insertId, file_url: fileUrl });
    });
  });
});

// Update material metadata
router.put('/:materialId', (req, res) => {
  const materialId = req.params.materialId;
  const { title, tags, folder, fileName, fileData } = req.body;
  const params = [title, tags, folder];
  let sql = 'UPDATE materials SET title = ?, tags = ?, folder = ?';
  if (fileName && fileData) {
    const buffer = Buffer.from(fileData, 'base64');
    const storedName = `${Date.now()}-${fileName}`;
    const filePath = path.join(uploadDir, storedName);
    fs.writeFileSync(filePath, buffer);
    sql += ', file_url = ?';
    params.push(`/uploads/${storedName}`);
  }
  sql += ' WHERE material_id = ?';
  params.push(materialId);
  db.query(sql, params, (err) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    res.json({ message: 'Material updated' });
  });
});

// Delete material
router.delete('/:materialId', (req, res) => {
  const materialId = req.params.materialId;
  db.query('SELECT file_url FROM materials WHERE material_id = ?', [materialId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err });
    if (results.length === 0) return res.status(404).json({ message: 'Material not found' });
    const fileUrl = results[0].file_url;
    const filePath = path.join(__dirname, '..', fileUrl);
    fs.unlink(filePath, () => { /* ignore errors */ });
    db.query('DELETE FROM materials WHERE material_id = ?', [materialId], (err2) => {
      if (err2) return res.status(500).json({ message: 'Database error', error: err2 });
      res.json({ message: 'Material deleted' });
    });
  });
});

module.exports = router;
