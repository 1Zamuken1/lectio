-- Se ejecuta solo la primera vez que se crea el volumen de Postgres.
-- Base aparte para los tests de integración: se vacía entre tests sin tocar la de desarrollo.
CREATE DATABASE lectio_test OWNER lectio;
