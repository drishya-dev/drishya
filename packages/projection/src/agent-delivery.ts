import type {Observation} from '@drishya/contracts';

/**
 * The pre-CONTENT-11b Codex adapter emitted a non-main assistant observation only
 * for native response_item:agent_message. Ordinary messages always used MAIN;
 * ingest did not override that identity. This guard is specific to that adapter,
 * never a text classifier over user messages or another harness's child prose.
 */
export function legacyAgentDelivery(o:Observation,text:string,address?:string) {
  if(o.source.adapterId!=='codex'||o.kind!=='message.assistant'||o.agentId==='agent:main'||(o.payload as Record<string,unknown>).delivery)return;
  const envelope=legacyDeliveryEnvelope(text);
  if(!envelope||o.agentId!==`agent:${envelope.sender.split('/').at(-1)}`||address&&address!==envelope.sender)return;
  return envelope;
}

/** Shape only; callers must have adapter/provenance evidence before omitting the wrapper. */
export function legacyDeliveryEnvelope(text:string) {
  const m=/^Message Type: (MESSAGE|FINAL_ANSWER|NEW_TASK)\r?\nTask name: (\/root(?:\/[^\s]+)?)\r?\nSender: (\/root\/[^\s]+)\r?\nPayload:(?:\r?\n| ?)([\s\S]*)$/.exec(text);
  if(!m)return;
  return {type:m[1]!,recipient:m[2]!,sender:m[3]!,text:m[4]!};
}
