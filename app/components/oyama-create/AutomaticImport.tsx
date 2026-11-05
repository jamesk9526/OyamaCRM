"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { useCreate } from "./CreateShell";
import { message } from "./types";
const ensured=new Set<string>();
export default function AutomaticImport(){
  const {user}=useAuth(),{permissions}=useCreate(),[error,setError]=useState("");
  useEffect(()=>{if(!user||user.role!=="admin"||!permissions.includes("edit:communications")||!permissions.includes("letters.edit")||!permissions.includes("letters.create")||ensured.has(user.organizationId))return;let active=true;void apiFetch("/api/oyama-create/imports/ensure",{method:"POST",body:"{}"}).then(()=>{ensured.add(user.organizationId);}).catch(value=>{if(active)setError(message(value));});return()=>{active=false;};},[user,permissions]);
  return error?<div className="oc-error" role="alert">Automatic content import could not start: {error} <Link href="/oyama-create/library/legacy">Review import setup</Link></div>:null;
}
