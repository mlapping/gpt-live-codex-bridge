import assert from 'node:assert/strict'
import { translateInbound, translateOutbound } from '../desktop-plugin/plugin.js'
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
console.log('translation tests passed')
