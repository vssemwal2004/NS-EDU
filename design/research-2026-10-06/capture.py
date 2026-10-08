import asyncio,json,pathlib,sys
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).parent
sites=json.loads((root/'sites.json').read_text())
extra=len(sys.argv)>1
if extra: sites=[['UCAS','https://www.ucas.com/'],['Prospects','https://www.prospects.ac.uk/'],['Whatuni','https://www.whatuni.com/'],['UniCompare','https://universitycompare.com/']]
results=[]
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(channel='chrome',headless=True)
  sem=asyncio.Semaphore(4)
  async def visit(i,site):
   async with sem:
    name,url=site
    page=await browser.new_page(viewport={'width':1440,'height':1000})
    row={'name':name,'url':url,'index':i}
    try:
     response=await page.goto(url,wait_until='domcontentloaded',timeout=35000)
     await page.wait_for_timeout(2500)
     row.update(status=response.status if response else None,title=await page.title(),final_url=page.url)
     row['evidence']=await page.evaluate('''() => ({text:document.body.innerText.slice(0,10000),headings:[...document.querySelectorAll('h1,h2')].map(e=>e.innerText).filter(Boolean).slice(0,25),fonts:[...new Set([...document.querySelectorAll('h1,h2,p,button')].slice(0,100).map(e=>getComputedStyle(e).fontFamily))],animations:document.getAnimations().length,videos:document.querySelectorAll('video').length})''')
     await page.screenshot(path=str(root/f'{i+1:02d}-{name}.png'))
     if i in [1,3,4,9,11,12,13,15,16,19,20,22,27]:
      await page.evaluate('window.scrollTo(0,1100)')
      await page.wait_for_timeout(700)
      await page.screenshot(path=str(root/f'{i+1:02d}-{name}-sections.png'))
      await page.set_viewport_size({'width':390,'height':844})
      await page.evaluate('window.scrollTo(0,0)')
      await page.wait_for_timeout(700)
      await page.screenshot(path=str(root/f'{i+1:02d}-{name}-mobile.png'))
    except Exception as e: row['error']=str(e)[:300]
    results.append(row)
    (root/('extra-evidence.json' if extra else 'browser-evidence.json')).write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in row.items() if k!='evidence'}),flush=True)
    await page.close()
  await asyncio.gather(*(visit(i,s) for i,s in enumerate(sites)))
  await browser.close()
asyncio.run(main())
