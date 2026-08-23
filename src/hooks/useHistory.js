import { useState, useCallback } from 'react';

const MAX_HISTORY = 50;

/**
 * useHistory — Undo/Redo state management hook conforming to React 19 concurrent safety.
 *
 * @param {any} initialState - The initial state value
 * @returns {[any, function, object]} - [state, setState, historyControls]
 *   historyControls: { undo, redo, canUndo, canRedo, historyLength }
 */
export default function useHistory(initialState) {
  const [historyState, setHistoryState] = useState({
    past: [],
    present: initialState,
    future: [],
  });

  const setState = useCallback((updater) => {
    setHistoryState((curr) => {
      const newPresent = typeof updater === 'function' ? updater(curr.present) : updater;

      // Don't push if the new state is identical (deep compare via JSON)
      if (JSON.stringify(curr.present) === JSON.stringify(newPresent)) {
        return curr;
      }

      return {
        past: [...curr.past, curr.present].slice(-MAX_HISTORY),
        present: newPresent,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistoryState((curr) => {
      if (curr.past.length === 0) return curr;

      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, -1);

      return {
        past: newPast,
        present: previous,
        future: [...curr.future, curr.present],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistoryState((curr) => {
      if (curr.future.length === 0) return curr;

      const next = curr.future[curr.future.length - 1];
      const newFuture = curr.future.slice(0, -1);

      return {
        past: [...curr.past, curr.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  return [
    historyState.present,
    setState,
    {
      undo,
      redo,
      canUndo: historyState.past.length > 0,
      canRedo: historyState.future.length > 0,
      historyLength: historyState.past.length,
    },
  ];
}
