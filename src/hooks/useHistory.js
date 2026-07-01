import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY = 50;

/**
 * useHistory — Undo/Redo state management hook.
 *
 * @param {any} initialState - The initial state value
 * @returns {[any, function, object]} - [state, setState, historyControls]
 *   historyControls: { undo, redo, canUndo, canRedo, historyLength }
 */
export default function useHistory(initialState) {
  const [state, setInternalState] = useState(initialState);
  const pastRef = useRef([]); // Stack of previous states
  const futureRef = useRef([]); // Stack of undone states

  const setState = useCallback((updater) => {
    setInternalState((prev) => {
      const newState = typeof updater === 'function' ? updater(prev) : updater;

      // Don't push if the new state is identical (deep compare via JSON)
      if (JSON.stringify(prev) === JSON.stringify(newState)) {
        return prev;
      }

      // Push current state to past
      pastRef.current = [...pastRef.current, prev].slice(-MAX_HISTORY);

      // Clear future on new change (standard undo/redo behavior)
      futureRef.current = [];

      return newState;
    });
  }, []);

  const undo = useCallback(() => {
    setInternalState((prev) => {
      if (pastRef.current.length === 0) return prev;

      const previous = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);

      // Push current to future
      futureRef.current = [...futureRef.current, prev];

      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setInternalState((prev) => {
      if (futureRef.current.length === 0) return prev;

      const next = futureRef.current[futureRef.current.length - 1];
      futureRef.current = futureRef.current.slice(0, -1);

      // Push current to past
      pastRef.current = [...pastRef.current, prev];

      return next;
    });
  }, []);

  // We need a way to read past/future lengths reactively.
  // Since refs don't trigger re-render, we derive from state changes.
  // The trick: canUndo/canRedo are checked on each render.
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  return [
    state,
    setState,
    {
      undo,
      redo,
      canUndo,
      canRedo,
      historyLength: pastRef.current.length,
    },
  ];
}
