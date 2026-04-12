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

// Initialize Authentication Services
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// System variables
let currentUserUID = null;
let localNotesCache = [];

function generateId() {
  // Use Firebase's native synchronous ID generator for valid keys
  return db.collection('sermons').doc().id;
}

// Fetch from cloud asynchronously for authenticated user
async function fetchNotesFromDb() {
  try {
    const colRef = db.collection(`users/${currentUserUID}/sermons`);
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

// Seamlessly copy local hardware notes fully to the Google account natively
async function migrateDeviceDataToGoogle(uid) {
  const legacyId = localStorage.getItem('sermon_install_id');
  if (!legacyId) return; // No legacy device ID to migrate
  
  const hasMigrated = localStorage.getItem('sermon_notes_migrated_to_auth');
  if (hasMigrated === 'true') return; // Only execute migration once specifically for this device
  
  console.log("Device database found. Migrating legacy hardware notes into Google account...");
  try {
    const colRef = db.collection(`users/${legacyId}/sermons`);
    const snapshot = await colRef.get();
    
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.forEach(docSnap => {
        const newDocRef = db.collection(`users/${uid}/sermons`).doc(docSnap.id);
        batch.set(newDocRef, docSnap.data());
      });
      await batch.commit();
      console.log(`Successfully beamed ${snapshot.size} device notes safely into the cloud!`);
    } else {
      console.log("No legacy hardware notes existed.");
    }
    
    // Tag this hardware browser so it securely never attempts migration again
    localStorage.setItem('sermon_notes_migrated_to_auth', 'true');
  } catch(e) {
    console.error("Critical error forcefully copying device notes to cloud:", e);
  }
}

// Automatically bind to the loading flow
window.InitializeStorageBackend = async function() {
  await fetchNotesFromDb();
}

function getNotes() {
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
    const docRef = db.collection(`users/${currentUserUID}/sermons`).doc(note.id);
    await docRef.set(note, { merge: true });
  } catch(e) {
    console.error("Failed to sync note to cloud", e);
    throw e; // Blocks data wipe if cloud fails
  }
  
  return note;
}

async function deleteNote(id) {
  localNotesCache = localNotesCache.filter(n => n.id !== id);
  
  try {
    const docRef = db.collection(`users/${currentUserUID}/sermons`).doc(id);
    await docRef.delete();
  } catch(e) {
    console.error("Failed to delete from cloud", e);
  }
}

// --- Auth Helpers (Exposed) ---

window.SignInWithGoogle = () => {
  return auth.signInWithPopup(googleProvider);
};

window.SignOutFromGoogle = () => {
  return auth.signOut();
};


// Expose synchronously mapping functions for the UI layer
window.Storage = {
  getNotes,
  getNoteById,
  saveNote,
  deleteNote,
  generateId,
  migrateDeviceDataToGoogle,
  setUserUID: (uid) => { currentUserUID = uid; },
  clearCache: () => { localNotesCache = []; }
};
