import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import MatchWatch from './MatchWatch';
import { auth, createMatchRoom, subscribeToRoom, inviteToMatchWatch } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, get } from 'firebase/database';

jest.mock('../firebase', () => ({
  auth: { currentUser: { uid: 'user1', displayName: 'User One', email: 'user@test.com' } },
  database: {},
  createMatchRoom: jest.fn(),
  joinMatchRoom: jest.fn(),
  swipeMovie: jest.fn(),
  subscribeToRoom: jest.fn(),
  inviteToMatchWatch: jest.fn(),
  removeInvite: jest.fn(),
  removeSwipe: jest.fn()
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn()
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  set: jest.fn(),
  onValue: jest.fn(),
  get: jest.fn()
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => {
      const { initial, animate, exit, transition, ...rest } = props;
      return <div {...rest}>{children}</div>;
    }
  },
  AnimatePresence: ({ children }) => <>{children}</>
}));

describe('MatchWatch testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display an alert when inviteToMatchWatch throws an error', async () => {
    // 1. Setup mock data
    onAuthStateChanged.mockImplementation((authObj, callback) => {
      callback({ uid: 'user1', displayName: 'User One', email: 'user@test.com' });
      return () => {}; // unsubscribe fn
    });

    // Mock onValue to return some friends
    onValue.mockImplementation((dbRef, callback) => {
      callback({
        val: () => ({
          'friend1': 'Friend One'
        })
      });
      return () => {};
    });

    // Mock get to return no avatar to simplify
    get.mockResolvedValue({
      exists: () => false,
      val: () => null
    });

    createMatchRoom.mockResolvedValue('ROOM123');

    // Make subscribeToRoom return a mock unsubscribe function
    subscribeToRoom.mockReturnValue(() => {});

    // 2. Setup window.alert mock
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

    // 3. Mock inviteToMatchWatch to throw an error
    const errorMessage = 'Network error during invite';
    inviteToMatchWatch.mockRejectedValue(new Error(errorMessage));

    // 4. Render component
    await act(async () => {
      render(<MatchWatch />);
    });

    // 5. Navigate to waiting screen (click create room)
    const createRoomBtn = screen.getByText('🎬 Создать комнату');
    fireEvent.click(createRoomBtn);

    // Now in "create" screen
    const nameInput = screen.getByPlaceholderText('Ваше имя');
    fireEvent.change(nameInput, { target: { value: 'User One' } });

    const startBtn = screen.getByText('Создать');

    await act(async () => {
      fireEvent.click(startBtn);
    });

    // Wait for waiting screen to appear
    await waitFor(() => {
      expect(screen.getByText(/Лобби ожидания/)).toBeInTheDocument();
    });

    // 6. Click on "Позвать друга"
    const inviteFriendBtn = screen.getByText('➕ Позвать друга');
    fireEvent.click(inviteFriendBtn);

    // 7. Click on "Позвать" for friend1
    const callBtn = await screen.findByText('Позвать');

    await act(async () => {
      fireEvent.click(callBtn);
    });

    // 8. Wait for alert to be called and verify
    await waitFor(() => {
      expect(inviteToMatchWatch).toHaveBeenCalledWith('friend1', 'ROOM123', 'User One');
      expect(alertMock).toHaveBeenCalledWith(errorMessage);
    });

    alertMock.mockRestore();
  });

  it('should display success alert when inviteToMatchWatch succeeds', async () => {
    // 1. Setup mock data
    onAuthStateChanged.mockImplementation((authObj, callback) => {
      callback({ uid: 'user1', displayName: 'User One', email: 'user@test.com' });
      return () => {};
    });

    onValue.mockImplementation((dbRef, callback) => {
      callback({ val: () => ({ 'friend1': 'Friend One' }) });
      return () => {};
    });

    get.mockResolvedValue({ exists: () => false, val: () => null });
    createMatchRoom.mockResolvedValue('ROOM123');
    subscribeToRoom.mockReturnValue(() => {});

    // 2. Setup window.alert mock
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

    // 3. Mock inviteToMatchWatch to succeed
    inviteToMatchWatch.mockResolvedValue();

    // 4. Render component
    await act(async () => {
      render(<MatchWatch />);
    });

    // 5. Navigate to waiting screen
    fireEvent.click(screen.getByText('🎬 Создать комнату'));
    fireEvent.change(screen.getByPlaceholderText('Ваше имя'), { target: { value: 'User One' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Создать'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Лобби ожидания/)).toBeInTheDocument();
    });

    // 6. Click invite
    fireEvent.click(screen.getByText('➕ Позвать друга'));

    // 7. Click call
    const callBtn = await screen.findByText('Позвать');
    await act(async () => {
      fireEvent.click(callBtn);
    });

    // 8. Verify success alert
    await waitFor(() => {
      expect(inviteToMatchWatch).toHaveBeenCalledWith('friend1', 'ROOM123', 'User One');
      expect(alertMock).toHaveBeenCalledWith('Приглашение отправлено Friend One!');
    });

    alertMock.mockRestore();
  });
});
