-- R3-B14: dedicated statement.cancel permission (was gated by statement.edit).
-- Grants to the roles that may cancel a price statement (ADMIN auto via seed matrix;
-- here we cover existing DBs without a full re-seed).
INSERT INTO "Permission" (code, "nameAr")
VALUES ('statement.cancel', 'إلغاء بيان أسعار')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p.code = 'statement.cancel'
  AND r.code IN ('ADMIN', 'OWNER', 'ACCOUNTANT', 'REP_SUPERVISOR')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
