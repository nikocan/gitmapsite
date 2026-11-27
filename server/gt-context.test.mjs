import test from "node:test";
import assert from "node:assert/strict";
import gt from "../skills/gt-context.js";

test("GT carries schema and aggregates without row data",()=>{
  const payload=structuredClone(gt.GT_SAMPLE);
  payload.tables[0].rows=[{customer:"excluded"}];
  payload.credentials={token:"excluded"};
  assert.deepEqual(gt.gtSnapshot(payload),gt.GT_SAMPLE);
});
test("GT rejects dangling evidence and invalid signal counts",()=>{
  const invalidLink={...gt.GT_SAMPLE,links:[["HASAR.MISSING","POLICE.ID"]]};
  assert.throws(()=>gt.gtSnapshot(invalidLink));
  for(const count of [-1,1.5,"3"])
    assert.throws(()=>gt.gtSnapshot({...gt.GT_SAMPLE,signals:[{code:"PENDING",severity:"warning",count}]}));
});
