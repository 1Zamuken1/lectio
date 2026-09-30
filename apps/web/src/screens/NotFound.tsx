import { Link } from 'react-router';

export function NotFound() {
  return (
    <main className="not-found">
      <h1>Esta página no está en la estantería</h1>
      <p>
        <Link to="/biblioteca">Volver a la biblioteca</Link>
      </p>
    </main>
  );
}
