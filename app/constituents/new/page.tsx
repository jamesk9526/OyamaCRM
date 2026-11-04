import ConstituentForm from "@/app/components/constituents/ConstituentForm";
import Link from "next/link";

export default async function NewConstituentPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const query = await searchParams;
  const volunteer = query.type === "VOLUNTEER";
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/constituents" className="hover:text-green-600 transition-colors">Constituents</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">New Constituent</span>
      </nav>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">{volunteer ? "Add New Volunteer" : "Add New Constituent"}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a new donor, volunteer, member, or prospect record.</p>
      </div>

      <ConstituentForm mode="create" initialData={volunteer ? { type: "VOLUNTEER" } : undefined} />
    </div>
  );
}
