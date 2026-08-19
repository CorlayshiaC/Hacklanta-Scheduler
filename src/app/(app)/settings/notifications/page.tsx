import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotificationToggles } from "@/components/settings/notification-toggles";
import { scheduleNotificationEvents } from "@/lib/notifications/types";
import { setNotificationPreferenceAction } from "@/lib/settings/notification-actions";
// Agent 6's control, not restyled here (owned by src/components/polish/, see
// docs/contracts/requests.md "From Agent 6": mounted per their request, its own visual pass is
// their redesign work, not this one.
import { SoundToggle } from "@/components/polish/sound-manager";
import { PushNotificationToggle } from "@/components/settings/push-notification-toggle";

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
      <h1 className="font-display text-[20px] font-medium normal-case text-text-primary">Notifications</h1>
      <p className="mt-1 text-[13px] text-text-secondary">Choose how you hear about schedule changes.</p>

      <div className="mt-6">
        <NotificationToggles
          initialState={initialState}
          kinds={kinds}
          onToggle={setNotificationPreferenceAction}
        />
      </div>

      <div className="mt-6">
        <PushNotificationToggle />
      </div>

      {/* SoundToggle renders its own "Sound effects: on/off" label, no wrapping label needed. */}
      <div className="mt-6">
        <SoundToggle />
      </div>
    </div>
  );
}
