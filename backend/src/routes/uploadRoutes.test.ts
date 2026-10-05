import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import express from 'express';

const storage = await mkdtemp(join(tmpdir(), 'quiz-seplag-upload-'));
process.env.UPLOADS_DIR = storage;
const { createUploadRoutes } = await import('./uploadRoutes.js');
const app = express().use(createUploadRoutes());
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Servidor de teste não iniciou.');
const baseUrl = `http://127.0.0.1:${address.port}`;
const validPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/3uoAAAAASUVORK5CYII=', 'base64');

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(storage, { recursive: true, force: true });
});

describe('uploads de imagem', () => {
  it('armazena arquivo validado em disco e o serve após recriar a rota', async () => {
    const form = new FormData();
    form.append('image', new Blob([validPng], { type: 'image/png' }), 'pergunta.png');
    const uploadResponse = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: form });
    assert.equal(uploadResponse.status, 201);
    const { imageUrl } = await uploadResponse.json() as { imageUrl: string };
    assert.match(imageUrl, /^\/uploads\/[a-f0-9-]{36}\.png$/u);
    const saved = await readFile(join(storage, imageUrl.split('/').pop()!));
    assert.deepEqual(saved, validPng);
    const freshServer = express().use(createUploadRoutes()).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => freshServer.once('listening', resolve));
    const freshAddress = freshServer.address();
    if (!freshAddress || typeof freshAddress === 'string') throw new Error('Novo servidor de teste não iniciou.');
    const imageResponse = await fetch(`http://127.0.0.1:${freshAddress.port}${imageUrl}`);
    assert.equal(imageResponse.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), validPng);
    await new Promise<void>((resolve, reject) => freshServer.close((error) => error ? reject(error) : resolve()));
  });

  it('recusa conteúdo que não corresponde ao MIME e extensão', async () => {
    const form = new FormData();
    form.append('image', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
    const response = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: form });
    assert.equal(response.status, 400);
  });

  it('recusa imagem acima do limite de 5 MB', async () => {
    const form = new FormData();
    form.append('image', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png');
    const response = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: form });
    assert.equal(response.status, 413);
  });
});
