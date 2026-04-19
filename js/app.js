// app.js
// Main application logic, UI interactions, and state management

let currentLanguage = 'en';

// State
let state = {
  currentNoteId: null,
  activeView: 'editor', // 'editor' | 'list'
  searchValue: '',
  sortMode: 'chronological',
  mainScripture: ''
};

// UI Elements mapping
const UI = {
  views: {
    editor: document.getElementById('editor-view'),
    list: document.getElementById('list-view'),
    auth: document.getElementById('auth-view')
  },
  header: document.querySelector('.top-bar'),
  topBar: {
    backBtn: document.getElementById('btn-back-sermons'),
    newNoteBtn: document.getElementById('btn-new-note'),
    deleteBtn: document.getElementById('btn-delete-note'),
    finalizeBtn: document.getElementById('btn-finalize-note'),
    logoutBtn: document.getElementById('btn-logout')
  },
  form: {
    title: document.getElementById('note-title'),
    speaker: document.getElementById('note-speaker'),
    date: document.getElementById('note-date'),
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
  btnOpenBiblePickerWrapper: document.getElementById('add-scripture-wrapper'),
  // Anchor Scripture
  anchorScripture: {
    container: document.getElementById('anchor-scripture-container'),
    citationText: document.getElementById('citation-text'),
    body: document.getElementById('scripture-body'),
    chevron: document.getElementById('scripture-chevron')
  },
  // Bible Picker
  biblePicker: {
    modal: document.getElementById('bible-picker-modal'),
    grid: document.getElementById('bible-picker-grid'),
    back: document.getElementById('bible-picker-back'),
    breadcrumb: document.getElementById('bible-picker-breadcrumb'),
    footer: document.getElementById('bible-picker-footer')
  }
};

// --- Rich Text Editing ---
window.formatText = function (command) {
  document.execCommand(command, false, null);
  UI.form.content.focus();
  updateToolbarState();
};

function updateToolbarState() {
  const commands = ['bold', 'italic', 'underline'];
  const buttons = document.querySelectorAll('.toolbar-btn');
  
  if (buttons.length < 3) return; // safeguard if UI not loaded
  
  commands.forEach((command, index) => {
    const isActive = document.queryCommandState(command);
    if (isActive) {
      buttons[index].classList.add('!text-violet-900', 'bg-violet-50');
    } else {
      buttons[index].classList.remove('!text-violet-900', 'bg-violet-50');
    }
  });
}

document.addEventListener('selectionchange', () => {
  if (document.activeElement === UI.form.content) {
    updateToolbarState();
  }
});

UI.form.content.addEventListener('paste', function (e) {
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

// --- Legacy Bible Fetching Engine Removed ---

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

  if (viewName === 'auth') {
    if (UI.header) UI.header.style.display = 'none';
  } else if (viewName === 'list') {
    if (UI.header) UI.header.style.display = 'flex';
    UI.appTitle.textContent = 'Sermons';
    UI.topBar.backBtn.style.display = 'none';
    UI.topBar.newNoteBtn.style.display = 'block';
    if (UI.topBar.logoutBtn) UI.topBar.logoutBtn.style.display = 'block';

    // Hide editor buttons
    if (UI.topBar.deleteBtn) UI.topBar.deleteBtn.style.display = 'none';
    if (UI.topBar.finalizeBtn) UI.topBar.finalizeBtn.style.display = 'none';

    renderNotesList();
  } else if (viewName === 'editor') {
    if (UI.header) UI.header.style.display = 'flex';
    UI.appTitle.textContent = state.currentNoteId ? 'Edit Note' : 'New Note';
    UI.topBar.backBtn.style.display = 'block';
    UI.topBar.newNoteBtn.style.display = 'none';
    if (UI.topBar.logoutBtn) UI.topBar.logoutBtn.style.display = 'none';

    // Show editor buttons
    if (UI.topBar.deleteBtn) UI.topBar.deleteBtn.style.display = 'block';
    if (UI.topBar.finalizeBtn) UI.topBar.finalizeBtn.style.display = 'block';

    if (typeof updateDynamicAutocompletes === 'function') updateDynamicAutocompletes();
  }
}

window.switchView = switchView;

// --- Metadata & Series Visibility ---
window.toggleMetadata = function () {
  const body = document.getElementById('metadata-body');
  const chevron = document.getElementById('metadata-chevron');
  body.classList.toggle('collapsed');

  if (body.classList.contains('collapsed')) {
    chevron.style.transform = 'rotate(180deg)';
  } else {
    chevron.style.transform = 'rotate(0deg)';
  }
};

window.toggleSeriesInput = function () {
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
    mainScripture: state.mainScripture,
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
  // Trigger auto-resize for title textarea on load
  if (UI.form.title) {
    UI.form.title.style.height = 'auto';
    setTimeout(() => {
      UI.form.title.style.height = UI.form.title.scrollHeight + 'px';
    }, 10); // Small timeout allows DOM to paint the new value before calculating height
  }
  UI.form.speaker.value = note.speaker || '';
  UI.form.date.value = note.date || '';
  state.mainScripture = note.mainScripture || '';
  UI.form.series.value = note.series || '';
  UI.form.content.innerHTML = note.content || '';

  UI.form.fetchedScriptureText = note.fetchedScriptureText || null;
  UI.form.fetchedScriptureMeta = note.fetchedScriptureMeta || null;

  if (state.mainScripture && UI.form.fetchedScriptureText) {
    UI.anchorScripture.citationText.textContent = state.mainScripture;
    UI.anchorScripture.body.innerHTML = UI.form.fetchedScriptureText;
    UI.anchorScripture.container.classList.remove('hidden');
    UI.btnOpenBiblePickerWrapper.style.display = 'none';
    
    // Default to collapsed state on load
    UI.anchorScripture.container.classList.add('collapsed');
    UI.anchorScripture.body.classList.add('hidden');
  } else {
    UI.anchorScripture.container.classList.add('hidden');
    UI.anchorScripture.citationText.textContent = '';
    UI.anchorScripture.body.innerHTML = '';
    UI.btnOpenBiblePickerWrapper.style.display = 'flex';
  }

  updateSeriesVisibility();
}

window.createNewNote = function () {
  state.currentNoteId = null;
  UI.appTitle.textContent = 'New Note';

  // Clear forms
  UI.form.title.value = '';
  UI.form.speaker.value = '';
  UI.form.date.value = new Date().toISOString().split('T')[0];
  state.mainScripture = '';
  UI.form.series.value = '';
  UI.form.content.innerHTML = '';
  UI.form.fetchedScriptureText = null;
  UI.form.fetchedScriptureMeta = null;
  
  UI.anchorScripture.container.classList.add('hidden');
  UI.anchorScripture.citationText.textContent = '';
  UI.anchorScripture.body.innerHTML = '';
  UI.anchorScripture.container.classList.add('collapsed');
  UI.anchorScripture.body.classList.add('hidden');
  UI.btnOpenBiblePickerWrapper.style.display = 'flex';
  
  updateSeriesVisibility();

  switchView('editor');
};

window.editScripture = function(event) {
  event.stopPropagation();
  window.openBiblePicker();
};

window.toggleScripture = function() {
  const container = UI.anchorScripture.container;
  const body = UI.anchorScripture.body;
  
  container.classList.toggle('collapsed');
  if (container.classList.contains('collapsed')) {
    body.classList.add('hidden');
  } else {
    body.classList.remove('hidden');
  }
};

window.finalizeNote = function () {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  performSave();
  switchView('list');
};

window.deleteCurrentNote = async function () {
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
  const isEssentiallyEmpty = !UI.form.title.value && !UI.form.speaker.value && !state.mainScripture && !(UI.form.content.textContent || '').trim() && !UI.form.series.value;

  if (isEssentiallyEmpty && !state.currentNoteId) return;

  // Generate and set note ID synchronously before async operations
  // This prevents duplicates from rapid debounced saves while waiting for Firestore
  if (!state.currentNoteId) {
    state.currentNoteId = Storage.generateId();
  }

  const data = getEditorData();

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

window.deleteSermon = async function (e, id) {
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
  d.className = 'bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-violet-900 hover:shadow-md cursor-pointer block';
  d.onclick = () => {
    loadNoteIntoEditor(note.id);
    switchView('editor');
  };

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'flex-start';

  const title = document.createElement('div');
  title.className = 'text-xl font-bold text-slate-900 mb-2 leading-tight pr-4 break-words whitespace-normal line-clamp-2';
  title.textContent = note.title;

  const delBtn = document.createElement('button');
  delBtn.className = 'text-slate-300 hover:text-red-500 transition-colors p-1 -mt-1 -mr-1 flex items-center justify-center';
  delBtn.title = 'Delete Sermon';
  delBtn.innerHTML = '<i class="ph-bold ph-trash text-[1.3rem]"></i>';
  delBtn.onclick = (e) => window.deleteSermon(e, note.id);

  header.appendChild(title);
  header.appendChild(delBtn);

  const meta = document.createElement('div');
  meta.className = 'flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500 font-medium mt-1';

  if (note.date) {
    meta.innerHTML += `<span class="flex items-center gap-1.5"><i class="ph ph-calendar-blank text-violet-900 text-base"></i>${formatDate(note.date)}</span>`;
  }
  if (note.speaker) {
    meta.innerHTML += `<span class="flex items-center gap-1.5"><i class="ph ph-user text-violet-900 text-base"></i>${note.speaker}</span>`;
  }
  if (note.mainScripture) {
    meta.innerHTML += `<span class="flex items-center gap-1.5"><i class="ph ph-book-open-text text-violet-900 text-base"></i>${note.mainScripture}</span>`;
  }
  if (note.series) {
    meta.innerHTML += `<span class="flex items-center gap-1.5"><i class="ph ph-books text-violet-900 text-base"></i>${note.series}</span>`;
  }

  d.appendChild(header);
  d.appendChild(meta);

  return d;
}

window.changeSortMode = function (e) {
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
    header.className = 'text-lg font-bold text-slate-900 border-b border-slate-200 pb-2 mb-2 mt-6 flex items-center gap-2 tracking-tight';
    header.innerHTML = `<i class="ph-fill ph-books text-violet-900"></i> ${seriesName}`;
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
  // We purposely DO NOT hit InitializeStorageBackend() here anymore.
  // The Firebase Auth 'onAuthStateChanged' listener inside storage.js completely takes over the native boot sequence!

  // Set default date
  UI.form.date.value = new Date().toISOString().split('T')[0];

  updateDynamicAutocompletes();

  // Notice we DO NOT manually call switchView('editor') anymore. Auth listener handles the very first routing!
}

// --- Authentication Handlers ---

window.signInAction = () => {
  if (window.SignInWithGoogle) {
    window.SignInWithGoogle().catch(err => {
      console.error("Sign In Blocked", err);
      alert("Sign In Failed: Ensure Google Sign-In is enabled in Firebase Console.");
    });
  }
};

window.signOutAction = () => {
  if (window.SignOutFromGoogle) {
    window.SignOutFromGoogle().then(() => {
      Storage.clearCache();
      switchView('auth');
    });
  }
};

// Global Boot Sequence Gateway
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    // 1. Point Storage at the validated user
    Storage.setUserUID(user.uid);

    // 2. Perform one-time migration from hardware ID
    if (Storage.migrateDeviceDataToGoogle) {
      await Storage.migrateDeviceDataToGoogle(user.uid);
    }

    // 3. Warm up the database
    if (window.InitializeStorageBackend) {
      await window.InitializeStorageBackend();
    }

    // 4. Show the list
    switchView('list');
  } else {
    // No user, force login gate
    Storage.setUserUID(null);
    Storage.clearCache();
    switchView('auth');
  }
});

