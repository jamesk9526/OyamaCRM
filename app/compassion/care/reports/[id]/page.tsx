"use client";
import { useParams } from "next/navigation";
import { CareCard, CareError, CareHeading, useCareData } from "@/app/components/compassion/care-ui";
interface Report { title: string; client: { firstName: string; lastName: string }; version: number; content: Record<string, unknown>; signedAt: string; signedById: string; signatureDigest: string }
export default function SignedCareReport() {
  const { id } = useParams<{ id: string }>(); const { data, error, loading } = useCareData<Report>(`/api/compassion/charts/${id}/report`);
  return <><CareHeading title={data?.title || "Signed clinical report"} description="A preserved chart version with electronic sign-off provenance."><button className="care-button" disabled={!data} onClick={() => window.print()}>Print / Save PDF</button></CareHeading><CareError error={error} />{loading && <p role="status">Loading report…</p>}{data && <CareCard title={`${data.client.firstName} ${data.client.lastName}`} description={`Chart version ${data.version}`}><div className="care-card-body space-y-5">{Object.entries(data.content).map(([key, value]) => <section key={key}><h2>{key.replace(/([a-z])([A-Z])/g, "$1 $2")}</h2><p className="whitespace-pre-wrap break-words">{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}</p></section>)}<hr /><p>Electronically signed by user {data.signedById} on {new Date(data.signedAt).toLocaleString()}.</p><p className="break-all text-xs">Integrity reference: {data.signatureDigest}</p></div></CareCard>}</>;
}
