"use client";
import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { useCareData } from "./care-ui";
export interface ClientRecord {
  id:string;firstName:string;lastName:string;preferredName?:string;email?:string;phone?:string;addressLine1?:string;city?:string;state?:string;zip?:string;dateOfBirth?:string;clientStatus:string;intakeDate:string;referralSource?:string;privateNotes?:string;
  safeContact?:{phone?:boolean;email?:boolean;sms?:boolean;voicemail?:boolean};
  cases:Array<{id:string;caseNumber:string;caseStatus:string;summary?:string}>;
  appointments:Array<{id:string;startTime:string;appointmentType:string;status:string}>;
}
const Context=createContext<ReturnType<typeof useCareData<ClientRecord>>|null>(null);
/** The header, right rail and editor share one current client and refresh together. */
export function ClientFileProvider({children}:{children:React.ReactNode}) {
  const match=/^\/compassion\/clients\/([^/]+)/.exec(usePathname());const id=match&&match[1]!=="merge"?match[1]:null;
  const record=useCareData<ClientRecord>(id?`/api/compassion/clients/${encodeURIComponent(id)}`:null);
  return <Context.Provider value={record}>{children}</Context.Provider>;
}
export function useCurrentClient(){const record=useContext(Context);if(!record)throw new Error("Client file provider required");return record;}
