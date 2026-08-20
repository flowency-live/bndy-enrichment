import type { KnowledgeBuildResult, KlmaNormalisedEvent } from './klma-source.js';
import type { ProjectionResult } from './bndy-projector.js';

export type GraphNode = {
  id: string;
  type: 'source' | 'observation' | 'artist-candidate' | 'venue-candidate' | 'event-candidate' | 'artist' | 'venue' | 'event';
  label: string;
  data: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  claimId?: string;
};

export type KnowledgeGraph = {
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_.:-]/g, '_');
}

export function buildKnowledgeGraph(
  knowledge: KnowledgeBuildResult,
  events: KlmaNormalisedEvent[],
  projections: ProjectionResult[],
): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  const ensureNode = (node: GraphNode): void => {
    const existing = nodes.get(node.id);
    if (existing) {
      nodes.set(node.id, { ...existing, data: { ...existing.data, ...node.data } });
      return;
    }
    nodes.set(node.id, node);
  };

  const addEdge = (edge: GraphEdge): void => {
    edges.set(edge.id, edge);
  };

  const sourceNodeId = `source:${knowledge.observation.sourceId}`;
  const observationNodeId = `observation:${knowledge.observation.id}`;
  ensureNode({
    id: sourceNodeId,
    type: 'source',
    label: 'KLMA Stoke Gig List',
    data: { sourceId: knowledge.observation.sourceId, sourceUrl: knowledge.observation.sourceUrl },
  });
  ensureNode({
    id: observationNodeId,
    type: 'observation',
    label: `Observation ${knowledge.observation.observedAt.slice(0, 19)}`,
    data: { ...knowledge.observation },
  });
  addEdge({ id: `edge:${safeId(sourceNodeId)}:${safeId(observationNodeId)}`, source: sourceNodeId, target: observationNodeId, label: 'observed' });

  const eventByKey = new Map(events.map((event) => [event.sourceEventKey, event]));

  for (const candidate of knowledge.candidates) {
    const event = eventByKey.get(candidate.sourceEventKey);
    if (!event) continue;
    const eventNodeId = candidate.candidateKey;
    const artistNodeId = `artist:${event.artistExternalId}`;
    const venueNodeId = `venue:${event.venueExternalId}`;

    ensureNode({ id: artistNodeId, type: 'artist-candidate', label: event.artistName, data: { externalId: event.artistExternalId, genre: event.genre, location: event.artistLocation } });
    ensureNode({ id: venueNodeId, type: 'venue-candidate', label: event.venueName, data: { externalId: event.venueExternalId, town: event.town } });
    ensureNode({ id: eventNodeId, type: 'event-candidate', label: `${event.artistName} @ ${event.venueName}`, data: { date: event.date, startTime: event.startTime, sourceEventKey: event.sourceEventKey, eventUrl: event.eventUrl, warnings: event.warnings } });

    addEdge({ id: `edge:${safeId(observationNodeId)}:${safeId(eventNodeId)}`, source: observationNodeId, target: eventNodeId, label: 'asserts' });
    addEdge({ id: `edge:${safeId(eventNodeId)}:${safeId(artistNodeId)}`, source: eventNodeId, target: artistNodeId, label: 'hasPerformer' });
    addEdge({ id: `edge:${safeId(eventNodeId)}:${safeId(venueNodeId)}`, source: eventNodeId, target: venueNodeId, label: 'occursAt' });
  }

  for (const claim of knowledge.claims) {
    const subjectNode = nodes.get(claim.subject.key);
    if (subjectNode) {
      const facts = Array.isArray(subjectNode.data.claims) ? subjectNode.data.claims as unknown[] : [];
      subjectNode.data.claims = [...facts, { id: claim.id, predicate: claim.predicate, value: claim.value, confidence: claim.confidence }];
    }
  }

  for (const projection of projections) {
    const sourceEvent = eventByKey.get(projection.sourceEventKey);
    if (!sourceEvent) continue;
    const artistCandidateId = `artist:${sourceEvent.artistExternalId}`;
    const venueCandidateId = `venue:${sourceEvent.venueExternalId}`;
    const eventCandidateId = `event:${sourceEvent.sourceEventKey}`;
    const canonicalArtistId = `canonical-artist:${projection.artist.id}`;
    const canonicalVenueId = `canonical-venue:${projection.venue.id}`;
    const canonicalEventId = `canonical-event:${projection.event.id}`;

    ensureNode({ id: canonicalArtistId, type: 'artist', label: projection.artist.name ?? sourceEvent.artistName, data: { bndyId: projection.artist.id, resolutionAction: projection.artist.action } });
    ensureNode({ id: canonicalVenueId, type: 'venue', label: projection.venue.name ?? sourceEvent.venueName, data: { bndyId: projection.venue.id, resolutionAction: projection.venue.action } });
    ensureNode({ id: canonicalEventId, type: 'event', label: `${sourceEvent.artistName} @ ${sourceEvent.venueName}`, data: { bndyId: projection.event.id, projectionAction: projection.event.action, verified: projection.event.verified, date: sourceEvent.date, startTime: sourceEvent.startTime } });

    addEdge({ id: `resolve:${safeId(artistCandidateId)}:${projection.artist.id}`, source: artistCandidateId, target: canonicalArtistId, label: 'resolvesTo' });
    addEdge({ id: `resolve:${safeId(venueCandidateId)}:${projection.venue.id}`, source: venueCandidateId, target: canonicalVenueId, label: 'resolvesTo' });
    addEdge({ id: `resolve:${safeId(eventCandidateId)}:${projection.event.id}`, source: eventCandidateId, target: canonicalEventId, label: 'projectsTo' });
    addEdge({ id: `canonical:${projection.event.id}:artist`, source: canonicalEventId, target: canonicalArtistId, label: 'performer' });
    addEdge({ id: `canonical:${projection.event.id}:venue`, source: canonicalEventId, target: canonicalVenueId, label: 'venue' });
  }

  return { generatedAt: new Date().toISOString(), nodes: [...nodes.values()], edges: [...edges.values()] };
}

function htmlEscapeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function renderGraphHtml(graph: KnowledgeGraph): string {
  const data = htmlEscapeJson(graph);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BNDY Knowledge Graph</title>
<style>
:root{color-scheme:dark;background:#0d1117;color:#e6edf3;font-family:Inter,system-ui,sans-serif}*{box-sizing:border-box}body{margin:0}.top{padding:18px 22px;border-bottom:1px solid #30363d;display:flex;justify-content:space-between;gap:16px;align-items:center}.top h1{font-size:18px;margin:0}.top .meta{color:#8b949e;font-size:13px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;min-height:calc(100vh - 64px)}#stage{overflow:auto;padding:20px}#details{border-left:1px solid #30363d;padding:18px;overflow:auto;background:#010409}#details h2{font-size:15px;margin:0 0 12px}pre{white-space:pre-wrap;word-break:break-word;font-size:12px;color:#c9d1d9}.legend{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.pill{border:1px solid #30363d;border-radius:999px;padding:4px 8px;font-size:12px;color:#8b949e}svg{width:100%;min-width:900px;background:#0d1117}.edge{stroke:#484f58;stroke-width:1.4;fill:none}.edge-label{fill:#8b949e;font-size:10px}.node rect{fill:#161b22;stroke:#30363d;stroke-width:1.5;rx:10}.node text{fill:#e6edf3;font-size:11px;pointer-events:none}.node .type{fill:#8b949e;font-size:9px}.node.canonical rect{stroke:#2f81f7;stroke-width:2}.node.source rect,.node.observation rect{stroke:#a371f7}.node:hover rect{stroke:#58a6ff;cursor:pointer}@media(max-width:900px){.layout{grid-template-columns:1fr}#details{border-left:0;border-top:1px solid #30363d;min-height:280px}}
</style>
</head>
<body>
<div class="top"><div><h1>BNDY Knowledge Graph</h1><div class="meta">Actual source observation → claims → candidates → canonical BNDY projections</div></div><div class="meta" id="counts"></div></div>
<div class="layout"><main id="stage"><div class="legend"><span class="pill">purple = evidence</span><span class="pill">grey = candidates</span><span class="pill">blue = canonical BNDY</span><span class="pill">click any node</span></div><svg id="graph" role="img" aria-label="BNDY knowledge graph"></svg></main><aside id="details"><h2>Node detail</h2><p class="meta">Select a node to inspect provenance, IDs and claims.</p><pre id="json"></pre></aside></div>
<script>
const graph=${data};
const svg=document.getElementById('graph');const detail=document.getElementById('json');document.getElementById('counts').textContent=graph.nodes.length+' nodes · '+graph.edges.length+' edges';
const canonical=new Set(['artist','venue','event']);
const left=graph.nodes.filter(n=>n.type==='source'||n.type==='observation');
const middle=graph.nodes.filter(n=>n.type.endsWith('-candidate'));
const right=graph.nodes.filter(n=>canonical.has(n.type));
const pos=new Map();
function place(list,x,startY,gap){list.forEach((n,i)=>pos.set(n.id,{x,y:startY+i*gap}));}
place(left,40,45,100);place(middle,345,45,88);place(right,680,45,88);
const height=Math.max(520,80+Math.max(left.length*100,middle.length*88,right.length*88));svg.setAttribute('viewBox','0 0 940 '+height);svg.setAttribute('height',height);
const NS='http://www.w3.org/2000/svg';
function el(name,attrs={}){const x=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>x.setAttribute(k,String(v)));return x;}
const defs=el('defs');const marker=el('marker',{id:'arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});marker.appendChild(el('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#484f58'}));defs.appendChild(marker);svg.appendChild(defs);
for(const edge of graph.edges){const a=pos.get(edge.source),b=pos.get(edge.target);if(!a||!b)continue;const x1=a.x+190,y1=a.y+30,x2=b.x,y2=b.y+30;const path=el('path',{class:'edge',d:'M'+x1+' '+y1+' C '+(x1+55)+' '+y1+', '+(x2-55)+' '+y2+', '+x2+' '+y2,'marker-end':'url(#arrow)'});svg.appendChild(path);const t=el('text',{class:'edge-label',x:(x1+x2)/2,y:(y1+y2)/2-4});t.textContent=edge.label;svg.appendChild(t);}
for(const node of graph.nodes){const p=pos.get(node.id);if(!p)continue;const g=el('g',{class:'node '+(canonical.has(node.type)?'canonical ':node.type)});g.appendChild(el('rect',{x:p.x,y:p.y,width:190,height:60}));const title=el('text',{x:p.x+10,y:p.y+23});title.textContent=node.label.length>26?node.label.slice(0,25)+'…':node.label;g.appendChild(title);const type=el('text',{class:'type',x:p.x+10,y:p.y+43});type.textContent=node.type;g.appendChild(type);g.addEventListener('click',()=>{detail.textContent=JSON.stringify(node,null,2)});svg.appendChild(g);}
</script>
</body></html>`;
}
