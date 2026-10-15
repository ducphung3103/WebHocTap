/**
 * Durable browser archive for DeruckOJ submissions.
 *
 * Firebase remains the shared realtime source. IndexedDB preserves older and
 * offline submissions on the current device, while mergeSubmissionCollections
 * prevents a shorter remote response from replacing the local archive.
 */
(function initSubmissionArchive(global) {
  'use strict';

  const DB_NAME = 'deruckoj-realtime-data';
  const DB_VERSION = 1;
  const STORE_NAME = 'submissions';
  const CHANNEL_NAME = 'deruckoj-submissions';
  let databasePromise;

  function submissionTime(item) {
    if (!item) return 0;
    const idMatch = String(item.id || '').match(/^SUB-(\d{12,13})/);
    if (idMatch) return Number(idMatch[1]) || 0;
    return Number(item.timestamp) || Date.parse(item.submitted_at || item.updated_at || '') || 0;
  }

  function mergeSubmissionCollections(...collections) {
    const records = new Map();
    collections.flat().filter(Boolean).forEach(item => {
      if (!item || typeof item !== 'object') return;
      if (typeof global.isDeruckSubmission === 'function' && !global.isDeruckSubmission(item)) return;
      const id = String(item.id || '').trim();
      if (!id) return;
      const previous = records.get(id) || {};
      records.set(id, {
        ...previous,
        ...item,
        id,
        answer: item.answer === undefined || item.answer === '' ? previous.answer : item.answer,
        archived_at: item.archived_at || previous.archived_at || new Date().toISOString()
      });
    });
    return Array.from(records.values()).sort((a, b) => submissionTime(b) - submissionTime(a));
  }

  function openSubmissionArchive() {
    if (!('indexedDB' in global)) return Promise.resolve(null);
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('submitted_at', 'submitted_at', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return databasePromise;
  }

  async function loadArchivedSubmissions() {
    try {
      const db = await openSubmissionArchive();
      if (!db) return [];
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        let records = [];
        request.onsuccess = () => {
          records = request.result || [];
          records.filter(item => typeof global.isImportedNbkSubmission === 'function' && global.isImportedNbkSubmission(item))
            .forEach(item => store.delete(item.id));
        };
        transaction.oncomplete = () => resolve(mergeSubmissionCollections(records));
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Không đọc được kho bài nộp IndexedDB:', error);
      return [];
    }
  }

  async function archiveSubmissionsLocally(items, options = {}) {
    const list = mergeSubmissionCollections(items || []);
    if (!list.length) return 0;
    try {
      const db = await openSubmissionArchive();
      if (!db) return 0;
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        list.forEach(item => store.put(item));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      if (!options.silent) notifyArchiveChanged();
      return list.length;
    } catch (error) {
      console.warn('Không lưu được kho bài nộp IndexedDB:', error);
      return 0;
    }
  }

  async function deleteArchivedSubmission(id) {
    if (!id) return false;
    try {
      const db = await openSubmissionArchive();
      if (!db) return false;
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(String(id));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      notifyArchiveChanged();
      return true;
    } catch (error) {
      console.warn('Không xóa được bài nộp khỏi IndexedDB:', error);
      return false;
    }
  }

  let channel = null;
  try { channel = 'BroadcastChannel' in global ? new BroadcastChannel(CHANNEL_NAME) : null; } catch (error) {}

  function notifyArchiveChanged() {
    try { channel?.postMessage({ type: 'changed', at: Date.now() }); } catch (error) {}
    global.dispatchEvent(new CustomEvent('submission-archive-change'));
  }

  if (channel) {
    channel.onmessage = event => {
      if (event.data?.type === 'changed') global.dispatchEvent(new CustomEvent('submission-archive-change'));
    };
  }

  global.mergeSubmissionCollections = mergeSubmissionCollections;
  global.loadArchivedSubmissions = loadArchivedSubmissions;
  global.archiveSubmissionsLocally = archiveSubmissionsLocally;
  global.deleteArchivedSubmission = deleteArchivedSubmission;
})(window);
