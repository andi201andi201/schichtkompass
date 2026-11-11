"""Extract only the cropped official icons and transcribed definitions.
Usage: python scripts/build-zgks-legend.py <presence.pdf> <absence.pdf>
Requires PyMuPDF and Pillow. Source PDFs are not published with the app.
"""
import base64, io, json, re, sys
from pathlib import Path
import fitz
from PIL import Image
PRESENCE = [
 ('2','A','Arbeitstag','07:00','16:06'),
 ('182','F','Frühdienst','07:00','16:06'),
 ('211','FT','Frühdienst Tagesverantwortung','07:00','16:06'),
 ('198','FG','Frühdienst Gleitzeit','06:45','15:51'),
 ('563','PL','PIL','07:00','16:06'),
 ('3434','M','Mitteldienst','10:00','19:06'),
 ('2650','S','Spätdienst','13:54','23:00'),
 ('2671','SL','Spätdienst Lernende','12:54','22:00'),
 ('1470','N','Nachtdienst','22:10','07:11'),
 ('146','E','Einführung Frühdienst','07:00','16:06'),
 ('2146','E','Einführung Spätdienst','13:54','23:00'),
 ('1146','E','Einführung Nachtdienst','22:10','07:11'),
 ('4562','PK','PEKO','08:00','16:54'),
 ('4714','TS','Teamsitzung','14:45','17:00'),
 ('5003','Ä1','Ämtli','07:00','16:06'),
 ('5038','B','Büro','07:00','16:06'),
 ('5542','P','Planungstag','07:00','16:06'),
 ('1000','','Platzhalter (kein Eintrag)','',''),
]
ABSENCE = [
 ('9500','–','Frei'),('9501','–W','Wunschfrei'),('9502','KO','Kompensation'),
 ('9510','FML','Ferien Monatslohn'),('9511','FSL','Ferien Stundenlohn'),('9520','DJ','Dienstjubiläum'),
 ('9530','K','Krank Kurzzeit (1.–30. Tag)'),('9531','K','Krank Langzeit (ab 31. Tag)'),
 ('9540','KS','Krank Schwanger Kurzzeit (1.–30. Tag)'),('9541','KS','Krank Schwanger Langzeit (ab 31. Tag)'),
 ('9550','UB','Berufsunfall Kurzzeit (1.–30. Tag)'),('9551','UB','Berufsunfall Langzeit (ab 31. Tag)'),
 ('9560','UN','Nicht Berufsunfall Kurzzeit (1.–30. Tag)'),('9561','UN','Nicht Berufsunfall Langzeit (ab 31. Tag)'),
 ('9570','BF','Betreuung Familie'),('9571','BU','Betreuungsurlaub (nur HR)'),
 ('9580','WA','Weiterbildung Arbeitstag'),('9581','WB','Weiterbildung nach BG'),('9584','WoZ','Weiterbildung ohne Zeit'),
 ('9590','MU','Mutterschaftsurlaub'),('9600','VU','Vaterschaftsurlaub / anderes Elternteil'),
 ('9610','E','Hauseinführung'),('9612','ET','Externe Tätigkeit / Dozententätigkeit intern/extern'),
 ('9620','M','Militär, Zivilschutz'),('9621','JS','J+S Jugend und Sport'),('9630','UZ','Umzug, Zügeltag'),
 ('9631','H','Hochzeit'),('9632','T','Todesfall'),('9633','TA','Team Ausflug'),('9641','DA','Diverse Absenz'),
 ('9650','S','Schultag Auszubildende'),('9652','EX','Examen, Prüfungen, QV'),('9653','LF','Lernforum'),
 ('9654','PR','Praktika'),('9660','ÖA','Öffentliches Amt'),('9670','UU','Unbezahlter Urlaub'),
]
def extract(path,rows,kind):
    document=fitz.open(path);images=[]
    for page_number,page in enumerate(document):
        positioned=sorted([(page.get_image_rects(im[0])[0],im[0]) for im in page.get_images(full=True)],key=lambda a:a[0].y0)
        for rect,xref in positioned:
            words=page.get_text('words',clip=fitz.Rect(88,rect.y0-3,215,rect.y1+5))
            images.append((page_number+1,' '.join(w[4] for w in words),xref))
    assert len(rows)==len(images),(len(rows),len(images))
    out=[]
    for row,(page,label,xref) in zip(rows,images):
        pep,code,name,*times=row
        assert re.match(re.escape(pep)+r'\s',label),(row,label)
        original=document.extract_image(xref);im=Image.open(io.BytesIO(original['image'])).convert('RGB')
        feature=list(im.resize((20,20),Image.Resampling.BILINEAR).tobytes())
        png=io.BytesIO();im.save(png,format='PNG')
        skip=pep in ['1000','9500','9501','9502']
        out.append(dict(id=pep,kind=kind,code=code or 'Frei',name=name,type='skip' if skip else 'shift' if kind=='presence' else 'allday',start=times[0] if times else '',end=times[1] if times else '',validFrom='2027-01-01' if kind=='presence' else '2026-10-01',sourcePage=page,feature=feature,thumb='data:image/png;base64,'+base64.b64encode(png.getvalue()).decode()))
    return out
if __name__=='__main__':
    data=dict(version=1,source=dict(presence={'title':'Präsenz-Definitionen ab 01.01.2027','department':'Chirurgie Nord','date':'2026-08-10'},absence={'title':'Absenz-Definitionen ab 01.10.2026','department':'Pflege Pool','date':'2026-10-15'}),symbols=extract(sys.argv[1],PRESENCE,'presence')+extract(sys.argv[2],ABSENCE,'absence'))
    Path('dist/zgks-legend-data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    print(f"Prepared {len(data['symbols'])} ZGKS symbols; no complete source PDF included.")
