"""Exercise the deployed Pages subpath with the full offline archive and coastline."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

with tempfile.TemporaryDirectory() as directory:
    shutil.copytree(ROOT/'dist',Path(directory)/'stormtracks')
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=directory))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'))
            page=browser.new_page(viewport={'width':1440,'height':980})
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            url=f'http://127.0.0.1:{server.server_port}/stormtracks/'
            page.goto(url)
            expect(page.locator('#selected')).to_contain_text('Juan')
            expect(page.locator('#results button')).not_to_have_count(0)
            expect(page.locator('#harbour-readings')).to_contain_text('+0.634 m')
            expect(page.locator('#harbour-readings')).to_contain_text('+1.573 m')
            expect(page.locator('#harbour-readings')).to_contain_text('0 / 193')
            page.locator('#harbour-time').fill('0')
            expect(page.locator('#harbour-instant')).to_have_text('2022-09-23 00:00 UTC')
            page.locator('#compare').select_option('2022257N16312')
            expect(page.locator('#summary tr')).to_have_count(2)
            expect(page.locator('#summary')).to_contain_text('Fiona')
            page.locator('#frame').fill('0')
            start=page.locator('#timestamp').inner_text()
            page.locator('#play').click();page.wait_for_timeout(700)
            page.locator('#play').click()
            assert page.locator('#timestamp').inner_text()!=start
            page.locator('#radius').select_option('all');page.locator('#query').fill('2019 dorian')
            expect(page.locator('#results button')).to_have_count(1)
            page.locator('#results button').click()
            expect(page.locator('#selected')).to_contain_text('Dorian')
            expect(page.locator('#harbour-event')).to_have_value('2019236N10314')
            expect(page.locator('#harbour-readings')).to_contain_text('+1.377 m')
            assert 'storm=2019236N10314' in page.url
            page.reload();expect(page.locator('#selected')).to_contain_text('Dorian')
            page.locator('#place').select_option('Sydney');expect(page.locator('#map-place')).to_contain_text('Sydney')
            page.locator('#pick').click();page.locator('#map').click(position={'x':110,'y':120})
            expect(page.locator('#map-place')).to_contain_text('Custom point')
            page.locator('#query').fill('zzqqzz');expect(page.locator('#results')).to_contain_text('No matching')
            page.locator('#query').fill('')
            shots=ROOT/'browser-checks';shots.mkdir(exist_ok=True)
            page.screenshot(path=str(shots/'desktop.png'),full_page=True)
            page.set_viewport_size({'width':390,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            page.screenshot(path=str(shots/'mobile.png'),full_page=True)
            page.route('**/data/tracks.json',lambda r:r.fulfill(status=503,body='Unavailable'))
            page.reload();expect(page.locator('#loading')).to_contain_text('could not load')
            assert not errors,errors
            browser.close()
    finally:
        server.shutdown()
