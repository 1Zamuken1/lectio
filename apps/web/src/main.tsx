import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/atkinson-hyperlegible/400-italic.css';
import '@fontsource-variable/literata/opsz.css';
import '@fontsource-variable/literata/opsz-italic.css';
import '@fontsource-variable/pixelify-sans/index.css';
// Orden de la CLI: el CSS de las pantallas primero; el del tema sobrescribe sus tokens.
import './styles/reader.css';
import './styles/library.css';
import './styles/scriptorium.css';
import './styles/app.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AppProvider, createServices } from './app/context';
import { Layout } from './app/Layout';
import { Study } from './screens/Study';
import { NotFound } from './screens/NotFound';
import { PublicLibrary } from './screens/PublicLibrary';
import { Reader } from './screens/Reader';
import { TitleScreen } from './screens/TitleScreen';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <TitleScreen /> },
      { path: '/biblioteca', element: <PublicLibrary /> },
      { path: '/estudio', element: <Study /> },
      { path: '/celda', element: <Navigate to="/estudio" replace /> },
      { path: '/leer/:id', element: <Reader /> },
      { path: '/libros/:slug', element: <Reader /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <AppProvider services={createServices()}>
      <RouterProvider router={router} />
    </AppProvider>
  </StrictMode>,
);
