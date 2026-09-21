-- Adds `pending` to RoleName: the role a self-served Google sign-up holds until the CEO
-- approves it (no grants anywhere — see ROLE_GRANTS.pending). Hand-authored; there was no
-- local Postgres to run `prisma migrate dev` against on this machine. Applied on deploy by
-- the API container's `prisma migrate deploy`.
--
-- ALTER TYPE ... ADD VALUE cannot run inside the same transaction as a statement that uses
-- the new value, which is why this migration does nothing else.
ALTER TYPE "RoleName" ADD VALUE 'pending';