init();

// --- Bible Picker Logic ---
const bibleData = {"Genesis": [31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20, 67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34, 31, 22, 33, 26], "Exodus": [22, 25, 22, 31, 23, 30, 25, 32, 35, 29, 10, 51, 22, 31, 27, 36, 16, 27, 25, 26, 36, 31, 33, 18, 40, 37, 21, 43, 46, 38, 18, 35, 23, 35, 35, 38, 29, 31, 43, 38], "Leviticus": [17, 16, 17, 35, 19, 30, 38, 36, 24, 20, 47, 8, 59, 57, 33, 34, 16, 30, 37, 27, 24, 33, 44, 23, 55, 46, 34], "Numbers": [54, 34, 51, 49, 31, 27, 89, 26, 23, 36, 35, 16, 33, 45, 41, 50, 13, 32, 22, 29, 35, 41, 30, 25, 18, 65, 23, 31, 40, 16, 54, 42, 56, 29, 34, 13], "Deuteronomy": [46, 37, 29, 49, 33, 25, 26, 20, 29, 22, 32, 32, 18, 29, 23, 22, 20, 22, 21, 20, 23, 30, 25, 22, 19, 19, 26, 68, 29, 20, 30, 52, 29, 12], "Joshua": [18, 24, 17, 24, 15, 27, 26, 35, 27, 43, 23, 24, 33, 15, 63, 10, 18, 28, 51, 9, 45, 34, 16, 33], "Judges": [36, 23, 31, 24, 31, 40, 25, 35, 57, 18, 40, 15, 25, 20, 20, 31, 13, 31, 30, 48, 25], "Ruth": [22, 23, 18, 22], "1 Samuel": [28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30, 24, 43, 15, 23, 29, 22, 44, 25, 12, 25, 11, 31, 13], "2 Samuel": [27, 32, 39, 12, 25, 23, 29, 18, 13, 19, 27, 31, 39, 33, 37, 23, 29, 33, 43, 26, 22, 51, 39, 25], "1 Kings": [53, 46, 28, 34, 18, 38, 51, 66, 28, 29, 43, 33, 34, 31, 34, 34, 24, 46, 21, 43, 29, 54], "2 Kings": [18, 25, 27, 44, 27, 33, 20, 29, 37, 36, 21, 21, 25, 29, 38, 20, 41, 37, 37, 21, 26, 20, 37, 20, 30], "1 Chronicles": [54, 55, 24, 43, 26, 81, 40, 40, 44, 14, 47, 40, 14, 17, 29, 43, 27, 17, 19, 8, 30, 19, 32, 31, 31, 32, 34, 21, 30], "2 Chronicles": [17, 18, 17, 22, 14, 42, 22, 18, 31, 19, 23, 16, 22, 15, 19, 14, 19, 34, 11, 37, 20, 12, 21, 27, 28, 23, 9, 27, 36, 27, 21, 33, 25, 33, 27, 23], "Ezra": [11, 70, 13, 24, 17, 22, 28, 36, 15, 44], "Nehemiah": [11, 20, 32, 23, 19, 19, 73, 18, 38, 39, 36, 47, 31], "Esther": [22, 23, 15, 17, 14, 14, 10, 17, 32, 3], "Job": [22, 13, 26, 21, 27, 30, 21, 22, 35, 22, 20, 25, 28, 22, 35, 22, 16, 21, 29, 29, 34, 30, 17, 25, 6, 14, 23, 28, 25, 31, 40, 22, 33, 37, 16, 33, 24, 41, 30, 24, 34, 17], "Psalms": [6, 12, 8, 8, 12, 10, 17, 9, 20, 18, 7, 8, 6, 7, 5, 11, 15, 50, 14, 9, 13, 31, 6, 10, 22, 12, 14, 9, 11, 12, 24, 11, 22, 22, 28, 12, 40, 22, 13, 17, 13, 11, 5, 26, 17, 11, 9, 14, 20, 23, 19, 9, 6, 7, 23, 13, 11, 11, 17, 12, 8, 12, 11, 10, 13, 20, 7, 35, 36, 5, 24, 20, 28, 23, 10, 12, 20, 72, 13, 19, 16, 8, 18, 12, 13, 17, 7, 18, 52, 17, 16, 15, 5, 23, 11, 13, 12, 9, 9, 5, 8, 28, 22, 35, 45, 48, 43, 13, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176, 7, 8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 13, 10, 7, 12, 15, 21, 10, 20, 14, 9, 6], "Proverbs": [33, 22, 35, 27, 23, 35, 27, 36, 18, 32, 31, 28, 25, 35, 33, 33, 28, 24, 29, 30, 31, 29, 35, 34, 28, 28, 27, 28, 27, 33, 31], "Ecclesiastes": [18, 26, 22, 16, 20, 12, 29, 17, 18, 20, 10, 14], "Song of Solomon": [17, 17, 11, 16, 16, 13, 13, 14], "Isaiah": [31, 22, 26, 6, 30, 13, 25, 22, 21, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23, 12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15, 22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 12, 25, 24], "Jeremiah": [19, 37, 25, 31, 31, 30, 34, 22, 26, 25, 23, 17, 27, 22, 21, 21, 27, 23, 15, 18, 14, 30, 40, 10, 38, 24, 22, 17, 32, 24, 40, 44, 26, 22, 19, 32, 21, 28, 18, 16, 18, 22, 13, 30, 5, 28, 7, 47, 39, 46, 64, 34], "Lamentations": [22, 22, 66, 22, 22], "Ezekiel": [28, 10, 27, 17, 17, 14, 27, 18, 11, 22, 25, 28, 23, 23, 8, 63, 24, 32, 14, 49, 32, 31, 49, 27, 17, 21, 36, 26, 21, 26, 18, 32, 33, 31, 15, 38, 28, 23, 29, 49, 26, 20, 27, 31, 25, 24, 23, 35], "Daniel": [21, 49, 30, 37, 31, 28, 28, 27, 27, 21, 45, 13], "Hosea": [11, 23, 5, 19, 15, 11, 16, 14, 17, 15, 12, 14, 16, 9], "Joel": [20, 32, 21], "Amos": [15, 16, 15, 13, 27, 14, 17, 14, 15], "Obadiah": [21], "Jonah": [17, 10, 10, 11], "Micah": [16, 13, 12, 13, 15, 16, 20], "Nahum": [15, 13, 19], "Habakkuk": [17, 20, 19], "Zephaniah": [18, 15, 20], "Haggai": [15, 23], "Zechariah": [21, 13, 10, 14, 11, 15, 14, 23, 17, 12, 17, 14, 9, 21], "Malachi": [14, 17, 18, 6], "Matthew": [25, 22, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35, 30, 34, 46, 45, 39, 51, 46, 74, 66, 20], "Mark": [45, 28, 35, 40, 43, 56, 36, 37, 50, 52, 33, 44, 37, 72, 47, 20], "Luke": [80, 52, 38, 44, 39, 49, 50, 56, 62, 42, 54, 59, 35, 35, 32, 31, 37, 43, 48, 47, 38, 71, 56, 53], "John": [51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40, 42, 31, 25], "Acts": [26, 47, 26, 37, 42, 15, 60, 40, 43, 48, 30, 25, 52, 28, 41, 40, 34, 28, 41, 38, 40, 30, 35, 27, 27, 32, 44, 31], "Romans": [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27], "1 Corinthians": [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24], "2 Corinthians": [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 14], "Galatians": [24, 21, 29, 31, 26, 18], "Ephesians": [23, 22, 21, 32, 33, 24], "Philippians": [30, 30, 21, 23], "Colossians": [29, 23, 25, 18], "1 Thessalonians": [10, 20, 13, 18, 28], "2 Thessalonians": [12, 17, 18], "1 Timothy": [20, 15, 16, 16, 25, 21], "2 Timothy": [18, 26, 17, 22], "Titus": [16, 15, 15], "Philemon": [25], "Hebrews": [14, 18, 19, 16, 14, 20, 28, 13, 28, 39, 40, 29, 25], "James": [27, 26, 18, 17, 20], "1 Peter": [25, 25, 22, 19, 14], "2 Peter": [21, 22, 18], "1 John": [10, 29, 24, 21, 21], "2 John": [13], "3 John": [15], "Jude": [25], "Revelation": [20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 18, 18, 20, 8, 21, 18, 24, 21, 15, 27, 21]};

