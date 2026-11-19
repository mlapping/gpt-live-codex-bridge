import assert from 'node:assert/strict'
import { install, translateInbound, translateOutbound } from '../desktop-plugin/plugin.js'
const one = a => { assert.equal(a.length, 1); return JSON.parse(a[0]) }
assert.deepEqual(one(translateInbound(JSON.stringify({type:'delegation.created',item:{id:'item_1',type:'delegation',target:'client'}}))),
  {type:'session.delegation.created',delegation:{id:'item_1',type:'delegation',target:'client'}})
assert.deepEqual(one(translateInbound(JSON.stringify({type:'input_transcript.added',start_ms:5,end_ms:9,item:{text:' hi'}}))),
  {type:'session.input_transcript.delta',delta:' hi',start_ms:5,end_ms:9})
assert.equal(one(translateInbound(JSON.stringify({type:'output_transcript.added',item:{text:'x'}}))).type,'session.output_transcript.delta')
const started = JSON.stringify({type:'session.started',session:{id:'s'}})
assert.deepEqual(translateInbound(started),[started])
assert.deepEqual(translateInbound('not json'),['not json'])
assert.deepEqual(one(translateOutbound(JSON.stringify({type:'session.commentary.append',delegation_id:'item_1',event_id:'say_1',content:'ok'})).send),
  {type:'delegation.context.append',delegation_item_id:'item_1',channel:'speakable',content:[{type:'input_text',text:'ok'}]})
assert.equal(one(translateOutbound(JSON.stringify({type:'session.thinking.append',delegation_id:'item_1',content:'w'})).send).channel,'commentary')
assert.equal(one(translateOutbound(JSON.stringify({type:'session.commentary.append',delegation_id:null,content:'ok'})).send).type,'session.context.append')
assert.equal(one(translateOutbound(JSON.stringify({type:'session.instructions.append',delegation_id:null,content:'slow down'})).send).type,'session.context.append')
assert.deepEqual(translateOutbound(JSON.stringify({type:'session.input_audio.mute'})).send,[])
assert.deepEqual(translateOutbound(JSON.stringify({type:'session.close'})),{send:[],closed:true})

// --- grace period on a recoverable `disconnected` (fake peer; only bridged calls are held)
class FakePeer extends EventTarget {
  connectionState = 'new'
  iceConnectionState = 'new'
  createDataChannel() { return Object.assign(new EventTarget(), { send() {}, readyState: 'open' }) }
  setRemoteDescription() { return Promise.resolve() }
  set(state) { this.connectionState = state; this.dispatchEvent(new Event('connectionstatechange')) }
}
globalThis.RTCPeerConnection = FakePeer
globalThis.__gptLiveCodexBridgeGraceMs = 60
install()
const sleep = ms => new Promise(r => setTimeout(r, ms))
const watch = peer => { const seen = []; peer.addEventListener('connectionstatechange', () => seen.push(peer.connectionState)); return seen }

const plain = new FakePeer(); const plainSeen = watch(plain)
plain.set('disconnected')
assert.deepEqual(plainSeen, ['disconnected'], 'unbridged calls are untouched')

const blip = new FakePeer(); const blipSeen = watch(blip)
await blip.setRemoteDescription({ type: 'answer', sdp: 'v=0\r\ns=hermes-codex-bridge\r\nt=0 0\r\n' })
blip.set('connected'); blip.set('disconnected')
assert.deepEqual(blipSeen, ['connected'], 'disconnected is held back')
blip.set('connected'); await sleep(120)
assert.deepEqual(blipSeen, ['connected', 'connected'], 'a recovered blip never reaches the client')

const dead = new FakePeer(); const deadSeen = watch(dead)
await dead.setRemoteDescription({ type: 'answer', sdp: 'v=0\ns=hermes-codex-bridge\nt=0 0\n' })
dead.set('disconnected'); await sleep(120)
assert.deepEqual(deadSeen, ['disconnected'], 'an unrecovered drop is delivered after the grace period')

const failed = new FakePeer(); const failedSeen = watch(failed)
await failed.setRemoteDescription({ type: 'answer', sdp: 'v=0\ns=hermes-codex-bridge\nt=0 0\n' })
failed.set('failed')
assert.deepEqual(failedSeen, ['failed'], 'failed passes immediately')
console.log('translation and grace-period tests passed')
