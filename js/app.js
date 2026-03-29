// app.js
// Main application logic, UI interactions, and state management

let currentLanguage = 'en';

// State
let state = {
  currentNoteId: null,
  activeView: 'editor', // 'editor' | 'list'
  searchValue: '',
  sortMode: 'chronological'
};

// UI Elements mapping
const UI = {
  views: {
    editor: document.getElementById('editor-view'),
    list: document.getElementById('list-view')
  },
  topBar: {
    backBtn: document.getElementById('btn-back-sermons'),
    newNoteBtn: document.getElementById('btn-new-note')
  },
  form: {
    title: document.getElementById('note-title'),
    speaker: document.getElementById('note-speaker'),
    date: document.getElementById('note-date'),
    mainScripture: document.getElementById('note-main-scripture'),
    series: document.getElementById('note-series'),
    content: document.getElementById('note-content')
  },
  search: document.getElementById('search-input'),
  notesContainer: document.getElementById('notes-container'),
  emptyState: document.getElementById('empty-state'),
  saveIndicator: document.getElementById('save-indicator'),
  appTitle: document.getElementById('app-title'),
  seriesBtn: document.getElementById('btn-add-series'),
  seriesWrapper: document.getElementById('series-input-wrapper'),
  scripturePreview: document.getElementById('scripture-preview'),
  scripturePreviewText: document.getElementById('scripture-preview-text'),
  scripturePreviewMeta: document.getElementById('scripture-preview-meta')
};

// --- Rich Text Editing ---
window.formatText = function(command) {
  document.execCommand(command, false, null);
  UI.form.content.focus();
};

UI.form.content.addEventListener('paste', function(e) {
  e.preventDefault();
  const text = (e.originalEvent || e).clipboardData.getData('text/plain');
  document.execCommand('insertText', false, text);
});

// Auto-capitalize specific deity words dynamically
const DEITY_WORDS = ["god", "jesus", "him", "lord"];
const DEITY_MAP = {
  "god": "God",
  "jesus": "Jesus",
  "him": "Him",
  "lord": "Lord"
};

UI.form.content.addEventListener('input', (e) => {
  // Auto-collapse metadata on any typing action
  const metaBody = document.getElementById('metadata-body');
  if (metaBody && !metaBody.classList.contains('collapsed')) {
    window.toggleMetadata();
  }

  if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') return;

  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  
  if (node.nodeType === Node.TEXT_NODE) {
    let text = node.nodeValue;
    let modified = false;
    
    DEITY_WORDS.forEach(word => {
      // Use strictly lowercase matching to avoid touching intentional SHOUTING "GOD"
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      const newText = text.replace(regex, DEITY_MAP[word]);
      if (newText !== text) {
        text = newText;
        modified = true;
      }
    });
    
    if (modified) {
      const cursorOffset = range.startOffset;
      node.nodeValue = text;
      // Exact string replacement length is identical, so we can perfectly restore the cursor offset
      sel.collapse(node, cursorOffset);
    }
  }
});

// --- Bible Fetching Engine ---
let lastFetchedReference = '';

