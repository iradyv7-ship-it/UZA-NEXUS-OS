-- Remove 'customer' from RoleName. Nexus is the internal operating layer; a customer never
-- authenticates into it — see packages/contracts/src/permissions.ts. Confirmed zero rows used
-- this value in both User.role and RoleAssignment.role before writing this migration.
BEGIN;

CREATE TYPE "RoleName_new" AS ENUM (
  'ceo',
  'venture_manager',
  'china_sourcing',
  'china_warehouse',
  'front_office',
  'finance',
  'sales_agent',
  'logistics_partner'
);

ALTER TABLE "User" ALTER COLUMN "role" TYPE "RoleName_new" USING ("role"::text::"RoleName_new");
ALTER TABLE "RoleAssignment" ALTER COLUMN "role" TYPE "RoleName_new" USING ("role"::text::"RoleName_new");

ALTER TYPE "RoleName" RENAME TO "RoleName_old";
ALTER TYPE "RoleName_new" RENAME TO "RoleName";
DROP TYPE "RoleName_old";

COMMIT;
