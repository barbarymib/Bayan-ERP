'use client';

import { useEffect, useState } from 'react';

/**
 * useDebounce: Delays updating the debounced value until after the specified delay has passed
 * since the last time the input value changed.
 *
 * @param value The value to debounce (e.g. search input string)
 * @param delayMs Delay in milliseconds (default: 300ms)
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * useUnsavedChanges: Warns the user when trying to close the tab or reload while form is dirty.
 *
 * @param isDirty Boolean indicating whether the user has unsubmitted input
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);
}
