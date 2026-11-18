import {ports, closestKm, distanceKm, paths, maxGapMinutes, stats, label, matches, stage, dateTime} from './model.mjs';

const $ = id => document.getElementById(id);
const num = value => value.toLocaleString('en-CA');
const measure = (value,unit) => value===null ? '—' : num(value)+' '+unit;
const node = (tag,text) => {const item=document.createElement(tag);item.textContent=text;return item;};
const option = (value,title) => new Option(title,value);
let archive, byId, map, baseTrack, currentTrack, marker, placeMarker, comparisonTrack;
let active, compare=null, frame=0, timer=null, limit=15, picking=false;
let centre=ports[0], distances=new Map();
const palette={primary:'#ffc279',ghost:'#e59e69',comparison:'#8de4e7'};

function makeMap(land) {
  map=L.map('map',{zoomControl:true,attributionControl:false,scrollWheelZoom:false,minZoom:1,maxZoom:9,preferCanvas:true})
    .setView([41,-60],4);
  L.geoJSON(land,{interactive:false,style:{color:'#899b92',weight:0.7,fillColor:'#617b76',fillOpacity:1}}).addTo(map);
  for(let lat=-60;lat<=80;lat+=10) L.polyline([[lat,-179.99],[lat,179.99]],{color:'#aac6b9',weight:1,opacity:.16,interactive:false}).addTo(map);
  for(let lon=-170;lon<180;lon+=10) L.polyline([[-75,lon],[80,lon]],{color:'#aac6b9',weight:1,opacity:.16,interactive:false}).addTo(map);
  L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
  map.on('click', e=>{
    if(!picking) return;
    setPicking(false);
    const lon=((e.latlng.lng+180)%360+360)%360-180;
    setCentre({name:'Custom point',lat:e.latlng.lat,lon});
  });
}
function setPicking(value) {
  picking=value;
  $('pick').setAttribute('aria-pressed',String(value));
  $('pick').textContent=value?'Cancel map selection':'Choose a point on the map';
  $('map').classList.toggle('map-pick',value);
  if(value) $('map').scrollIntoView({block:'nearest'});
}
function setCentre(place) {
  centre=place;
  $('place').value=ports.includes(place)?place.name:'custom';
  $('lat').value=place.lat.toFixed(4);$('lon').value=place.lon.toFixed(4);
  if(placeMarker) placeMarker.remove();
  placeMarker=L.circleMarker([place.lat,place.lon],{radius:5,weight:2,color:'#e5f6eb',fillColor:'#143b50',fillOpacity:1})
    .bindTooltip(place.name,{permanent:true,direction:'right',className:'port'}).addTo(map);
  $('map-place').textContent='○ Search centre: '+place.name;
  distances=new Map(archive.storms.map(s=>[s.id,closestKm(s,[place.lat,place.lon])]));
  limit=15;
  renderResults();if(active) renderSummary();
}
function renderResults() {
  const query=$('query').value;
  const radius=$('radius').value==='all'?Infinity:Number($('radius').value);
  const results=archive.storms.filter(s=>matches(s,query) && distances.get(s.id)<=radius)
    .sort((a,b)=>distances.get(a.id)-distances.get(b.id) || b.year-a.year);
  $('results-count').textContent=num(results.length)+(results.length===1?' track':' tracks')+' · nearest first';
  const list=document.createDocumentFragment();
  for(const storm of results.slice(0,limit)){
    const button=node('button','');button.type='button';button.dataset.id=storm.id;
    button.setAttribute('aria-pressed',String(active?.id===storm.id));
    button.append(node('span',label(storm)),node('small',Math.round(distances.get(storm.id))+' km'));
    button.addEventListener('click',()=>selectStorm(storm));list.append(button);
  }
  if(!results.length) list.append(node('p','No matching tracks. Try a wider distance or another name.'));
  $('results').replaceChildren(list);$('more').hidden=results.length<=limit;
}
function stopPlayback(){
  clearInterval(timer);timer=null;$('play').textContent='Play track';
}
function shareState() {
  const hash=new URLSearchParams({storm:active.id});
  if(compare) hash.set('compare',compare.id);
  history.replaceState(null,'','#'+hash);
}
function fit() {
  const coordinates=paths(active.p).flat();
  if(compare) coordinates.push(...paths(compare.p).flat());
  const bounds=L.latLngBounds(coordinates);
  if(bounds.isValid()) map.fitBounds(bounds,{padding:[25,25],maxZoom:7,animate:false});
}
function stroke(storm,color,dashArray) {
  return L.polyline(paths(storm.p),{color,weight:3,opacity:0.9,dashArray,interactive:false}).addTo(map);
}
function updatePaths() {
  if(baseTrack) baseTrack.remove();
  if(comparisonTrack) comparisonTrack.remove();
  if(currentTrack) currentTrack.remove();
  if(marker) marker.remove();
  if(compare) comparisonTrack=stroke(compare,palette.comparison,'8 7');
  baseTrack=stroke(active,palette.ghost,'2 5');
  currentTrack=L.polyline([],{color:palette.primary,weight:3.5,interactive:false}).addTo(map);
  marker=L.circleMarker([0,0],{radius:6,color:'#fffeee',weight:2.5,fillOpacity:1,fillColor:'#bd512a'}).addTo(map);
}
function setFrame(next) {
  frame=next;
  const p=active.p[frame];
  $('frame').value=frame;
  $('frame-count').textContent=(frame+1)+' / '+active.p.length;
  $('timestamp').textContent=dateTime(p[0]);
  $('conditions').textContent=[stage(p[5]),measure(p[3],'kt'),measure(p[4],'hPa')].join(' · ');
  marker.setLatLng([p[1],p[2]]);
  currentTrack.setLatLngs(paths(active.p.slice(0,frame+1)));
}
function selectStorm(storm) {
  stopPlayback();
  active=storm;
  if(compare?.id===active.id) compare=null;
  $('selected').textContent=label(storm);
  for(const opt of $('compare').options) opt.disabled=opt.value===storm.id;
  $('compare').value=compare?.id||'';
  $('frame').max=storm.p.length-1;$('play').disabled=storm.p.length<2;
  updatePaths();fit();
  const place=[centre.lat,centre.lon];
  let nearest=0,best=Infinity;
  storm.p.forEach((p,i)=>{const distance=distanceKm(place,[p[1],p[2]]);if(distance<best){best=distance;nearest=i;}});
  setFrame(nearest);renderResults();renderSummary();shareState();
}
function svg(tag,attributes={},text='') {
  const e=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [k,v] of Object.entries(attributes)) e.setAttribute(k,String(v));
  e.textContent=text;return e;
}
function plot(storms) {
  const chart=$('chart');chart.replaceChildren();
  const maxWind=Math.max(25, ...storms.map(s=>stats(s).peak||0));
  const maxDays=Math.max(1,...storms.map(s=>stats(s).duration/24));
  const upper=Math.ceil(maxWind/25)*25;
  const x=days=>40+570*days/maxDays,y=wind=>140-120*wind/upper;
  for(const wind of [0,upper/2,upper]){
    chart.append(svg('line',{x1:40,x2:610,y1:y(wind),y2:y(wind),stroke:'#c8d5d0'}),svg('text',{x:31,y:y(wind)+4,'text-anchor':'end',fill:'#46616a','font-size':12},String(wind)));
  }
  for(const days of [0,maxDays/2,maxDays]){
    chart.append(svg('text',{x:x(days),y:159,'text-anchor':'middle',fill:'#46616a','font-size':12},days.toFixed(1)));
  }
  storms.forEach((storm,index)=>{
    let d='',previous=null;
    const color=index?'#21778b':'#ac4e2a';
    for(const p of storm.p) {
      if(p[3]===null){previous=null;continue;}
      const xx=x((p[0]-storm.p[0][0])/1440),yy=y(p[3]);
      d+=(previous && p[0]-previous[0]<=maxGapMinutes?' L':' M')+xx.toFixed(2)+' '+yy.toFixed(2);
      // A one-fix series still needs a visible mark.
      if(!previous || p[0]-previous[0]>maxGapMinutes) chart.append(svg('circle',{cx:xx,cy:yy,r:2.1,fill:color}));
      previous=p;
    }
    chart.append(svg('path',{d,fill:'none',stroke:color,'stroke-width':2.6,'stroke-dasharray':index?'6 4':'none'}));
  });
}
function renderSummary() {
  const storms=compare?[active,compare]:[active];
  $('compare-key').hidden=!compare;
  $('summary').replaceChildren(...storms.map(storm=>{
    const s=stats(storm), row=node('tr','');
    row.append(node('th',label(storm)),node('td',measure(s.peak,'kt')),node('td',measure(s.low,'hPa')),
      node('td',Math.round(distances.get(storm.id))+' km'));return row;
  }));
  $('footnote').textContent='* Approximate minimum centre-to-track distance from '+centre.name+'. Winds and pressures are extremes across the included track.';
  plot(storms);
}
function events() {
  $('query').oninput=$('radius').onchange=()=>{limit=15;renderResults();};
  $('more').onclick=()=>{limit+=25;renderResults();};
  $('place').onchange=()=>{const place=ports.find(p=>p.name===$('place').value);if(place) setCentre(place);};
  $('pick').onclick=()=>setPicking(!picking);
  $('coordinates').onsubmit=e=>{e.preventDefault();setPicking(false);setCentre({name:'Custom point',lat:Number($('lat').value),lon:Number($('lon').value)});};
  $('compare').onchange=()=>{
    compare=byId.get($('compare').value)||null;updatePaths();setFrame(frame);fit();renderSummary();shareState();
  };
  $('frame').oninput=()=>{stopPlayback();setFrame(Number($('frame').value));};
  $('fit').onclick=fit;
  $('play').onclick=()=>{
    if(timer){stopPlayback();return;}
    if(frame===active.p.length-1) setFrame(0);
    $('play').textContent='Pause';
    timer=setInterval(()=>{
      if(frame>=active.p.length-1){stopPlayback();return;}
      setFrame(frame+1);
      if(frame===active.p.length-1) stopPlayback();
    },270);
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
}
async function loadJSON(name) {
  const response=await fetch('./data/'+name+'.json');
  if(!response.ok) throw new Error('Source snapshot unavailable');
  return response.json();
}
try {
  const [data,land]=await Promise.all([loadJSON('tracks'),loadJSON('land')]);
  archive=data; byId=new Map(data.storms.map(s=>[s.id,s]));
  $('total').textContent=num(byId.size);
  const years=data.storms.map(s=>s.year);
  $('years').textContent=Math.min(...years)+'–'+Math.max(...years)+' · '+data.version;
  $('coverage').textContent=num(byId.size)+' tracks and '+num(data.positions)+' positions from completed seasons, '+Math.min(...years)+'–'+Math.max(...years)+'. NOAA file updated '+data.source_updated+' UTC; snapshot retrieved '+data.retrieved+' UTC.';
  $('loading').hidden=true;$('explorer').hidden=false;
  for(const place of ports) $('place').append(option(place.name,place.name));
  const custom=option('custom','Custom point');custom.disabled=true;$('place').append(custom);
  const sorted=[...archive.storms].sort((a,b)=>a.name.localeCompare(b.name)||b.year-a.year||a.id.localeCompare(b.id));
  $('compare').append(option('','Choose a second storm…'),...sorted.map(s=>option(s.id,label(s))));
  makeMap(land);events();setCentre(ports[0]);
  const hash=new URLSearchParams(location.hash.slice(1));compare=byId.get(hash.get('compare'))||null;
  selectStorm(byId.get(hash.get('storm'))||byId.get('2003268N28298')||archive.storms.at(-1));
} catch(error) {
  $('explorer').hidden=true;$('loading').hidden=false;
  $('loading').textContent='The track archive could not load. Reload the page or use the NOAA source below.';
  console.error(error);
}
