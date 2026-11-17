import test from 'node:test'
import assert from 'node:assert/strict'
import { ProviderRequestQueue } from '../../scripts/ai-uat/provider-request-queue'

test('concurrent AI decisions are serialized and spaced across clients', async () => {
  let now = 0
  const starts: number[] = []
  const queue = new ProviderRequestQueue({ minIntervalMs: 13000, now: () => now, sleep: async ms => { now += ms } })
  await Promise.all([1,2,3].map(() => queue.run(async () => { starts.push(now); return new Response('{}') })))
  assert.deepEqual(starts, [0,13000,26000])
})

test('429 honors provider RetryInfo and 503 retries with increasing backoff', async () => {
  let now = 0
  const starts: number[] = []
  const queue = new ProviderRequestQueue({ minIntervalMs: 13000, now: () => now, sleep: async ms => { now += ms } })
  const responses = [new Response(JSON.stringify({error:{details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'17.5s'}]}}),{status:429}),new Response('{}',{status:503}),new Response('{}')]
  const response=await queue.run(async()=>{starts.push(now);return responses.shift()!})
  assert.equal(response.status,200)
  assert.deepEqual(starts,[0,17500,30500])
})

test('Retry-After header is honored, retries are bounded, and permanent failures are not retried', async () => {
  let now=0, attempts=0
  const queue=new ProviderRequestQueue({minIntervalMs:13000,maxAttempts:3,now:()=>now,sleep:async ms=>{now+=ms}})
  const response=await queue.run(async()=>{attempts++;return new Response('{}',{status:429,headers:{'Retry-After':'60'}})})
  assert.equal(response.status,429);assert.equal(attempts,3);assert.equal(now,120000)
  attempts=0
  assert.equal((await queue.run(async()=>{attempts++;return new Response('{}',{status:401})})).status,401)
  assert.equal(attempts,1)
})

test('malformed Retry-After does not discard valid RetryInfo, and long quota waits remain blocked', async () => {
  let now=0, attempts=0
  const queue=new ProviderRequestQueue({minIntervalMs:13000,now:()=>now,sleep:async ms=>{now+=ms}})
  await queue.run(async()=> ++attempts===1
    ? new Response(JSON.stringify({error:{details:[{retryDelay:'45s'}]}}),{status:429,headers:{'Retry-After':'invalid'}})
    : new Response('{}'))
  assert.equal(now,45000)
  attempts=0
  const blocked=await queue.run(async()=>{attempts++;return new Response('{}',{status:429,headers:{'Retry-After':'86400'}})})
  assert.equal(blocked.status,429)
  assert.equal(attempts,1)
})

test('transient request aborts retry within the same paced queue', async () => {
  let now=0, attempts=0
  const queue=new ProviderRequestQueue({minIntervalMs:13000,now:()=>now,sleep:async ms=>{now+=ms}})
  const response=await queue.run(async()=>{if(++attempts<3)throw new DOMException('Aborted','AbortError');return new Response('{}')})
  assert.equal(response.status,200);assert.equal(attempts,3);assert.equal(now,26000)
})
