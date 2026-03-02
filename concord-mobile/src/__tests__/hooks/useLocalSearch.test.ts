// Tests for useLocalSearch hook

import { renderHook, act } from '@testing-library/react-native';
import { useLocalSearch } from '../../hooks/useLocalSearch';
import { useLatticeStore } from '../../store/lattice-store';
import type { DTUSearchResult } from '../../utils/types';

jest.mock('../../store/lattice-store');

const mockUseLatticeStore = useLatticeStore as unknown as jest.Mock;

const mockSearchResults: DTUSearchResult[] = [
  {
    id: 'dtu-001',
    type: 0x0001,
    timestamp: 1700000000000,
    tags: ['test', 'knowledge'],
    score: 0.95,
    snippet: 'A matching document about knowledge graphs',
  },
  {
    id: 'dtu-002',
    type: 0x0002,
    timestamp: 1700000001000,
    tags: ['data'],
    score: 0.72,
    snippet: 'Secondary result about data processing',
  },
];

interface MockLatticeState {
  searchQuery: string;
  searchResults: DTUSearchResult[];
  isSearching: boolean;
  setSearchQuery: jest.Mock;
  setSearchResults: jest.Mock;
  setSearching: jest.Mock;
}

function createMockState(overrides: Partial<MockLatticeState> = {}): MockLatticeState {
  return {
    searchQuery: '',
    searchResults: [],
    isSearching: false,
    setSearchQuery: jest.fn(),
    setSearchResults: jest.fn(),
    setSearching: jest.fn(),
    ...overrides,
  };
}

function setupStoreMock(state: MockLatticeState) {
  mockUseLatticeStore.mockImplementation((selector: (s: MockLatticeState) => any) => {
    return selector(state);
  });
}

describe('useLocalSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('returns empty query on init', () => {
      const state = createMockState();
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());
      expect(result.current.query).toBe('');
    });

    it('returns empty results on init', () => {
      const state = createMockState();
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());
      expect(result.current.results).toEqual([]);
    });

    it('returns isSearching false on init', () => {
      const state = createMockState();
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());
      expect(result.current.isSearching).toBe(false);
    });

    it('provides search and clear functions', () => {
      const state = createMockState();
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());
      expect(typeof result.current.search).toBe('function');
      expect(typeof result.current.clear).toBe('function');
    });
  });

  describe('search function', () => {
    it('sets the search query in the store', () => {
      const state = createMockState();
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());

      act(() => {
        result.current.search('knowledge graphs');
      });

      expect(state.setSearchQuery).toHaveBeenCalledWith('knowledge graphs');
    });

    it('sets isSearching to true for non-empty queries', () => {
      const state = createMockState();
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());

      act(() => {
        result.current.search('test query');
      });

      expect(state.setSearching).toHaveBeenCalledWith(true);
    });

    it('clears results and stops searching for empty query', () => {
      const state = createMockState();
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());

      act(() => {
        result.current.search('');
      });

      expect(state.setSearchResults).toHaveBeenCalledWith([]);
      expect(state.setSearching).toHaveBeenCalledWith(false);
    });

    it('clears results and stops searching for whitespace-only query', () => {
      const state = createMockState();
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());

      act(() => {
        result.current.search('   ');
      });

      expect(state.setSearchResults).toHaveBeenCalledWith([]);
      expect(state.setSearching).toHaveBeenCalledWith(false);
    });

    it('debounces search by 300ms', () => {
      const state = createMockState();
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());

      act(() => {
        result.current.search('hello');
      });

      // setSearching(true) called immediately
      expect(state.setSearching).toHaveBeenCalledWith(true);

      // After debounce, setSearching(false) is called
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(state.setSearching).toHaveBeenCalledWith(false);
    });

    it('cancels previous debounce when new search is issued', () => {
      const state = createMockState();
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());

      act(() => {
        result.current.search('first');
      });

      act(() => {
        jest.advanceTimersByTime(150);
      });

      // Reset tracking to observe only the second search debounce behavior
      state.setSearching.mockClear();

      act(() => {
        result.current.search('second');
      });

      expect(state.setSearchQuery).toHaveBeenCalledWith('second');

      // Only after another 300ms should debounce complete
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // setSearching(false) only called once for the second search's debounce
      const falseCalls = state.setSearching.mock.calls.filter(
        (args: [boolean]) => args[0] === false,
      );
      expect(falseCalls.length).toBe(1);
    });
  });

  describe('clear function', () => {
    it('resets query to empty string', () => {
      const state = createMockState({ searchQuery: 'existing query' });
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());

      act(() => {
        result.current.clear();
      });

      expect(state.setSearchQuery).toHaveBeenCalledWith('');
    });

    it('clears search results', () => {
      const state = createMockState({ searchResults: mockSearchResults });
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());

      act(() => {
        result.current.clear();
      });

      expect(state.setSearchResults).toHaveBeenCalledWith([]);
    });

    it('sets isSearching to false', () => {
      const state = createMockState({ isSearching: true });
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());

      act(() => {
        result.current.clear();
      });

      expect(state.setSearching).toHaveBeenCalledWith(false);
    });
  });

  describe('with populated results from store', () => {
    it('returns search results from the store', () => {
      const state = createMockState({
        searchQuery: 'knowledge',
        searchResults: mockSearchResults,
        isSearching: false,
      });
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());

      expect(result.current.query).toBe('knowledge');
      expect(result.current.results).toEqual(mockSearchResults);
      expect(result.current.results).toHaveLength(2);
    });

    it('reflects the isSearching state from the store', () => {
      const state = createMockState({ isSearching: true });
      setupStoreMock(state);
      const { result } = renderHook(() => useLocalSearch());
      expect(result.current.isSearching).toBe(true);
    });
  });
});
