import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberEventDetail } from "@/components/member/member-event-detail";
import { getMemberEventDetail } from "@/lib/member/events";

export const dynamic = "force-dynamic";

type MyEventDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MyEventDetailPage({ params }: MyEventDetailPageProps) {
  const { id } = await params;
  const detail = await getMemberEventDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Link className="text-sm font-medium text-accent-go" href="/my-events">
        Events
      </Link>
      <MemberEventDetail data={detail} />
    </div>
  );
}
