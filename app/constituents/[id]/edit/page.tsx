import ConstituentForm from "@/app/components/constituents/ConstituentForm";
import Link from "next/link";
import { notFound } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getConstituent(id: string) {
  try {
    const res = await fetch(`${API}/api/constituents/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function EditConstituentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const constituent = await getConstituent(id);
  if (!constituent) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/constituents" className="hover:text-green-600 transition-colors">Constituents</Link>
        <span>/</span>
        <Link href={`/constituents/${id}`} className="hover:text-green-600 transition-colors">
          {constituent.firstName} {constituent.lastName}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Edit</span>
      </nav>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Edit Constituent</h1>
        <p className="text-sm text-gray-500 mt-0.5">Update profile information for {constituent.firstName} {constituent.lastName}.</p>
      </div>

      <ConstituentForm
        mode="edit"
        constituentId={id}
        initialData={constituent}
      />
    </div>
  );
}
