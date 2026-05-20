import { createMatchRoom, joinMatchRoom } from './firebase';
import { getDatabase, ref, set, get, update } from 'firebase/database';

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase/database', () => ({
  __esModule: true,
  getDatabase: jest.fn(() => ({})), // Mock database object so !database check passes
  ref: jest.fn().mockImplementation((db, path) => ({ isMockRef: true, path })),
  set: jest.fn(() => Promise.resolve()),
  get: jest.fn(),
  onValue: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
}));

describe('createMatchRoom', () => {
  beforeAll(() => {
    // Math.random() in createMatchRoom generates string of max length 6:
    // Math.random().toString(36).substring(2, 8).toUpperCase()
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a room with default deck when customDeck is not provided', async () => {
    const mockDate = 1620000000000;
    jest.spyOn(Date, 'now').mockReturnValue(mockDate);

    // Using default Math.random behaviour

    ref.mockImplementation((db, path) => ({ isMockRef: true, path }));
    const hostName = 'Alice';
    const roomCode = await createMatchRoom(hostName);

    expect(roomCode).toBeTruthy();
    expect(typeof roomCode).toBe('string');
    expect(roomCode.length).toBeLessThanOrEqual(6);

    expect(ref).toHaveBeenCalledWith(expect.anything(), `matchRooms/${roomCode}`);

    expect(set).toHaveBeenCalledWith({ isMockRef: true, path: `matchRooms/${roomCode}` }, expect.objectContaining({
      hostName: 'Alice',
      status: 'waiting',
      createdAt: mockDate,
    }));

    // Check if default deck was created and shuffled (849 cards)
    const setCallArgs = set.mock.calls[0][1];
    expect(setCallArgs.deck).toBeInstanceOf(Array);
    expect(setCallArgs.deck).toHaveLength(849);

    // Verify it contains numbers from 1 to 849
    expect(setCallArgs.deck).toContain(1);
    expect(setCallArgs.deck).toContain(849);

    // Clean up
    jest.restoreAllMocks();
  });

  it('should create a room with custom deck when provided', async () => {
    const mockDate = 1620000000000;
    jest.spyOn(Date, 'now').mockReturnValue(mockDate);

    ref.mockImplementation((db, path) => ({ isMockRef: true, path }));
    const hostName = 'Bob';
    const customDeck = [10, 20, 30];
    const roomCode = await createMatchRoom(hostName, customDeck);

    expect(set).toHaveBeenCalledWith({ isMockRef: true, path: `matchRooms/${roomCode}` }, expect.objectContaining({
      hostName: 'Bob',
      status: 'waiting',
      createdAt: mockDate,
    }));

    const setCallArgs = set.mock.calls[0][1];
    expect(setCallArgs.deck).toBeInstanceOf(Array);
    expect(setCallArgs.deck).toHaveLength(3);
    expect(setCallArgs.deck).toEqual(expect.arrayContaining([10, 20, 30]));

    jest.restoreAllMocks();
  });

  it('should generate a 6 character uppercase alphanumeric room code', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const roomCode = await createMatchRoom('Charlie');

    expect(roomCode).toBe("4FZZZX");

    jest.restoreAllMocks();
  });
});