let biblePickerState = {
  step: 'books', // 'books', 'chapters', 'verses'
  book: null,
  chapter: null,
  startVerse: null,
  endVerse: null
};

window.openBiblePicker = function() {
  biblePickerState = { step: 'books', book: null, chapter: null, startVerse: null, endVerse: null };
  const modal = document.getElementById('bible-picker-modal');
  if (modal) {
    // Re-initialize mapped elements to be safe against load-order issues
    UI.biblePicker.modal = modal;
    UI.biblePicker.grid = document.getElementById('bible-picker-grid');
    UI.biblePicker.back = document.getElementById('bible-picker-back');
    UI.biblePicker.breadcrumb = document.getElementById('bible-picker-breadcrumb');
    UI.biblePicker.footer = document.getElementById('bible-picker-footer');
    UI.biblePicker.selectionHint = document.getElementById('selection-hint');
    
    UI.biblePicker.modal.style.display = 'flex';
    // Small timeout to allow the display:flex to register before CSS transition removes transform
    setTimeout(() => {
      UI.biblePicker.modal.classList.remove('hidden');
    }, 10);
    renderBibleBooks();
  } else {
    console.error("Bible Picker Modal not found in DOM.");
  }
};

window.closeBiblePicker = function() {
  UI.biblePicker.modal.classList.add('hidden');
  // Wait for the opacity/transform transition to finish before totally removing from DOM flow
  setTimeout(() => {
    UI.biblePicker.modal.style.display = 'none';
  }, 150); // matches var(--transition-fast) = 0.15s
};

