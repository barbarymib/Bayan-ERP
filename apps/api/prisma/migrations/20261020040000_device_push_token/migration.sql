-- F2 (§5.15): رمز دفع FCM لجهاز المندوب — يُخزَّن مع تسجيل الجهاز لاستهدافه بالإشعارات

ALTER TABLE public."DeviceRegistration" ADD COLUMN "pushToken" TEXT;
