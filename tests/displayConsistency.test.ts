import test from 'node:test';
import assert from 'node:assert/strict';
import { aud, profitability, type JobProfitability } from '../shared/jobCosting';
import { awaitingQuoteResponse, jobDisplayStatus, quoteDisplayStatus } from '../src/lib/quoteDisplay';

const job:JobProfitability={
  jobId:'one',jobName:'Example',clientName:'Client',status:'sent',quotedExGst:27100,
  quoteStatus:'approved',quoteIsEstimate:false,invoicedExGst:27100,approvedVariationsExGst:0,
  confirmedCostsExGst:689.96,confirmedCostsIncGst:758.97,draftCostsExGst:500,draftCostsIncGst:550,
  costsByCategory:{Materials:689.96,Labour:0,Subcontractor:0,'Plant/Equipment':0,Other:0},
};
test('the brief’s Jobs and Profitability example shares the recorded inclusive-cost basis',()=>{
  for(const basis of ['quoted','invoiced'] as const){
    const result=profitability(job,basis);
    assert.equal(result.profit,26341.03);
    assert.equal(result.margin?.toFixed(1),'97.2');
    assert.equal(aud(result.revenue!),'$27,100.00');
  }
  assert.equal(profitability(job,'quoted','ex-gst').profit,26410.04);
  assert.equal(job.confirmedCostsIncGst,758.97);
});
test('inclusive cost basis does not add GST to GST-free receipts or deduct drafts',()=>{
  const result=profitability({...job,quotedExGst:1000,confirmedCostsExGst:150,confirmedCostsIncGst:160},'quoted');
  assert.equal(result.profit,840);
  assert.equal(result.margin,84);
});
test('missing and zero revenues remain distinct and never produce nonfinite margins',()=>{
  assert.equal(profitability({...job,quotedExGst:null},'quoted').profit,null);
  assert.equal(profitability({...job,quotedExGst:0},'quoted').margin,null);
});
test('job and quote lifecycles are distinct, with completed and in-progress jobs taking priority',()=>{
  assert.equal(jobDisplayStatus({status:'sent'},{status:'draft'}),'lead');
  assert.equal(jobDisplayStatus({status:'draft'},{status:'sent'}),'quoted');
  assert.equal(jobDisplayStatus({status:'sent'},{status:'approved'}),'approved');
  assert.equal(jobDisplayStatus({status:'in_progress'},{status:'sent'}),'in_progress');
  assert.equal(jobDisplayStatus({status:'completed'},{status:'sent'}),'completed');
  assert.equal(quoteDisplayStatus({status:'revised'}),'draft');
  assert.equal(quoteDisplayStatus({status:'sent',valid_until:'2000-01-01T00:00:00Z'}),'expired');
});
test('a sent quote on an active or completed job is not counted again as awaiting response',()=>{
  const sent={status:'sent'};
  assert.equal(awaitingQuoteResponse({status:'sent'},sent),true);
  for(const status of ['in_progress','completed','acknowledged'] as const)
    assert.equal(awaitingQuoteResponse({status},sent),false);
  assert.equal(awaitingQuoteResponse({status:'draft'},{status:'draft'}),false);
  assert.equal(awaitingQuoteResponse({status:'sent'},{status:'sent',valid_until:'2000-01-01T00:00:00Z'}),false);
});
