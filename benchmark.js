const { performance } = require('perf_hooks');

const friends = {};
for (let i = 0; i < 20; i++) {
  friends[`uid${i}`] = `Friend ${i}`;
}

const getMock = async (uid) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ exists: () => true, val: () => 'avatar_url' });
    }, 50); // mock network latency
  });
};

const runSequential = async () => {
  const start = performance.now();
  const avatars = {};
  for (const uid of Object.keys(friends)) {
    try {
      const snap = await getMock(uid);
      if (snap.exists()) {
        avatars[uid] = snap.val();
      }
    } catch (e) {
      console.error(e);
    }
  }
  const end = performance.now();
  return end - start;
};

const runParallel = async () => {
  const start = performance.now();
  const avatars = {};
  await Promise.all(Object.keys(friends).map(async (uid) => {
    try {
      const snap = await getMock(uid);
      if (snap.exists()) {
        avatars[uid] = snap.val();
      }
    } catch (e) {
      console.error(e);
    }
  }));
  const end = performance.now();
  return end - start;
};

const run = async () => {
  const seqTime = await runSequential();
  console.log(`Sequential time: ${seqTime.toFixed(2)}ms`);

  const parTime = await runParallel();
  console.log(`Parallel time: ${parTime.toFixed(2)}ms`);

  console.log(`Improvement: ${((seqTime - parTime) / seqTime * 100).toFixed(2)}%`);
};

run();
