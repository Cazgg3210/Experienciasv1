-- Revocación de sesiones del equipo (BUG-001 / BUG-004): versión por usuaria que se compara contra la del JWT.
-- Aditiva y segura en producción: columna NOT NULL con DEFAULT 0 (las sesiones vigentes, sin versión en el JWT, cuentan como 0).
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;
