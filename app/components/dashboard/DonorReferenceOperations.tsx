"use client";
import { CalendarDays, CheckSquare, Gift } from "lucide-react";
import type { DashboardData } from "@/app/features/donor-dashboard/types";
import TasksWidget from "./TasksWidget";
import MeetingsWidget from "./MeetingsWidget";
import RecentGiftsTable from "./RecentGiftsTable";
import DashboardSectionCard from "./shared/DashboardSectionCard";

export default function DonorReferenceOperations({ data, loading, unavailable, revision }: { data: DashboardData | null; loading: boolean; unavailable: boolean; revision: number }) {
  return <section className="donor-reference-operations" aria-label="Daily donor work">
    <DashboardSectionCard title="Recent Donations" icon={<Gift size={18} aria-hidden="true" />} href="/donations?allYears=1&status=COMPLETED">
      <RecentGiftsTable gifts={data?.recentDonations.slice(0, 5) ?? []} loading={loading} unavailable={unavailable} />
    </DashboardSectionCard>
    <DashboardSectionCard title="Tasks & Next Steps" icon={<CheckSquare size={18} aria-hidden="true" />} href="/tasks">
      <div className="donor-reference-task-content"><TasksWidget refreshVersion={revision} embedded /></div>
    </DashboardSectionCard>
    <DashboardSectionCard title="Upcoming Meetings" icon={<CalendarDays size={18} aria-hidden="true" />} href="/meetings">
      <div className="donor-reference-meeting-content"><MeetingsWidget refreshVersion={revision} /></div>
    </DashboardSectionCard>
  </section>;
}