window.biblePickerBack = function() {
  if (biblePickerState.step === 'verses') {
    biblePickerState.step = 'chapters';
    biblePickerState.startVerse = null;
    biblePickerState.endVerse = null;
    renderBibleChapters(biblePickerState.book);
  } else if (biblePickerState.step === 'chapters') {
    biblePickerState.step = 'books';
    biblePickerState.book = null;
    renderBibleBooks();
  } else {
    window.closeBiblePicker();
  }
};

function updateBreadcrumb() {
  let b = '';
  if (biblePickerState.book) b += biblePickerState.book;
  if (biblePickerState.chapter) b += ' > ' + biblePickerState.chapter;
  UI.biblePicker.breadcrumb.textContent = b || 'Books';
  
  if (biblePickerState.step === 'books') {
    UI.biblePicker.back.style.visibility = 'hidden';
  } else {
    UI.biblePicker.back.style.visibility = 'visible';
  }
}

function renderBibleBooks() {
  biblePickerState.step = 'books';
  updateBreadcrumb();
  UI.biblePicker.footer.classList.add('hidden');
  updateSelectionHint();
  UI.biblePicker.grid.className = 'flex-1 overflow-y-auto p-4 grid gap-3 content-start w-full box-border grid-cols-3';
  UI.biblePicker.grid.innerHTML = '';
  
  Object.keys(bibleData).forEach(book => {
    const div = document.createElement('div');
    div.className = 'bg-slate-100 hover:bg-slate-200 rounded-lg py-4 text-slate-700 text-center font-medium cursor-pointer transition-colors flex items-center justify-center break-words';
    div.textContent = book;
    div.onclick = () => window.selectBook(book);
    UI.biblePicker.grid.appendChild(div);
  });
}

