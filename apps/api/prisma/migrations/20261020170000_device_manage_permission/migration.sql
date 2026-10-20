-- device.manage was present in EXTRA_ROLE_PERMISSIONS but never reached the DB
-- (no migration existed and the seed was not re-run), leaving the devices page
-- dead for every role. Follows the established permission-migration pattern.
INSERT INTO "Permission" (code, "nameAr")
VALUES ('device.manage', 'إدارة أجهزة المناديب (إبطال/تفعيل)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p.code = 'device.manage'
  AND r.code IN ('OWNER', 'REP_SUPERVISOR')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
