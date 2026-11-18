import csv, gzip, io, json, sys, unittest
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from refresh import OUTPUT, REQUIRED, parse, save

class SourceTests(unittest.TestCase):
    def test_reference_track_and_snapshot(self):
        data = json.loads(gzip.decompress(OUTPUT.read_bytes()))
        storms = data['storms']
        self.assertGreater(len(storms),2200)
        self.assertEqual(len(storms),len({s['id'] for s in storms}))
        self.assertEqual(sum(len(s['p']) for s in storms),data['positions'])
        juan=next(s for s in storms if s['id']=='2003268N28298')
        self.assertEqual((juan['name'],juan['year']),('Juan',2003))
        self.assertGreaterEqual(max(p[3] for p in juan['p'] if p[3] is not None),85)
    def test_same_export_retrieved_on_a_later_day(self):
        raw = b"source fixture"
        storms = [{"id": "2003268N28298" if i == 0 else str(i), "p": [0] * 50} for i in range(2000)]
        old = {"retrieved": "2026-01-01", "source_updated": "2025-12-20", "storms": storms,
               "sha256": sha256(raw).hexdigest()}
        with TemporaryDirectory() as folder, patch("refresh.parse", return_value=storms):
            dest = Path(folder) / "tracks.json.gz"
            dest.write_bytes(gzip.compress(json.dumps(old).encode()))
            save(raw, old["source_updated"], "2026-02-01", dest)
            checked = json.loads(gzip.decompress(dest.read_bytes()))
            self.assertEqual(checked["retrieved"], "2026-02-01")
            self.assertEqual(checked["source_updated"], old["source_updated"])
            self.assertEqual(checked["sha256"], old["sha256"])

    def test_scope_units_and_blanks(self):
        fields=sorted(REQUIRED); data=io.StringIO(); writer=csv.DictWriter(data,fields);writer.writeheader()
        writer.writerow({'USA_WIND':'kts','USA_PRES':'mb'})
        base=dict(SID='123',NAME='NA',SEASON='2024',BASIN='NA',ISO_TIME='2024-01-01 00:00:00',NATURE='TS',LAT='44.2',LON='-60',TRACK_TYPE='main')
        writer.writerow(base)
        writer.writerow(dict(base,SID='s2',TRACK_TYPE='spur-split'))
        writer.writerow(dict(base,SID='s3',BASIN='EP'))
        writer.writerow(dict(base,SID='s4',SEASON='2026'))
        data.seek(0)
        cleaned=parse(data,2025)
        self.assertEqual(len(cleaned),1);self.assertEqual(cleaned[0]['p'][0][3:],[None,None,'IB:TS'])
