import { redirect } from "next/navigation";

interface WebmasterLegacyBuilderRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Legacy builder route shim that forwards to the new visual editor workspace. */
export default async function WebmasterBuilderPage({ searchParams }: WebmasterLegacyBuilderRouteProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
      return;
    }
    query.set(key, value);
  });

  const suffix = query.toString();
  redirect(`/webmaster/editor${suffix ? `?${suffix}` : ""}`);
}
