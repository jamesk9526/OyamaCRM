import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { careRows, resetCareRows } from "../helpers/compassion-memory-database";
vi.mock("@/server/src/lib/prisma",async()=>({prisma:(await import("../helpers/compassion-memory-database")).careMemoryDatabase}));
import authRouter from "@/server/src/routes/auth";
import { hashPassword, signRefreshToken } from "@/server/src/lib/auth";
const app=express();app.use(express.json(),cookieParser());app.use("/api/auth",authRouter);
beforeEach(async()=>{resetCareRows();careRows.user=[{id:"reviewer",organizationId:"org",email:"reviewer@example.invalid",role:"compassion_user",active:true,passwordHash:await hashPassword("synthetic reviewer password")}];careRows.compassionMembership=[{organizationId:"org",userId:"reviewer",role:"ULTRASOUND_REVIEWER",active:true}];});
it("does not issue ordinary CRM tokens through password login",async()=>{
  const result=await request(app).post("/api/auth/login").send({email:"reviewer@example.invalid",password:"synthetic reviewer password"});
  expect(result.status).toBe(403);expect(result.body.error.code).toBe("REVIEWER_PORTAL_REQUIRED");expect(result.headers["set-cookie"]).toBeUndefined();expect(careRows.refreshToken||[]).toHaveLength(0);
});
it("revokes an old refresh token instead of upgrading it to a general session",async()=>{
  const token=signRefreshToken("reviewer");careRows.refreshToken=[{userId:"reviewer",token,expiresAt:new Date(Date.now()+60000)}];
  const result=await request(app).post("/api/auth/refresh").set("Cookie",`oyama_refresh=${token}`);
  expect(result.status).toBe(403);expect(result.body.data?.accessToken).toBeUndefined();expect(careRows.refreshToken).toHaveLength(0);
});
