import assert from 'node:assert/strict';
import { createPreviewStore } from './store.ts';

const store = createPreviewStore();
assert.equal(store.list().length, 2);
assert.throws(() => store.create('  '), /Enter/);
store.create('  New project  ');
assert.equal(store.list()[2].name, 'New project');
const copy = store.list();
copy[0].name = 'Changed';
assert.equal(store.list()[0].name, 'Demo workspace');
assert.equal(createPreviewStore().list().length, 2);
assert.throws(() => store.unsupported('payment'), /PREVIEW_ONLY/);
console.log('Preview store: passed');
