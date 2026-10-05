import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRoomJoinUrl, resolveRoomPin } from '../src/lib/roomJoinUrl.mjs';

test('QR URL usa a origem do frontend e contém somente o PIN como parâmetro', () => {
  const result = new URL(buildRoomJoinUrl('012345', 'https://quiz-seplag-1.onrender.com'));

  assert.equal(result.origin, 'https://quiz-seplag-1.onrender.com');
  assert.equal(result.pathname, '/join');
  assert.deepEqual([...result.searchParams.entries()], [['pin', '012345']]);
  assert.equal(result.hash, '');
});

test('PIN do caminho existente tem precedência e QR aceita PIN válido na query', () => {
  assert.equal(resolveRoomPin('654321', '012345'), '654321');
  assert.equal(resolveRoomPin(undefined, '012345'), '012345');
});

test('PIN ausente ou malformado é recusado e PIN inválido não vira URL', () => {
  assert.equal(resolveRoomPin(undefined, null), null);
  assert.equal(resolveRoomPin(undefined, '123'), null);
  assert.equal(resolveRoomPin(undefined, '12345x'), null);
  assert.throws(() => buildRoomJoinUrl('123', 'https://example.com'));
});
