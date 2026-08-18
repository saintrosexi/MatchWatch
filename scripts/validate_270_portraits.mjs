// Validate live HTTP/CDN status of all 270 actor portrait URLs in src/data/actors.js
import assert from 'node:assert';
import { actorsData } from '../src/data/actors.js';

console.log('================================================================');
console.log('  VALIDATING ALL 270 CURATED ACTOR PORTRAITS (LIVE HTTP/CDN)   ');
console.log('================================================================\n');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const actorEntries = Object.entries(actorsData).map(([key, data]) => ({
  key,
  name: data.name,
  nameEn: data.nameEn,
  photo: data.photo
}));

console.log(`Loaded ${actorEntries.length} curated actors.`);

async function checkSingleUrl(item, retry = 5) {
  const userAgent = 'MatchWatch/3.0 (https://matchwatch.app; contact@matchwatch.app)';
  try {
    const res = await fetch(item.photo, {
      method: 'HEAD',
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(10000)
    });

    if (res.status === 429 && retry > 0) {
      const retryAfter = Number(res.headers.get('retry-after')) || 6;
      console.log(`    [429 Rate Limit] Backing off for ${retryAfter}s on ${item.key}...`);
      await sleep((retryAfter + 1) * 1000);
      return checkSingleUrl(item, retry - 1);
    }

    const ok = res.status >= 200 && res.status < 400;
    return {
      ...item,
      status: res.status,
      contentType: res.headers.get('content-type') || '',
      ok
    };
  } catch (err) {
    if (retry > 0) {
      await sleep(2000);
      return checkSingleUrl(item, retry - 1);
    }
    return {
      ...item,
      status: 'NETWORK_ERROR',
      error: err.message,
      ok: false
    };
  }
}

async function run() {
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < actorEntries.length; i++) {
    const item = actorEntries[i];
    const res = await checkSingleUrl(item);
    results.push(res);
    
    if (!res.ok) {
      console.error(`  ❌ [${i + 1}/270] Failed: ${item.key} | ${item.photo} | Status: ${res.status}`);
    } else {
      if ((i + 1) % 30 === 0 || i === actorEntries.length - 1) {
        console.log(`  ✓ Checked ${i + 1}/270 (${((i + 1) / 270 * 100).toFixed(0)}%) — Latest: ${item.key} (${res.status} ${res.contentType})`);
      }
    }
    await sleep(65);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const failed = results.filter((r) => !r.ok);

  console.log('\n----------------------------------------------------------------');
  console.log(`Validation Completed in ${duration}s.`);
  console.log(`Total: ${results.length} | Succeeded: ${results.length - failed.length} | Failed: ${failed.length}`);
  console.log('----------------------------------------------------------------\n');

  if (failed.length > 0) {
    console.error('FAILED ACTORS:');
    failed.forEach((f) => console.error(` - ${f.key}: ${f.photo} (${f.status})`));
    process.exit(1);
  } else {
    console.log('🎉 ALL 270 CURATED ACTOR PORTRAITS ARE 100% HEALTHY AND REACHABLE!');
    process.exit(0);
  }
}

run();
