import assert from 'node:assert/strict';
import { MDU_KNOWLEDGE_BASE, buildMduSystemInstruction } from '../lib/knowledge/mdu-guide.ts';

const prompt = buildMduSystemInstruction();
assert.ok(prompt.includes('Digi.AI'), 'Must contain bot name Digi.AI');
assert.ok(prompt.includes('Digiverse AI'), 'Must contain Digiverse AI');
assert.ok(prompt.includes('Mandiri Digital Universe'), 'Must contain company name');
assert.ok(prompt.includes('OJT'), 'Must contain OJT instructions');
assert.ok(prompt.includes('Mentor'), 'Must contain Mentor instructions');
assert.ok(Array.isArray(MDU_KNOWLEDGE_BASE) && MDU_KNOWLEDGE_BASE.length >= 3, 'Must contain at least 3 categories');
console.log('Knowledge base tests passed!');

