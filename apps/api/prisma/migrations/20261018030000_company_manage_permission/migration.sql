-- R3-B15: dedicated company.manage permission (tenant writes its own company settings).
INSERT INTO "Permission" (code, "nameAr")
VALUES ('company.manage', 'إدارة إعدادات الشركة (الضريبة)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p.code = 'company.manage'
  AND r.code IN ('ADMIN', 'OWNER')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
