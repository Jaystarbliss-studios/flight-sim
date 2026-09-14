export interface TaxiwayNode {
  id: string;
  x: number;
  z: number;
  type: 'gate' | 'stand' | 'intersection' | 'hold_short' | 'runway_entry' | 'runway_exit';
}

export interface TaxiwayEdge {
  from: string;
  to: string;
  name: string;
  speedLimitKnots: number;
}

export interface AirportTaxiwayGraph {
  airportCode: string;
  nodes: TaxiwayNode[];
  edges: TaxiwayEdge[];
}

const graph = (airportCode: string, nodes: TaxiwayNode[], edges: TaxiwayEdge[]): AirportTaxiwayGraph => ({ airportCode, nodes, edges });
const edge = (from: string, to: string, name: string, speedLimitKnots = 20): TaxiwayEdge => ({ from, to, name, speedLimitKnots });

/**
 * Local metre coordinates are deliberately independent from runway rendering.
 * This gives ground/ATC systems a deterministic graph to route over without
 * coupling navigation logic to Three.js geometry.
 */
export const TAXIWAY_GRAPHS: Record<string, AirportTaxiwayGraph> = {
  KLAX: graph('KLAX', [
    { id: 'A1', x: -1500, z: 800, type: 'gate' }, { id: 'A2', x: -900, z: 800, type: 'intersection' },
    { id: 'A3', x: -300, z: 800, type: 'intersection' }, { id: 'A4', x: 300, z: 800, type: 'intersection' },
    { id: 'A5', x: 900, z: 800, type: 'hold_short' }, { id: 'R24L', x: 1450, z: 800, type: 'runway_entry' },
    { id: 'B1', x: -1500, z: -600, type: 'gate' }, { id: 'B2', x: -700, z: -600, type: 'intersection' },
    { id: 'B3', x: 100, z: -600, type: 'intersection' }, { id: 'B4', x: 800, z: -600, type: 'hold_short' },
    { id: 'R25R', x: 1500, z: -600, type: 'runway_entry' },
  ], [
    edge('A1', 'A2', 'A'), edge('A2', 'A3', 'A'), edge('A3', 'A4', 'A'), edge('A4', 'A5', 'A'), edge('A5', 'R24L', 'A'),
    edge('B1', 'B2', 'B'), edge('B2', 'B3', 'B'), edge('B3', 'B4', 'B'), edge('B4', 'R25R', 'B'), edge('A2', 'B2', 'C'), edge('A4', 'B4', 'C'),
  ]),
  KSFO: graph('KSFO', [
    { id: 'G1', x: -1200, z: 900, type: 'gate' }, { id: 'G2', x: -600, z: 900, type: 'intersection' },
    { id: 'G3', x: 0, z: 900, type: 'intersection' }, { id: 'G4', x: 600, z: 900, type: 'hold_short' },
    { id: 'R28R', x: 1400, z: 900, type: 'runway_entry' }, { id: 'S1', x: -600, z: -700, type: 'runway_exit' },
    { id: 'S2', x: 300, z: -700, type: 'intersection' }, { id: 'S3', x: 1100, z: -700, type: 'hold_short' },
  ], [edge('G1', 'G2', 'A'), edge('G2', 'G3', 'A'), edge('G3', 'G4', 'A'), edge('G4', 'R28R', 'A'), edge('S1', 'S2', 'B'), edge('S2', 'S3', 'B'), edge('S3', 'R28R', 'C'), edge('G2', 'S1', 'C')]),
  EGLL: graph('EGLL', [
    { id: 'T1', x: -1400, z: 700, type: 'gate' }, { id: 'T2', x: -700, z: 700, type: 'intersection' },
    { id: 'T3', x: 0, z: 700, type: 'intersection' }, { id: 'T4', x: 700, z: 700, type: 'hold_short' },
    { id: 'R27R', x: 1500, z: 700, type: 'runway_entry' }, { id: 'T5', x: 0, z: -650, type: 'runway_exit' },
  ], [edge('T1', 'T2', 'A'), edge('T2', 'T3', 'A'), edge('T3', 'T4', 'A'), edge('T4', 'R27R', 'A'), edge('T5', 'T3', 'B'), edge('T5', 'T4', 'B')]),
  DNMM: graph('DNMM', [
    { id: 'M1', x: -1100, z: 850, type: 'gate' }, { id: 'M2', x: -400, z: 850, type: 'intersection' },
    { id: 'M3', x: 300, z: 850, type: 'intersection' }, { id: 'M4', x: 950, z: 850, type: 'hold_short' },
    { id: 'R18R', x: 1500, z: 850, type: 'runway_entry' }, { id: 'M5', x: -400, z: -700, type: 'runway_exit' },
    { id: 'M6', x: 500, z: -700, type: 'intersection' },
  ], [edge('M1', 'M2', 'A'), edge('M2', 'M3', 'A'), edge('M3', 'M4', 'A'), edge('M4', 'R18R', 'A'), edge('M5', 'M6', 'B'), edge('M6', 'M3', 'B'), edge('M2', 'M5', 'C')]),
  KJFK: graph('KJFK', [
    { id: 'J1', x: -1500, z: 600, type: 'gate' }, { id: 'J2', x: -800, z: 600, type: 'intersection' },
    { id: 'J3', x: -100, z: 600, type: 'intersection' }, { id: 'J4', x: 500, z: 600, type: 'hold_short' },
    { id: 'R31L', x: 1450, z: 600, type: 'runway_entry' }, { id: 'J5', x: -700, z: -650, type: 'runway_exit' },
    { id: 'J6', x: 100, z: -650, type: 'intersection' }, { id: 'J7', x: 900, z: -650, type: 'hold_short' },
  ], [edge('J1', 'J2', 'A'), edge('J2', 'J3', 'A'), edge('J3', 'J4', 'A'), edge('J4', 'R31L', 'A'), edge('J5', 'J6', 'B'), edge('J6', 'J7', 'B'), edge('J7', 'R31L', 'B'), edge('J2', 'J5', 'C')]),
  LFPG: graph('LFPG', [
    { id: 'P1', x: -1400, z: 750, type: 'gate' }, { id: 'P2', x: -700, z: 750, type: 'intersection' },
    { id: 'P3', x: 0, z: 750, type: 'intersection' }, { id: 'P4', x: 700, z: 750, type: 'hold_short' },
    { id: 'R27L', x: 1500, z: 750, type: 'runway_entry' }, { id: 'P5', x: -300, z: -700, type: 'runway_exit' },
    { id: 'P6', x: 600, z: -700, type: 'intersection' },
  ], [edge('P1', 'P2', 'A'), edge('P2', 'P3', 'A'), edge('P3', 'P4', 'A'), edge('P4', 'R27L', 'A'), edge('P5', 'P6', 'B'), edge('P6', 'P4', 'B'), edge('P2', 'P5', 'C')]),
};

export function getTaxiwayGraph(airportCode: string) {
  return TAXIWAY_GRAPHS[airportCode];
}

export function findTaxiRoute(graph: AirportTaxiwayGraph, startId: string, goalId: string): TaxiwayNode[] {
  if (startId === goalId) return [graph.nodes.find(n => n.id === startId)!].filter(Boolean);
  const adjacency = new Map<string, string[]>();
  for (const e of graph.edges) {
    adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to]);
    adjacency.set(e.to, [...(adjacency.get(e.to) ?? []), e.from]);
  }
  const queue = [startId];
  const previous = new Map<string, string | null>([[startId, null]]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current === goalId) break;
    for (const next of adjacency.get(current) ?? []) {
      if (!previous.has(next)) { previous.set(next, current); queue.push(next); }
    }
  }
  if (!previous.has(goalId)) return [];
  const ids: string[] = [];
  for (let at: string | null = goalId; at; at = previous.get(at) ?? null) ids.unshift(at);
  return ids.map(id => graph.nodes.find(n => n.id === id)).filter((n): n is TaxiwayNode => Boolean(n));
}
