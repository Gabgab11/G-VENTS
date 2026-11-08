// node --test .github/scripts/check-api-contract.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compare } from './check-api-contract.mjs';

const contract = () => ({
  info: { version: '1.0.0' },
  paths: {
    '/v1/events/{id}': {
      get: { parameters: [{ name: 'id', in: 'path', required: true }], responses: { 200: {} } },
      patch: {
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateEvent' } } } },
        responses: { 200: {} },
      },
    },
    '/v1/tickets/{code}/email': { post: { responses: { 202: {} } } },
  },
  components: { schemas: { UpdateEvent: { type: 'object', required: ['title'] } } },
});

test('an identical API is compatible', () => {
  assert.deepEqual(compare(contract(), contract()).problems, []);
});

test('additions on the API side are compatible', () => {
  const deployed = contract();
  deployed.paths['/v1/new'] = { get: { responses: { 200: {} } } };
  deployed.paths['/v1/events/{id}'].get.parameters.push({ name: 'expand', in: 'query', required: false });
  deployed.paths['/v1/events/{id}'].get.responses[404] = {};
  assert.deepEqual(compare(contract(), deployed).problems, []);
});

test('a renamed path parameter is the same route', () => {
  const deployed = contract();
  deployed.paths['/v1/events/{eventId}'] = deployed.paths['/v1/events/{id}'];
  delete deployed.paths['/v1/events/{id}'];
  assert.deepEqual(compare(contract(), deployed).problems, []);
});

test('a missing operation is reported with its real path', () => {
  const deployed = contract();
  delete deployed.paths['/v1/tickets/{code}/email'];
  assert.deepEqual(compare(contract(), deployed).problems, ['POST /v1/tickets/{code}/email: missing from the deployed API']);
});

test('new required parameters, body fields and removed success statuses are reported', () => {
  const deployed = contract();
  deployed.paths['/v1/events/{id}'].get.parameters.push({ name: 'tenant', in: 'query', required: true });
  deployed.components.schemas.UpdateEvent.required.push('timezone');
  deployed.paths['/v1/tickets/{code}/email'].post.responses = { 200: {} };
  assert.deepEqual(compare(contract(), deployed).problems, [
    'GET /v1/events/{id}: now requires query parameter tenant',
    'PATCH /v1/events/{id}: request body now requires "timezone"',
    'POST /v1/tickets/{code}/email: no longer answers 202',
  ]);
});

test('a newly required request body is reported', () => {
  const deployed = contract();
  deployed.paths['/v1/tickets/{code}/email'].post.requestBody = { required: true, content: {} };
  assert.deepEqual(compare(contract(), deployed).problems, ['POST /v1/tickets/{code}/email: now requires a request body']);
});
