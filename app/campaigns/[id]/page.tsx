"use client";
import { useParams } from "next/navigation";
import FinancialCampaignDetail from "@/app/components/campaigns/FinancialCampaignDetail";
export default function CampaignDetailPage() { const params = useParams<{ id: string }>(); return <FinancialCampaignDetail campaignId={params.id}/>; }
