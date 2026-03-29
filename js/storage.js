// storage.js
// Handles Firebase Firestore operations with offline caching and Anonymous pseudo-auth

// Firebase is loaded globally from the CDN compat libraries in index.html!
const firebaseConfig = {
  apiKey: "AIzaSyB08ezUkrZKphPN--t2whqu21sobbC_Q-0",
  authDomain: "simple-sermon-notes.firebaseapp.com",
  projectId: "simple-sermon-notes",
  storageBucket: "simple-sermon-notes.firebasestorage.app",
  messagingSenderId: "67741125500",
  appId: "1:67741125500:web:bfc54d9b6786c28f34f2f9",
  measurementId: "G-8XR34RQ0Y6"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Enable Offline Data persistence (handles dead zones in church)
db.enablePersistence().catch((err) => {
  if (err.code == 'failed-precondition') {
    console.error("Multiple tabs open, offline persistence can only be enabled in one tab at a time.");
  } else if (err.code == 'unimplemented') {
    console.error("The current browser does not support offline persistence.");
  }
});

// Installation ID acts as a pseudo user account
let installationId = localStorage.getItem('sermon_install_id');
if (!installationId) {
  installationId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  localStorage.setItem('sermon_install_id', installationId);
}
console.log("Device Installation ID Map:", installationId);

// Internal Cache to keep UI fast
let localNotesCache = [];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Fetch from cloud asynchronously
async function fetchNotesFromDb() {
  try {
    const colRef = db.collection(`users/${installationId}/sermons`);
    const snapshot = await colRef.get();
    const notes = [];
    snapshot.forEach(docSnap => {
      notes.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort chronological: highest updatedAt first
    notes.sort((a,b) => b.updatedAt - a.updatedAt);
    localNotesCache = notes;
    return notes;
  } catch(e) {
    console.error("Local data or fetch failed", e);
    return localNotesCache; // fallback to empty
  }
}

// Migrate old data if necessary (one-time push)
async function migrateLegacyData() {
  const legacyData = localStorage.getItem('sermon_notes_data');
  if (legacyData) {
    try {
      const parsed = JSON.parse(legacyData);
      if (parsed && parsed.length > 0) {
        console.log("Migrating legacy data to Firebase...");
        for (const note of parsed) {
          await saveNote(note); // Securely pushes them up to the cloud!
        }
      }
      localStorage.removeItem('sermon_notes_data');
      console.log("Legacy data migration complete.");
    } catch(e) {
      console.error("Error migrating legacy data", e);
    }
  }
}

// Automatically bind to the loading flow
window.InitializeStorageBackend = async function() {
  await migrateLegacyData();
  await fetchNotesFromDb();
}

function getNotes() {
  // Always returns cached version instantly for UI responsiveness
  return localNotesCache;
}

function getNoteById(id) {
  return localNotesCache.find(n => n.id === id) || null;
}

async function saveNote(note) {
  if (!note.id) note.id = generateId();
  note.updatedAt = Date.now();
  
  // Update local cache immediately so UI doesn't stutter!
  const index = localNotesCache.findIndex(n => n.id === note.id);
  if (index >= 0) {
    localNotesCache[index] = note;
  } else {
    localNotesCache.unshift(note);
  }

  // Push to Firebase async (in background)
  try {
    const docRef = db.collection(`users/${installationId}/sermons`).doc(note.id);
    await docRef.set(note);
  } catch(e) {
    console.error("Failed to sync note to cloud", e);
    throw e; // Blocks data wipe if cloud fails
  }
  
  return note;
}

async function deleteNote(id) {
  // Update local cache
  localNotesCache = localNotesCache.filter(n => n.id !== id);
  
  // Delete from cloud background
  try {
    const docRef = db.collection(`users/${installationId}/sermons`).doc(id);
    await docRef.delete();
  } catch(e) {
    console.error("Failed to delete from cloud", e);
  }
}

// Expose synchronously mapping functions for the UI layer
window.Storage = {
  getNotes,
  getNoteById,
  saveNote,
  deleteNote,
  generateId
};
