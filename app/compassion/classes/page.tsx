import ClassesWorkspace from "@/app/components/compassion/ClassesWorkspace";
export default async function ClassesPage({searchParams}:{searchParams:Promise<{clientId?:string}>}) { const query=await searchParams; return <ClassesWorkspace initialClientId={query.clientId} />; }
