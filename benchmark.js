const { performance } = require('perf_hooks');

const simulateDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const mockGet = async (uid) => {
    await simulateDelay(50); // 50ms latency per request
    return { exists: () => true, val: () => 'http://example.com/avatar.png' };
};

const friends = {
    '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E',
    '6': 'F', '7': 'G', '8': 'H', '9': 'I', '10': 'J'
};

const fetchAvatarsSequential = async () => {
    const avatars = {};
    for (const uid of Object.keys(friends)) {
        try {
            const snap = await mockGet(uid);
            if (snap.exists()) {
                avatars[uid] = snap.val();
            }
        } catch (e) {
            console.error(e);
        }
    }
    return avatars;
};

const fetchAvatarsParallel = async () => {
    const avatars = {};
    const promises = Object.keys(friends).map(async (uid) => {
        try {
            const snap = await mockGet(uid);
            if (snap.exists()) {
                return { uid, val: snap.val() };
            }
        } catch (e) {
            console.error(e);
        }
        return null;
    });

    const results = await Promise.all(promises);
    for (const res of results) {
        if (res) {
            avatars[res.uid] = res.val;
        }
    }
    return avatars;
};

const runBenchmark = async () => {
    const start1 = performance.now();
    await fetchAvatarsSequential();
    const end1 = performance.now();
    console.log(`Sequential: ${end1 - start1} ms`);

    const start2 = performance.now();
    await fetchAvatarsParallel();
    const end2 = performance.now();
    console.log(`Parallel: ${end2 - start2} ms`);
};

runBenchmark();
