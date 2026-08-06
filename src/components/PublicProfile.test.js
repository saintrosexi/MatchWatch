import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublicProfile from './PublicProfile';
import { getPublicProfileByUsername } from '../firebase';

jest.mock('../firebase', () => ({
  auth: { currentUser: { uid: 'user1', displayName: 'Саня (@sanya)', email: 'sanya@test.com' } },
  database: {},
  getPublicProfileByUsername: jest.fn(),
  sendFriendRequest: jest.fn(),
  removeFriend: jest.fn(),
  inviteToMatchWatch: jest.fn(),
  createMatchRoom: jest.fn()
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((auth, cb) => {
    cb({ uid: 'user1', displayName: 'Саня (@sanya)', email: 'sanya@test.com' });
    return () => {};
  })
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  set: jest.fn(),
  onValue: jest.fn((ref, cb) => {
    cb({ exists: () => false, val: () => ({}) });
    return () => {};
  })
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => {
      const { initial, animate, exit, transition, whileHover, whileTap, ...rest } = props;
      return <div {...rest}>{children}</div>;
    }
  },
  AnimatePresence: ({ children }) => <>{children}</>
}));

describe('PublicProfile Component (M1 Requirements)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('firebase/database').onValue.mockReturnValue(() => {});
  });

  test('displays loading indicator initially', () => {
    getPublicProfileByUsername.mockImplementation(() => new Promise(() => {}));
    render(<PublicProfile tag="alex" />);
    expect(screen.getByText(/Загрузка.../i)).toBeInTheDocument();
  });

  test('displays "Пользователь не найден" banner when user does not exist in DB', async () => {
    getPublicProfileByUsername.mockResolvedValue({ success: false, error: 'USER_NOT_FOUND' });

    render(<PublicProfile tag="nonexistent_user" onBackToApp={jest.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText(/Загрузка.../i)).not.toBeInTheDocument();
    });

    expect(screen.getAllByText('Пользователь не найден').length).toBeGreaterThan(0);
  });

  test('displays "Пользователь не найден" banner immediately when tag is null or empty', async () => {
    render(<PublicProfile tag="" onBackToApp={jest.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText(/Загрузка.../i)).not.toBeInTheDocument();
    });

    expect(screen.getAllByText('Пользователь не найден').length).toBeGreaterThan(0);
  });

  test('displays "Это ваш профиль" panel when tag matches authenticated user', async () => {
    getPublicProfileByUsername.mockResolvedValue({
      success: true,
      uid: 'user1',
      profile: { username: 'sanya', name: 'Саня' },
      appData: { decisions: {} }
    });

    render(<PublicProfile tag="sanya" user={{ uid: 'user1', displayName: 'Саня (@sanya)' }} />);

    await waitFor(() => {
      expect(screen.queryByText(/Загрузка.../i)).not.toBeInTheDocument();
    });

    expect(screen.getByText('Это ваш профиль')).toBeInTheDocument();
    expect(screen.queryByText('➕ Добавить в друзья')).not.toBeInTheDocument();
  });

  test('renders user tag without "#undefined" when tag has no "#"', async () => {
    getPublicProfileByUsername.mockResolvedValue({
      success: true,
      uid: 'user2',
      profile: { username: 'alex', name: 'Alex' },
      appData: { decisions: {} }
    });

    render(<PublicProfile tag="alex" user={{ uid: 'user1' }} />);

    await waitFor(() => {
      expect(screen.queryByText(/Загрузка.../i)).not.toBeInTheDocument();
    });

    const nameHeader = document.querySelector('.profile-display-name');
    expect(nameHeader).toHaveTextContent(/alex/i);
    expect(screen.queryByText(/#undefined/i)).not.toBeInTheDocument();
  });

  test('renders tag discriminator correctly when tag contains "#"', async () => {
    getPublicProfileByUsername.mockResolvedValue({
      success: true,
      uid: 'user3',
      profile: { username: 'alex', tag: '@alex#1234', name: 'Alex' },
      appData: { decisions: {} }
    });

    render(<PublicProfile tag="Alex#1234" user={{ uid: 'user1' }} />);

    await waitFor(() => {
      expect(screen.queryByText(/Загрузка.../i)).not.toBeInTheDocument();
    });

    expect(screen.getAllByText(/Alex/i).length).toBeGreaterThan(0);
    expect(screen.getByText('#1234')).toBeInTheDocument();
  });
});
