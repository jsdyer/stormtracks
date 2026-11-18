const radians = Math.PI / 180;
const earthRadiusKm = 6371.0088;
export const maxGapMinutes = 12 * 60;
export const ports = [
  {name:'Halifax', lat:44.6488, lon:-63.5752},
  {name:'Sydney', lat:46.1368, lon:-60.1942},
  {name:'Sable Island', lat:43.933, lon:-59.915},
  {name:'Yarmouth', lat:43.837, lon:-66.117},
  {name:'Charlottetown', lat:46.238, lon:-63.131},
  {name:"St. John’s", lat:47.562, lon:-52.712},
  {name:'Moncton', lat:46.087, lon:-64.778},
  {name:'Bermuda', lat:32.294, lon:-64.782}
];

function angle(a,b) {
  const latA=a[0]*radians, latB=b[0]*radians;
  const h=Math.sin((latB-latA)/2)**2+Math.cos(latA)*Math.cos(latB)*Math.sin((b[1]-a[1])*radians/2)**2;
  return 2*Math.asin(Math.sqrt(Math.min(1,h)));
}
function bearing(a,b) {
  const latA=a[0]*radians,latB=b[0]*radians,dl=(b[1]-a[1])*radians;
  return Math.atan2(Math.sin(dl)*Math.cos(latB), Math.cos(latA)*Math.sin(latB)-Math.sin(latA)*Math.cos(latB)*Math.cos(dl));
}
export function distanceKm(a,b) { return earthRadiusKm*angle(a,b); }

// Minimum distance to the finite, shorter great-circle arc between recorded centres.
export function arcDistanceKm(place,a,b) {
  const length=angle(a,b);
  if(length < 1e-12) return distanceKm(place,a);
  const start=angle(a,place);
  const direction=bearing(a,place)-bearing(a,b);
  const along=Math.atan2(Math.sin(start)*Math.cos(direction),Math.cos(start));
  if(along<0 || along>length) return Math.min(start,angle(b,place))*earthRadiusKm;
  return Math.abs(Math.asin(Math.max(-1,Math.min(1,Math.sin(start)*Math.sin(direction)))))*earthRadiusKm;
}
export function closestKm(storm,place) {
  let best=Infinity, previous=null;
  for(const p of storm.p) {
    const here=[p[1],p[2]];
    const connected=previous && p[0]-previous[0]<=maxGapMinutes;
    const dist=connected?arcDistanceKm(place,[previous[1],previous[2]],here):distanceKm(place,here);
    best=Math.min(best,dist);
    previous=p;
  }
  return best;
}
export function paths(points) {
  const result=[];
  let line=[],previous=null;
  for(const p of points) {
    if(previous && p[0]-previous[0]>maxGapMinutes) line=[];
    if(!line.length) result.push(line);
    let lon=p[2];
    if(line.length) lon+=360*Math.round((line.at(-1)[1]-lon)/360);
    line.push([p[1],lon]);
    previous=p;
  }
  return result;
}
export function stats(storm) {
  const winds=storm.p.map(p=>p[3]).filter(v=>v!==null);
  const pressures=storm.p.map(p=>p[4]).filter(v=>v!==null);
  return {peak:winds.length?Math.max(...winds):null, low:pressures.length?Math.min(...pressures):null,
    duration:(storm.p.at(-1)[0]-storm.p[0][0])/60};
}
export function label(storm) {
  return storm.name+' · '+storm.year+(storm.name==='Unnamed'?' · '+storm.id:'');
}
export function matches(storm, query) {
  const text=(storm.name+' '+storm.year+' '+storm.id).toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).every(word=>text.includes(word));
}
export function dateTime(minute) {
  return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'}).format(new Date(minute*60000))+' UTC';
}
export function stage(code) {
  const statuses={TD:'Tropical depression',TS:'Tropical storm',HU:'Hurricane',EX:'Extratropical',ET:'Extratropical',LO:'Low',SS:'Subtropical storm',SD:'Subtropical depression',DB:'Disturbance',WV:'Tropical wave',
    'IB:TS':'Tropical system','IB:ET':'Extratropical','IB:DS':'Disturbance','IB:SS':'Subtropical system','IB:MX':'Mixed nature','IB:NR':'Unreported'};
  return statuses[code]||'Unreported';
}