window.selectBook = function(book) {
  biblePickerState.book = book;
  renderBibleChapters(book);
};

function renderBibleChapters(book) {
  biblePickerState.step = 'chapters';
  updateBreadcrumb();
  UI.biblePicker.footer.classList.add('hidden');
  updateSelectionHint();
  UI.biblePicker.grid.className = 'flex-1 overflow-y-auto p-4 grid gap-3 content-start w-full box-border grid-cols-5';
  UI.biblePicker.grid.innerHTML = '';
  
  const numChapters = bibleData[book].length;
  for (let i = 1; i <= numChapters; i++) {
    const div = document.createElement('div');
    div.className = 'bg-slate-100 hover:bg-slate-200 rounded-lg py-4 text-slate-700 text-center font-medium cursor-pointer transition-colors flex items-center justify-center break-words';
    div.textContent = i;
    div.onclick = () => window.selectChapter(i);
    UI.biblePicker.grid.appendChild(div);
  }
}

window.selectChapter = function(chapter) {
  biblePickerState.chapter = chapter;
  renderBibleVerses(biblePickerState.book, chapter);
};

function renderBibleVerses(book, chapter) {
  biblePickerState.step = 'verses';
  updateBreadcrumb();
  UI.biblePicker.grid.className = 'flex-1 overflow-y-auto p-4 grid gap-3 content-start w-full box-border grid-cols-5';
  
  const numVerses = bibleData[book][chapter - 1]; // array is 0-indexed
  renderVersesGrid(numVerses);
  updateFooter();
}

