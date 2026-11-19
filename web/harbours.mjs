const formatUTC = iso => iso.replace('T', ' ').slice(0, 16) + ' UTC';
const difference = metres => metres == null ? 'Unavailable' : (metres > 0 ? '+' : '') + metres.toFixed(3) + ' m';
const timeAt = (event, index) => formatUTC(new Date(Date.parse(event.start) + index * 900000).toISOString());

export function peakIndex(values) {
  return values.reduce((best, value, index) =>
    value != null && (best === -1 || value > values[best]) ? index : best, -1);
}

export function enableHarbours(snapshot, openTrack) {
  const el = id => document.getElementById(id);
  const select = el('harbour-event'), range = el('harbour-time');
  const storms = snapshot.storms;
  for (const [id, storm] of Object.entries(storms)) select.add(new Option(storm.label + ' · ' + storm.start.slice(0, 4), id));
  function show() {
    const event = storms[select.value], index = Number(range.value);
    el('harbour-instant').textContent = timeAt(event, index);
    el('harbour-window').textContent = formatUTC(event.start) + ' to ' + formatUTC(event.end) + ' · CHS retrieved ' + snapshot.retrieved + ' UTC';
    const rows = event.stations.map(station => {
      const peak = peakIndex(station.differences);
      const matched = station.differences.filter(v => v != null).length;
      const row = document.createElement('tr');
      const title = document.createElement('th');
      title.scope = 'row';
      const link = document.createElement('a');
      link.href = 'https://tides.gc.ca/en/stations/' + station.code;
      link.textContent = station.label;
      title.append(link);
      row.append(title);
      for (const value of [difference(station.differences[index]), peak === -1 ? 'Unavailable' : difference(station.differences[peak]) + ' · ' + timeAt(event, peak), matched + ' / ' + station.differences.length]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      return row;
    });
    el('harbour-readings').replaceChildren(...rows);
  }
  function reset() {
    const station = storms[select.value].stations[0];
    range.max = station.differences.length - 1;
    range.value = Math.max(0,peakIndex(station.differences));
    show();
  }
  select.onchange = reset;
  range.oninput = show;
  el('harbour-track').onclick = () => openTrack(select.value);
  reset();
  el('harbour-controls').hidden = false;
  return id => {
    if (storms[id] && select.value !== id) {
      select.value = id;
      reset();
    }
  };
}