async function fetchScripture(reference) {
  if (!reference || reference.trim() === '') {
    UI.scripturePreview.classList.add('hidden');
    UI.form.fetchedScriptureText = null;
    UI.form.fetchedScriptureMeta = null;
    lastFetchedReference = '';
    return;
  }
  
  if (reference === lastFetchedReference && !UI.scripturePreview.classList.contains('hidden')) {
    return; // Already fetched
  }
  
  UI.scripturePreview.classList.remove('hidden');
  UI.scripturePreview.classList.add('loading');
  UI.scripturePreviewText.textContent = 'Fetching scripture...';
  UI.scripturePreviewMeta.textContent = '';
  
  try {
    const response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`);
    if (!response.ok) throw new Error('Not found');
    const data = await response.json();
    
    // Standardize spacing cleanly and add quotes
    const cleanText = (data.text || '').replace(/\n+/g, ' ').trim();
    
    UI.scripturePreviewText.textContent = `"${cleanText}"`;
    UI.scripturePreviewMeta.textContent = data.translation_name;
    UI.scripturePreview.classList.remove('loading');
    
    UI.form.fetchedScriptureText = `"${cleanText}"`;
    UI.form.fetchedScriptureMeta = data.translation_name;
    lastFetchedReference = reference;
    
    if (typeof triggerAutoSave === 'function') triggerAutoSave();
  } catch (err) {
    UI.scripturePreviewText.textContent = 'Could not find scripture reference.';
    UI.scripturePreview.classList.remove('loading');
    UI.form.fetchedScriptureText = null;
    UI.form.fetchedScriptureMeta = null;
  }
}

// --- View Navigation ---
function switchView(viewName) {
  state.activeView = viewName;
  
  // Hide all views
  Object.values(UI.views).forEach(el => {
    el.classList.remove('active');
    setTimeout(() => el.classList.add('hidden'), 300); // Wait for fade out
  });
  
  // Show active view
  const activeEl = UI.views[viewName];
  activeEl.classList.remove('hidden');
  // Small delay to allow display:flex to apply before setting opacity
  setTimeout(() => activeEl.classList.add('active'), 10);
  
  if (viewName === 'list') {
    UI.appTitle.textContent = 'Sermons';
    UI.topBar.backBtn.style.display = 'none';
    UI.topBar.newNoteBtn.style.display = 'block';
    renderNotesList();
  } else if (viewName === 'editor') {
    UI.appTitle.textContent = state.currentNoteId ? 'Edit Note' : 'New Note';
    UI.topBar.backBtn.style.display = 'block';
    UI.topBar.newNoteBtn.style.display = 'none';
    if (typeof updateDynamicAutocompletes === 'function') updateDynamicAutocompletes();
  }
}

window.switchView = switchView;

// --- Metadata & Series Visibility ---
window.toggleMetadata = function() {
  const body = document.getElementById('metadata-body');
  const chevron = document.getElementById('metadata-chevron');
  body.classList.toggle('collapsed');
  
  if (body.classList.contains('collapsed')) {
    chevron.style.transform = 'rotate(180deg)';
  } else {
    chevron.style.transform = 'rotate(0deg)';
  }
};

window.toggleSeriesInput = function() {
  UI.seriesWrapper.classList.remove('hidden');
  UI.seriesBtn.style.display = 'none';
  UI.form.series.focus();
};

function updateSeriesVisibility() {
  if (UI.form.series.value.trim() !== '') {
    UI.seriesWrapper.classList.remove('hidden');
    UI.seriesBtn.style.display = 'none';
  } else {
    UI.seriesWrapper.classList.add('hidden');
    UI.seriesBtn.style.display = 'flex';
  }
}

// --- Note Data Management ---

function getEditorData() {
  return {
    id: state.currentNoteId,
    title: UI.form.title.value || 'Untitled Sermon',
    speaker: UI.form.speaker.value,
    date: UI.form.date.value || new Date().toISOString().split('T')[0],
    mainScripture: UI.form.mainScripture.value,
    series: UI.form.series.value,
    content: UI.form.content.innerHTML,
    fetchedScriptureText: UI.form.fetchedScriptureText || null,
    fetchedScriptureMeta: UI.form.fetchedScriptureMeta || null
  };
}

function loadNoteIntoEditor(id) {
  const note = Storage.getNoteById(id);
  if (!note) return;
  
  state.currentNoteId = note.id;
  UI.appTitle.textContent = 'Edit Note';
  
  UI.form.title.value = note.title === 'Untitled Sermon' ? '' : note.title;
  UI.form.speaker.value = note.speaker || '';
  UI.form.date.value = note.date || '';
  UI.form.mainScripture.value = note.mainScripture || '';
  UI.form.series.value = note.series || '';
  UI.form.content.innerHTML = note.content || '';
  
  UI.form.fetchedScriptureText = note.fetchedScriptureText || null;
  UI.form.fetchedScriptureMeta = note.fetchedScriptureMeta || null;
  lastFetchedReference = note.mainScripture || '';
  
  if (note.fetchedScriptureText && note.mainScripture) {
    UI.scripturePreviewText.textContent = note.fetchedScriptureText;
    UI.scripturePreviewMeta.textContent = note.fetchedScriptureMeta || '';
    UI.scripturePreview.classList.remove('hidden');
    UI.scripturePreview.classList.remove('loading');
  } else {
    UI.scripturePreview.classList.add('hidden');
  }
  
  updateSeriesVisibility();
}

window.createNewNote = function() {
  state.currentNoteId = null;
  UI.appTitle.textContent = 'New Note';
  
  // Clear forms
  UI.form.title.value = '';
  UI.form.speaker.value = '';
  UI.form.date.value = new Date().toISOString().split('T')[0];
  UI.form.mainScripture.value = '';
  UI.form.series.value = '';
  UI.form.content.innerHTML = '';
  UI.form.fetchedScriptureText = null;
  UI.form.fetchedScriptureMeta = null;
  lastFetchedReference = '';
  UI.scripturePreview.classList.add('hidden');
  updateSeriesVisibility();
  
  switchView('editor');
};

window.finalizeNote = function() {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  performSave();
  switchView('list');
};

window.deleteCurrentNote = async function() {
  if (!state.currentNoteId) {
    // Note hasn't even been auto-saved for the first time yet
    switchView('list');
    return;
  }
  
  if (confirm("Are you sure you want to completely delete this note? This cannot be undone.")) {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    await Storage.deleteNote(state.currentNoteId);
    state.currentNoteId = null;
    switchView('list');
  }
};

// --- Auto-Save Mechanism ---
let autoSaveTimeout = null;

function showSaveIndicator() {
  UI.saveIndicator.classList.add('visible');
  setTimeout(() => UI.saveIndicator.classList.remove('visible'), 2000);
}

async function performSave() {
  // If absolutely nothing is entered beyond defaults, we don't save.
  const data = getEditorData();
  const isEssentiallyEmpty = !UI.form.title.value && !UI.form.speaker.value && !UI.form.mainScripture.value && !(UI.form.content.textContent || '').trim() && !UI.form.series.value;
  
  if (isEssentiallyEmpty && !state.currentNoteId) return;

  const savedNote = await Storage.saveNote(data);
  state.currentNoteId = savedNote.id;
  showSaveIndicator();
}

function triggerAutoSave() {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    performSave();
  }, 1000); // 1s debounce
}

// Bind auto-save to inputs
Object.values(UI.form).forEach(input => {
  input.addEventListener('input', triggerAutoSave);
  input.addEventListener('change', triggerAutoSave);
});

// --- History List Rendering ---

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

window.deleteSermon = async function(e, id) {
  e.stopPropagation();
  if (confirm('Are you sure you want to delete this sermon?')) {
    await Storage.deleteNote(id);
    if (state.currentNoteId === id) {
      state.currentNoteId = null;
    }
    renderNotesList();
    if (typeof updateDynamicAutocompletes === 'function') updateDynamicAutocompletes();
  }
};

function createNoteCard(note) {
  const d = document.createElement('div');
  d.className = 'note-card';
  d.onclick = () => {
    loadNoteIntoEditor(note.id);
    switchView('editor');
  };
  
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'flex-start';
  
  const title = document.createElement('div');
  title.className = 'note-card-title';
  title.textContent = note.title;
  
  const delBtn = document.createElement('button');
  delBtn.className = 'btn-delete-card';
  delBtn.title = 'Delete Sermon';
  delBtn.innerHTML = '<i class="ph-bold ph-trash"></i>';
  delBtn.onclick = (e) => window.deleteSermon(e, note.id);
  
  header.appendChild(title);
  header.appendChild(delBtn);
  
  const meta = document.createElement('div');
  meta.className = 'note-card-meta';
  
  if (note.date) {
    meta.innerHTML += `<span><i class="ph ph-calendar-blank"></i>${formatDate(note.date)}</span>`;
  }
  if (note.speaker) {
    meta.innerHTML += `<span><i class="ph ph-user"></i>${note.speaker}</span>`;
  }
  if (note.mainScripture) {
     meta.innerHTML += `<span><i class="ph ph-book-open-text"></i>${note.mainScripture}</span>`;
  }
  if (note.series) {
    meta.innerHTML += `<span><i class="ph ph-books"></i>${note.series}</span>`;
  }
  
  d.appendChild(header);
  d.appendChild(meta);
  
  return d;
}

window.changeSortMode = function(e) {
  state.sortMode = e.target.value;
  renderNotesList();
};

function renderNotesList() {
  const notes = Storage.getNotes();
  UI.notesContainer.innerHTML = '';
  
  const term = state.searchValue.toLowerCase();
  
  const filtered = notes.filter(n => {
    return (n.title || '').toLowerCase().includes(term) ||
           (n.speaker || '').toLowerCase().includes(term) ||
           (n.mainScripture || '').toLowerCase().includes(term) ||
           (n.series || '').toLowerCase().includes(term) ||
           (n.content || '').toLowerCase().includes(term);
  });
  
  if (filtered.length === 0) {
    UI.emptyState.classList.remove('hidden');
    return;
  }
  
  UI.emptyState.classList.add('hidden');
  
  // Sort chronologically (newest first)
  filtered.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  if (state.sortMode === 'chronological') {
    filtered.forEach(note => {
      UI.notesContainer.appendChild(createNoteCard(note));
    });
    return;
  }
  
  const groups = {};
  const standalone = [];
  
  filtered.forEach(note => {
    if (note.series && note.series.trim() !== '') {
      const s = note.series.trim();
      if (!groups[s]) groups[s] = [];
      groups[s].push(note);
    } else {
      standalone.push(note);
    }
  });
  
  for (const [seriesName, seriesNotes] of Object.entries(groups)) {
    const header = document.createElement('h3');
    header.className = 'series-group-header';
    header.innerHTML = `<i class="ph-fill ph-books"></i> ${seriesName}`;
    UI.notesContainer.appendChild(header);
    
    seriesNotes.forEach(note => {
      UI.notesContainer.appendChild(createNoteCard(note));
    });
  }
  
  if (standalone.length > 0) {
    if (Object.keys(groups).length > 0) {
      const header = document.createElement('h3');
      header.className = 'series-group-header';
      header.innerHTML = `<i class="ph-fill ph-files"></i> Other Sermons`;
      UI.notesContainer.appendChild(header);
    }
    standalone.forEach(note => {
      UI.notesContainer.appendChild(createNoteCard(note));
    });
  }
}

UI.search.addEventListener('input', (e) => {
  state.searchValue = e.target.value;
  renderNotesList();
});

const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", 
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", 
  "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", 
  "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", 
  "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", 
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", 
  "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", 
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", 
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", 
  "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", 
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

function setupBibleAutocomplete() {
  const datalist = document.createElement('datalist');
  datalist.id = 'bible-books';
  BIBLE_BOOKS.forEach(book => {
    const option = document.createElement('option');
    option.value = book;
    datalist.appendChild(option);
  });
  document.body.appendChild(datalist);
  UI.form.mainScripture.setAttribute('list', 'bible-books');
}

function updateDynamicAutocompletes() {
  const notes = Storage.getNotes();
  const speakers = new Set();
  const series = new Set();
  
  notes.forEach(n => {
    if (n.speaker && n.speaker.trim() !== '') {
      speakers.add(n.speaker.trim());
    }
    if (n.series && n.series.trim() !== '') {
      series.add(n.series.trim());
    }
  });
  
  // Speakers datalist
  let speakerList = document.getElementById('past-speakers');
  if (!speakerList) {
    speakerList = document.createElement('datalist');
    speakerList.id = 'past-speakers';
    document.body.appendChild(speakerList);
    UI.form.speaker.setAttribute('list', 'past-speakers');
  }
  speakerList.innerHTML = '';
  speakers.forEach(speaker => {
    const option = document.createElement('option');
    option.value = speaker;
    speakerList.appendChild(option);
  });

  // Series datalist
  let seriesList = document.getElementById('past-series');
  if (!seriesList) {
    seriesList = document.createElement('datalist');
    seriesList.id = 'past-series';
    document.body.appendChild(seriesList);
    UI.form.series.setAttribute('list', 'past-series');
  }
  seriesList.innerHTML = '';
  series.forEach(s => {
    const option = document.createElement('option');
    option.value = s;
    seriesList.appendChild(option);
  });
}

// --- Init ---
async function init() {
  if (window.InitializeStorageBackend) {
    await window.InitializeStorageBackend();
  }

  // Set default date
  UI.form.date.value = new Date().toISOString().split('T')[0];
  
  UI.form.mainScripture.addEventListener('blur', (e) => {
    fetchScripture(e.target.value);
  });
  
  UI.form.mainScripture.addEventListener('input', (e) => {
    if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') return;
    
    let val = e.target.value;
    
    // 1. Auto-space after book name
    const exactBook = BIBLE_BOOKS.find(b => b.toLowerCase() === val.toLowerCase());
    if (exactBook) {
      e.target.value = exactBook + ' ';
      return;
    }
    
    // 2. Auto-colon after chapter when typing a space
    const match = val.match(/^(.+?)\s(\d+)\s$/);
    if (match) {
      const bookPart = match[1].trim();
      const matchedBook = BIBLE_BOOKS.find(b => b.toLowerCase() === bookPart.toLowerCase());
      if (matchedBook) {
        e.target.value = matchedBook + ' ' + match[2] + ':';
      }
    }
  });
  
  setupBibleAutocomplete();
  updateDynamicAutocompletes();
  
  // Start on editor
  switchView('editor');
}

// Ensure DOM is ready (simplistic approach since it's bottom loaded)
init();