function renderVersesGrid(numVerses) {
  UI.biblePicker.grid.innerHTML = '';
  const { startVerse, endVerse } = biblePickerState;
  
  for (let i = 1; i <= numVerses; i++) {
    const div = document.createElement('div');
    div.className = 'bg-slate-100 hover:bg-slate-200 rounded-lg py-4 text-slate-700 text-center font-medium cursor-pointer transition-colors flex items-center justify-center break-words';
    div.textContent = i;
    
    if (startVerse === i && !endVerse) {
      div.classList.add('!bg-violet-900', '!text-white');
    } else if (startVerse && endVerse) {
      if (i === startVerse || i === endVerse) {
        div.classList.add('!bg-violet-900', '!text-white');
      } else if (i > startVerse && i < endVerse) {
        div.classList.add('!bg-violet-900/20', '!text-violet-900');
      }
    }
    
    div.onclick = () => window.selectVerse(i, numVerses);
    UI.biblePicker.grid.appendChild(div);
  }
}

window.selectVerse = function(verse, numVerses) {
  if (!biblePickerState.startVerse) {
    biblePickerState.startVerse = verse;
  } else if (biblePickerState.startVerse && !biblePickerState.endVerse) {
    if (verse > biblePickerState.startVerse) {
      biblePickerState.endVerse = verse;
      renderVersesGrid(numVerses);
      updateFooter();
      setTimeout(() => {
         if (biblePickerState.endVerse === verse && UI.biblePicker.modal.classList.contains('hidden') === false) {
           window.finalizeVerseSelection();
         }
      }, 500);
      return;
    } else {
      biblePickerState.startVerse = verse;
      biblePickerState.endVerse = null;
    }
  } else {
    if (verse > biblePickerState.startVerse) {
      biblePickerState.endVerse = verse;
      renderVersesGrid(numVerses);
      updateFooter();
      setTimeout(() => {
         if (biblePickerState.endVerse === verse && UI.biblePicker.modal.classList.contains('hidden') === false) {
           window.finalizeVerseSelection();
         }
      }, 500);
      return;
    } else {
      biblePickerState.startVerse = verse;
      biblePickerState.endVerse = null;
    }
  }
  
  renderVersesGrid(numVerses);
  updateFooter();
};