describe('joinMatchRoom cooperative logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should filter out unreleased movies, filter out mutual likes, and apply correct scoring priorities', async () => {
    // host preferences:
    // hostDecisions: movie 1, 2, 3, and 776 are liked
    // hostFavorites: movie 1 is favorite
    // hostStopGenres: ["ужасы"]
    // deck: [1, 2, 3, 4, 5, 776] (candidate pool)
    const hostDecisions = {
      "1": "like",
      "2": "like",
      "3": "like",
      "776": "like"
    };
    const hostFavorites = {
      "1": true
    };
    const hostStopGenres = ["ужасы"];
    const mockRoomData = {
      hostName: 'HostUser',
      status: 'waiting',
      deck: [1, 2, 3, 4, 5, 776],
      hostDecisions,
      hostFavorites,
      hostStopGenres,
      createdAt: 123456789
    };

    const snapshot = {
      exists: () => true,
      val: () => mockRoomData
    };
    
    const { get: mockGet, update: mockUpdate } = require('firebase/database');
    mockGet.mockResolvedValue(snapshot);
    mockUpdate.mockResolvedValue(true);

    // Guest preferences:
    // guestDecisions: movie 2 is liked (mutual like!), movie 4 is liked (guest only like)
    // guestFavorites: movie 4 is favorite
    // guestStopGenres: ["аниме"]
    const guestDecisions = {
      "2": "like",
      "4": "like"
    };
    const guestFavorites = {
      "4": true
    };
    const guestStopGenres = ["аниме"];

    const success = await joinMatchRoom('ROOM123', 'GuestUser', guestDecisions, guestFavorites, guestStopGenres);
    expect(success).toBe(true);

    expect(mockGet).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();

    // Verify the arguments passed to update:
    const updateCallArgs = mockUpdate.mock.calls[0][1];
    expect(updateCallArgs.guestName).toBe('GuestUser');
    expect(updateCallArgs.status).toBe('active');
    expect(updateCallArgs.guestStopGenres).toEqual(["аниме"]);

    // Let's analyze the expected final deck:
    // Candidate IDs: [1, 2, 3, 4, 5, 776]
    // 1. Movie 776 is unreleased (releaseDate: "2027-04-05") -> must be excluded!
    // 2. Movie 2 is liked by both (mutual like) -> must be excluded!
    // Remaining pool: [1, 3, 4, 5]
    //
    // Priorities check:
    // Movie 1, 3, 4 must be prioritized over movie 5 (regular movie)
    const finalDeck = updateCallArgs.deck;
    expect(finalDeck).toBeInstanceOf(Array);
    expect(finalDeck).not.toContain(776);
    expect(finalDeck).not.toContain(2);
    expect(finalDeck).toContain(1);
    expect(finalDeck).toContain(3);
    expect(finalDeck).toContain(4);
    expect(finalDeck).toContain(5);

    const idx1 = finalDeck.indexOf(1);
    const idx3 = finalDeck.indexOf(3);
    const idx4 = finalDeck.indexOf(4);
    const idx5 = finalDeck.indexOf(5);

    expect(idx1).toBeLessThan(idx5);
    expect(idx3).toBeLessThan(idx5);
    expect(idx4).toBeLessThan(idx5);
  });

  it('should not crash when parameters are null, undefined or empty, and should omit undefined/empty fields from the database payload', async () => {
    const mockRoomData = {
      hostName: 'HostUser',
      status: 'waiting',
      deck: [1, 2, 3, 4, 5],
      createdAt: 123456789
      // hostDecisions, hostFavorites, hostStopGenres are omitted (empty)
    };

    const snapshot = {
      exists: () => true,
      val: () => mockRoomData
    };
    
    const { get: mockGet, update: mockUpdate } = require('firebase/database');
    mockGet.mockResolvedValue(snapshot);
    mockUpdate.mockResolvedValue(true);

    // Call joinMatchRoom with null/undefined values
    const success = await joinMatchRoom('ROOM123', 'GuestUser', null, undefined, null);
    expect(success).toBe(true);

    expect(mockUpdate).toHaveBeenCalled();
    const updateCallArgs = mockUpdate.mock.calls[0][1];
    
    // Check that optional fields were not added to payload as undefined or empty objects/arrays
    expect(updateCallArgs.guestDecisions).toBeUndefined();
    expect(updateCallArgs.guestFavorites).toBeUndefined();
    expect(updateCallArgs.guestStopGenres).toBeUndefined();
    expect(updateCallArgs.guestName).toBe('GuestUser');
    expect(updateCallArgs.status).toBe('active');
    expect(updateCallArgs.deck).toBeInstanceOf(Array);
  });
});

describe('createMatchRoom sanitization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should omit empty or null/undefined decisions, favorites, and stopGenres from the database payload', async () => {
    const { set: mockSet } = require('firebase/database');
    mockSet.mockResolvedValue(true);

    const roomCode = await createMatchRoom('HostUser', [1, 2], null, undefined, null);
    expect(roomCode).toBeTruthy();

    expect(mockSet).toHaveBeenCalled();
    const setCallArgs = mockSet.mock.calls[0][1];

    expect(setCallArgs.hostName).toBe('HostUser');
    expect(setCallArgs.status).toBe('waiting');
    expect(setCallArgs.deck).toEqual(expect.arrayContaining([1, 2]));
    expect(setCallArgs.hostDecisions).toBeUndefined();
    expect(setCallArgs.hostFavorites).toBeUndefined();
    expect(setCallArgs.hostStopGenres).toBeUndefined();
  });
});
