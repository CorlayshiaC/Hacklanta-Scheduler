import Link from "next/link";
import { CreateEventForm } from "@/components/events/create-event-form";
import { requireOrganizer } from "@/lib/scheduling/authorization";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireOrganizer();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Link className="text-sm font-medium text-purple-400" href="/events">
        Events
      </Link>
      <h1 className="mt-2 text-3xl font-semibold text-text-primary">Create event</h1>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        A lightweight scheduling context. It starts as a draft, invisible to members until you
        publish it.
      </p>
      <div className="mt-6">
        <CreateEventForm />
      </div>
    </div>
  );
}
