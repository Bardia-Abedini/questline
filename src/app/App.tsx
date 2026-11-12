import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { createAppRouter } from './router';
import { PreferencesSync } from './preferences/PreferencesSync';

export function App() {
  const [router] = useState(createAppRouter);
  useEffect(() => () => router.dispose(), [router]);
  return (
    <>
      <PreferencesSync />
      <RouterProvider router={router} />
    </>
  );
}
