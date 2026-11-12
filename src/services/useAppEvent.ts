import { useEffect, useRef } from 'react';
import { events, type AppEventHandler, type AppEventName } from './events';

/** Subscribes a component to an app event for its lifetime. The handler may change between renders. */
export function useAppEvent<K extends AppEventName>(name: K, handler: AppEventHandler<K>): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => events.on(name, (payload) => ref.current(payload)), [name]);
}
