import { Card } from "@/components/ui/neu-card";
import { ApprovalQueue } from "@/components/coverage/approval-queue";
import { requireOrganizer } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getApprovalQueue } from "@/lib/scheduling/data";

export const dynamic = "force-dynamic";

export default async function ApprovalPage() {
  const context = await requireOrganizer();
  const isAdmin = context.profile.role === "admin";

  let eventIds: string[] | undefined;
  if (!isAdmin) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("event_directors")
      .select("event_id")
      .eq("user_id", context.user.id);
    // .select() on this table's own row type resolves to `never` here, the same @supabase/ssr
    // typing gap src/lib/scheduling/data.ts's getEventDirectors() works around with a cast, not a
    // real runtime concern.
    eventIds = ((data ?? []) as { event_id: string }[]).map((row) => row.event_id);
  }

  const queue = await getApprovalQueue(isAdmin ? {} : { eventIds });
  const eventsWithRows = queue.filter((event) => event.rows.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-text-primary">Approval queue</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Assignments waiting on approval before they count as confirmed.
        </p>
      </div>

      {eventsWithRows.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">Nothing waiting on approval.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {eventsWithRows.map((event) => (
            <li key={event.eventId}>
              <Card title={event.eventName}>
                <ApprovalQueue rows={event.rows} eventTimezone={event.eventTimezone} canApprove={isAdmin} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