function updateFooter() {
  if (biblePickerState.startVerse) {
    UI.biblePicker.footer.classList.remove('hidden');
  } else {
    UI.biblePicker.footer.classList.add('hidden');
  }
  updateSelectionHint();
}

function updateSelectionHint() {
  if (!UI.biblePicker.selectionHint) return;
  
  if (biblePickerState.step !== 'verses') {
    UI.biblePicker.selectionHint.classList.add('hidden');
    return;
  }
  
  UI.biblePicker.selectionHint.classList.remove('hidden');
  if (!biblePickerState.startVerse) {
    UI.biblePicker.selectionHint.textContent = "Tap a verse to begin.";
  } else if (biblePickerState.startVerse && !biblePickerState.endVerse) {
    UI.biblePicker.selectionHint.textContent = "Tap another verse to select a range, or tap Done.";
  } else {
    UI.biblePicker.selectionHint.textContent = "Range selected. Tap Done to finalize.";
  }
}

window.finalizeVerseSelection = async function() {
  const { book, chapter, startVerse, endVerse } = biblePickerState;
  if (!book || !chapter || !startVerse) return;
  
  window.closeBiblePicker();
  
  let endpoint = `${book} ${chapter}:${startVerse}`;
  if (endVerse) endpoint += `-${endVerse}`;
  
  state.mainScripture = endpoint;
  UI.anchorScripture.citationText.textContent = endpoint;
  UI.anchorScripture.container.classList.remove('hidden');
  UI.btnOpenBiblePickerWrapper.style.display = 'none';
  
  UI.anchorScripture.body.innerHTML = `<i class="ph ph-spinner"></i> Fetching ${endpoint}...`;
  UI.anchorScripture.container.classList.remove('collapsed');
  UI.anchorScripture.body.classList.remove('hidden');

  try {
    const response = await fetch(`https://bible-api.com/${encodeURIComponent(endpoint)}?translation=kjv`);
    if (!response.ok) throw new Error('Not found');
    const data = await response.json();
    
    let versesHtml = '';
    data.verses.forEach(v => {
       versesHtml += `<sup class="v-num" contenteditable="false">${v.verse}</sup>${v.text.trim()} `;
    });
    
    UI.anchorScripture.body.innerHTML = versesHtml;
    UI.form.fetchedScriptureText = versesHtml;
    
    // Auto-collapse after successful fetch to save screen real estate
    UI.anchorScripture.container.classList.add('collapsed');
    UI.anchorScripture.body.classList.add('hidden');
    
    if (typeof triggerAutoSave === 'function') {
        triggerAutoSave();
    }
  } catch(e) {
    console.error('Bible API fetch failed', e);
    UI.anchorScripture.body.innerHTML = `<span style="color:red">Failed to fetch scripture. Please try again.</span>`;
  }
};


