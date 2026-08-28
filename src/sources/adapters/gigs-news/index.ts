import type { GigSource } from '../../../knowledge/types.js';
import { registerSourceAdapter, type SourceAdapter } from '../../runner/adapter.js';
import type { FetchedSource, ParsedSource, SourceRunContext } from '../../runner/types.js';
import type { AcquisitionRouter } from '../../runner/acquisition.js';
import { normaliseGigsNewsGig } from './normalise.js';
import { parseGigsNewsPage } from './parse.js';
import { editionIsFresh } from './staleness.js';
export const GIGS_NEWS_ADAPTER_ID='gigs-news';
export const gigsNewsAdapter:SourceAdapter={
 async fetch(config:GigSource,run:SourceRunContext,acquisition:AcquisitionRouter):Promise<FetchedSource>{
  if(!config.url)throw new Error('GigsNews source URL is required');
  const browser=config.runtimeClass==='browser';
  const fetched=await acquisition.acquire({
   url:config.url,
   kind:browser?'text':'html',
   ...(browser?{bodyMode:'innerText' as const,settleMs:2000}:{followRedirects:true,maxRedirects:3}),
   timeoutMs:30000,
   maxBytes:2*1024*1024,
   complete:true,
   fetchMethod:browser?'chromium-innerText':'http-html',
  });
  const fresh=editionIsFresh(fetched.body,run.runDate);
  return{...fetched,complete:fetched.complete&&fresh,captureStable:fresh};
 },
 async parse(_config:GigSource,run:SourceRunContext,raw:FetchedSource):Promise<ParsedSource>{const year=Number.parseInt(run.runDate.slice(0,4),10);const parsed=parseGigsNewsPage(raw.body,year);if(parsed.gigs.length===0&&parsed.parked.length===0)throw new Error('GigsNews structural gate failed: rendered page produced zero recognised rows');const events=parsed.gigs.map(normaliseGigsNewsGig);const defaulted=parsed.gigs.filter(g=>g.timeDefaulted).length;return{events,parked:parsed.parked.map(i=>({reason:i.reason,raw:{date:i.date,line:i.rawLine}})),warnings:defaulted?[`${defaulted} gig time(s) defaulted to 20:00`]:[]};}
};
registerSourceAdapter(GIGS_NEWS_ADAPTER_ID,gigsNewsAdapter);
