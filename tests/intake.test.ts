import test from 'node:test';
import assert from 'node:assert/strict';
import { readIntake, IntakeError, intakeFailure } from '../lib/intake';
import { publicPassageWhere, publicQuestionWhere, publicClaimWhere, publicSourceFragmentWhere } from '../lib/publication';
function request(body = '{}', headers: Record<string,string> = {}) {
  return new Request('http://localhost:34391/api/questions', { method: 'POST', headers: { origin: 'http://localhost:34391', 'content-type': 'application/json', ...headers }, body });
}
test('intake accepts only a bounded same-origin JSON object', async()=>{
  assert.deepEqual(await readIntake(request('{"text":"Question"}')), { text: 'Question' });
  for(const [input, code] of [
    [request('{}',{origin:'https://attacker.invalid'}),'origin_not_allowed'],
    [request('{}',{'content-type':'text/plain'}),'json_required'],
    [request('null'),'invalid_json'], [request('[]'),'invalid_json'], [request('{'),'invalid_json'],
    [request(JSON.stringify({text:'x'.repeat(13000)})),'body_too_large'],
  ] as const) await assert.rejects(readIntake(input), (e: unknown)=>e instanceof IntakeError && e.code === code);
});
test('intake failure never exposes DB messages or source input', async()=>{
  const response = intakeFailure(new Error('database-password-and-private-question'));
  assert.equal(response.status,503); assert.equal(await response.text(),'{"error":"temporarily_unavailable"}');
  assert.equal(intakeFailure(new IntakeError(429,'rate_limited')).headers.get('retry-after'),'60');
});
test('every public query requires reviewed publication and rights',()=>{
  assert.equal(publicQuestionWhere.reviewStatus,'PUBLISHED');
  assert.equal(publicPassageWhere.reviewStatus,'PUBLISHED');
  assert.equal(publicSourceFragmentWhere.reviewStatus,'PUBLISHED');
  assert.equal(publicClaimWhere.sourceFragment.is.reviewStatus,'PUBLISHED');
  assert.deepEqual(publicPassageWhere.source.is.rightsStatus.in,['PUBLIC_DOMAIN','LICENSED','PERMISSION_GRANTED']);
});
