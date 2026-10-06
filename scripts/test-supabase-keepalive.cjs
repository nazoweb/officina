const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('app/api/cron/supabase-keepalive/route.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function run(env, authorization, fetchImplementation) {
  let calls = 0;
  const context = {
    exports: {}, require, Buffer, Response, AbortSignal,
    process: { env },
    console: { error() {}, info() {} },
    fetch: async (...args) => { calls++; return fetchImplementation(...args); },
  };
  vm.runInNewContext(compiled, context);
  const request = new Request('https://example.test/api/cron/supabase-keepalive', {
    headers: authorization ? { authorization } : {},
  });
  const response = await context.exports.GET(request);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return { response, calls };
}

(async () => {
  const env = {
    CRON_SECRET: 'test-only-secret',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co/',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
  };
  for (const authorization of [undefined, 'Bearer wrong', 'Bearer same-size-secret']) {
    const result = await run(env, authorization, () => { throw new Error('Must not query'); });
    assert.equal(result.response.status, 401);
    assert.equal(result.calls, 0);
  }
  const missing = await run({}, 'Bearer test-only-secret');
  assert.equal(missing.response.status, 503);
  assert.equal(missing.calls, 0);
  const noConfig = await run({ CRON_SECRET: env.CRON_SECRET }, 'Bearer test-only-secret');
  assert.equal(noConfig.response.status, 503);
  assert.equal(noConfig.calls, 0);
  const success = await run(env, 'Bearer test-only-secret', (url, options) => {
    assert.equal(url, 'https://example.supabase.co/rest/v1/products?select=id&limit=1');
    assert.equal(options.method, 'HEAD');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.apikey, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    assert.equal(Object.keys(options.headers).length, 1);
    assert.ok(options.signal);
    return new Response(null, { status: 200 });
  });
  assert.equal(success.response.status, 200);
  assert.deepEqual(await success.response.json(), { ok: true });
  assert.equal(success.calls, 1);
  for (const implementation of [() => new Response(null, { status: 403 }), () => { throw new Error('timeout'); }]) {
    const failed = await run(env, 'Bearer test-only-secret', implementation);
    assert.equal(failed.response.status, 502);
    assert.equal(failed.calls, 1);
    assert.deepEqual(await failed.response.json(), { ok: false });
  }
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.deepEqual(config.crons, [{ path: '/api/cron/supabase-keepalive', schedule: '0 8 * * *' }]);
  console.log('Supabase keepalive: authorization, HEAD-only query, errors and daily schedule passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
