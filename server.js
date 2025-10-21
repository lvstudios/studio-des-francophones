// server.js
// Node 16+
// npm i express node-fetch@2
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const STUDIO_ID = '35787684'; // ton studio
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const PROJECTS_JSON = path.join(PUBLIC_DIR, 'projects.json');

const app = express();
app.use(express.static(PUBLIC_DIR));

/**
 * Récupère tous les projets d'un studio en paginant l'endpoint.
 * Endpoint public: https://api.scratch.mit.edu/studios/{studio_id}/projects?offset={offset}
 */
async function fetchAllStudioProjects() {
  let all = [];
  let offset = 0;
  const limitStep = 20; // l'API renvoie un batch (utilise offset)
  while (true) {
    const url = `https://api.scratch.mit.edu/studios/${STUDIO_ID}/projects?offset=${offset}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'StudioFetcher/1.0' }});
    if (!res.ok) throw new Error(`Erreur API Scratch: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all = all.concat(data);
    offset += data.length;
    // sécurité : couper si trop grand (optionnel)
    if (offset > 2000) break;
  }
  return all;
}

/**
 * Met à jour public/projects.json avec les infos minimales nécessaires
 * pour le frontend (id, title, author, galleryImage, url).
 */
async function updateProjectsFile() {
  try {
    console.log('Récupération projets studio...');
    const projects = await fetchAllStudioProjects();
    const minimal = projects.map(p => ({
      id: p.id,
      title: p.title,
      author: (p.author && p.author.username) || (p.author || 'unknown'),
      thumbnail: p.image || p.thumbnail || null,
      url: `https://scratch.mit.edu/projects/${p.id}/`
    }));
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    fs.writeFileSync(PROJECTS_JSON, JSON.stringify(minimal, null, 2), 'utf8');
    console.log(`Mis à jour: ${minimal.length} projets écrits dans public/projects.json`);
    return minimal.length;
  } catch (err) {
    console.error('Erreur updateProjectsFile:', err);
    throw err;
  }
}

// Route manuelle pour forcer la mise à jour (ex: appel via webhook ou navigateur)
app.get('/update-studio', async (req, res) => {
  try {
    const count = await updateProjectsFile();
    res.json({ ok: true, projects: count });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// route santé
app.get('/health', (req, res) => res.send('ok'));

// démarrage
app.listen(PORT, async () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  // première mise à jour lors du démarrage
  try { await updateProjectsFile(); } catch(e){ console.warn('Première mise à jour échouée'); }
});
