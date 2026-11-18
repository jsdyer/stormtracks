import csv, gzip, io, json, sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from refresh import OUTPUT, REQUIRED, parse

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
