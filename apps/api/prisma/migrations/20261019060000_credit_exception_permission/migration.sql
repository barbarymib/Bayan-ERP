-- R4-B9: dedicated credit.exception.approve permission for granting a credit-limit exception.
INSERT INTO "Permission" (code, "nameAr")
VALUES ('credit.exception.approve', 'اعتماد استثناء تجاوز الحد الائتماني')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p.code = 'credit.exception.approve'
  AND r.code IN ('ADMIN', 'OWNER', 'ACCOUNTANT', 'REP_SUPERVISOR')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
