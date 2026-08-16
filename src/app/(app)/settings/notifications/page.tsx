import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotificationToggles } from "@/components/settings/notification-toggles";
import { scheduleNotificationEvents } from "@/lib/notifications/types";
import { setNotificationPreferenceAction } from "@/lib/settings/notification-actions";

export const dynamic = "force-dynamic";

type NotificationPreferenceRow = { kind: string; channel: string; enabled: boolean };

// No loading state needed here: this page is fully server rendered with no client side fetch.
export default async function NotificationsSettingsPage() {
  const { user } = await requireAuthenticatedUser();

  const kinds = Object.entries(scheduleNotificationEvents).map(([key, value]) => ({ key, value }));

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("kind,channel,enabled")
    .eq("profile_id", user.id);
  // Same select-string inference workaround as src/lib/auth/authorization.ts.
  const rows = (data as NotificationPreferenceRow[] | null) ?? [];

  // A missing row means "enabled": the table has no row until a member changes a default, so
  // every kind/channel combination starts true and only reflects a stored row when one exists.
  const initialState = Object.fromEntries(
    kinds.map(({ key }) => {
      const emailRow = rows.find((row) => row.kind === key && row.channel === "email");
      const inAppRow = rows.find((row) => row.kind === key && row.channel === "in_app");
      return [
        key,
        { email: emailRow?.enabled ?? true, inApp: inAppRow?.enabled ?? true },
      ];
    }),
  );

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-100">Notifications</h1>
      <p className="mt-1 text-sm text-zinc-500">Choose how you hear about schedule changes.</p>

      <div className="mt-6">
        <NotificationToggles
          initialState={initialState}
          kinds={kinds}
          onToggle={setNotificationPreferenceAction}
        />
      </div>
    </div>
  );
}
