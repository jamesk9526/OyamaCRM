import { Suspense } from "react";
import AdminCommunity from "@/app/components/community/AdminCommunity";
export default function CommunityPage() { return <Suspense fallback={<p role="status">Loading community…</p>}><AdminCommunity /></Suspense>; }
