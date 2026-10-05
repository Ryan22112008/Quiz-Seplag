import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectPodiumEntries } from '../src/lib/finalPodium.mjs';

describe('pódio final', () => {
  it('usa apenas as três posições determinadas pelo servidor', () => {
    const ranking = [
      { position: 1, playerName: 'Ana', score: 400 },
      { position: 2, playerName: 'Bia', score: 300 },
      { position: 3, playerName: 'Caio', score: 200 },
      { position: 4, playerName: 'Davi', score: 100 },
    ];
    assert.deepEqual(selectPodiumEntries(ranking), ranking.slice(0, 3));
  });

  it('mostra somente os participantes existentes quando há menos de três', () => {
    const one = [{ position: 1, playerName: 'Ana', score: 400 }];
    const two = [...one, { position: 2, playerName: 'Bia', score: 300 }];
    assert.deepEqual(selectPodiumEntries(one), one);
    assert.deepEqual(selectPodiumEntries(two), two);
    assert.deepEqual(selectPodiumEntries([]), []);
  });

  it('preserva a ordenação e os dados recebidos do ranking', () => {
    const tiedRanking = [
      { position: 1, playerName: 'Ana', score: 400 },
      { position: 2, playerName: 'Bia', score: 400 },
      { position: 3, playerName: 'Caio', score: 300 },
    ];
    assert.deepEqual(selectPodiumEntries(tiedRanking), tiedRanking);
  });
});
