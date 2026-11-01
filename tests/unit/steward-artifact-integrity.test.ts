import { describe, it, expect } from "vitest";
import { sanitizeArtifact } from "../../server/src/steward/sanitize.js";
describe("Steward numeric evidence integrity", () => {
 it("rejects missing and misaligned chart values instead of inventing zero", () => {
  for (const data of [[null, 10], [10], [Infinity, 10]]) {
   expect(sanitizeArtifact({type:"chart",labels:["Jan","Feb"],series:[{name:"Giving",data}]})).toBeNull();
  }
 });
 it("preserves actual zero and aligned finite values", () => {
  expect(sanitizeArtifact({type:"chart",labels:["Jan","Feb"],series:[{name:"Giving",data:[0,10]}]})?.series).toMatchObject([{data:[0,10]}]);
 });
 it("omits malformed report chart data and invalid trends", () => {
  const result=sanitizeArtifact({type:"report_card",metrics:[{label:"Giving",value:"10",trend:"invented"}],chartData:{labels:["Jan"],values:[null]}});
  expect(result?.chartData).toBeUndefined();
  expect(result?.metrics).toMatchObject([{trend:undefined}]);
 });
});
