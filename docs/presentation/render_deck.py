"""Export the shared slide source to vector PDF and review PNGs.
Requires system PyGObject, PangoCairo, pycairo and Pillow.
Editable PowerPoint generation itself needs only the Python standard library.
"""
from pathlib import Path
import math
import cairo
import gi
gi.require_version('Pango','1.0')
gi.require_version('PangoCairo','1.0')
from gi.repository import Pango, PangoCairo
from build_deck import slides, OUT

W,H=960,540

def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
def rect(c,x,y,w,h,r=0):
    if not r:c.rectangle(x,y,w,h);return
    c.new_sub_path()
    for cx,cy,a,b in [(x+w-r,y+r,-90,0),(x+w-r,y+h-r,0,90),(x+r,y+h-r,90,180),(x+r,y+r,180,270)]:
        c.arc(cx,cy,r,math.radians(a),math.radians(b))
    c.close_path()

def paint(c,s,index,check=False,pdf=False):
    c.set_source_rgb(*rgb(s['bg']));c.paint()
    for op in s['ops']:
        if op[0]=='shape':
            _,x,y,w,h,fill,kind,stroke=op;x*=72;y*=72;w*=72;h*=72
            c.new_path()
            if kind=='ellipse':
                c.save();c.translate(x+w/2,y+h/2);c.scale(w/2,h/2);c.arc(0,0,1,0,2*math.pi);c.restore()
            else:rect(c,x,y,w,h,min(w,h)*.12 if kind=='roundRect' else 0)
            c.set_source_rgb(*rgb(fill));c.fill_preserve()
            if stroke:c.set_source_rgb(*rgb(stroke));c.set_line_width(1);c.stroke()
            else:c.new_path()
        elif op[0]=='picture':
            _,name,x,y,w,h,desc=op
            image=cairo.ImageSurface.create_from_png(str(OUT/'assets'/name))
            c.save();c.translate(x*72,y*72);c.scale(w*72/image.get_width(),h*72/image.get_height());c.set_source_surface(image);c.paint();c.restore()
        elif op[0]=='text':
            _,value,x,y,w,h,size,fill,bold,font,align,link=op
            font=font or ('Montserrat' if bold else 'Noto Sans')
            layout=PangoCairo.create_layout(c)
            PangoCairo.context_set_resolution(layout.get_context(),72)
            fd=Pango.FontDescription();fd.set_family(font);fd.set_size(round(size*Pango.SCALE))
            fd.set_weight(Pango.Weight.BOLD if bold else Pango.Weight.NORMAL)
            layout.set_font_description(fd);layout.set_width(round(w*72*Pango.SCALE))
            layout.set_wrap(Pango.WrapMode.WORD_CHAR)
            layout.set_alignment({'l':Pango.Alignment.LEFT,'r':Pango.Alignment.RIGHT,'ctr':Pango.Alignment.CENTER}[align])
            layout.set_line_spacing(1.12)
            layout.set_text(value,-1)
            actual=layout.get_size()[1]/Pango.SCALE
            if check and actual>h*72+2:
                print(f'FIT slide {index}: {value[:45]!r}: {actual:.1f}pt in {h*72:.1f}pt')
            c.move_to(x*72,y*72);c.set_source_rgb(*rgb(fill))
            if pdf and link:c.tag_begin(cairo.TAG_LINK,f"uri='{link}'")
            PangoCairo.show_layout(c,layout)
            if pdf and link:c.tag_end(cairo.TAG_LINK)

def main():
    pdf=OUT/'MELA-AI-Project-Overview.pdf'
    surface=cairo.PDFSurface(str(pdf),W,H)
    surface.set_metadata(cairo.PDF_METADATA_TITLE,'As-Sunnah | MELA AI — Digital Bridge Pitch')
    surface.set_metadata(cairo.PDF_METADATA_AUTHOR,'Fuad Tesfaye, Salim Siraj, Sifen Fisaha, Yusra Mohhamed')
    c=cairo.Context(surface)
    preview=OUT/'previews';preview.mkdir(exist_ok=True)
    for i,s in enumerate(slides,1):
        paint(c,s,i,True,True);c.show_page()
        png=cairo.ImageSurface(cairo.FORMAT_ARGB32,W,H)
        cc=cairo.Context(png);paint(cc,s,i)
        png.write_to_png(str(preview/f'slide-{i:02}.png'))
    surface.finish()
    from PIL import Image,ImageOps,ImageDraw
    sheet=Image.new('RGB',(1624,1398),'#dce4e3')
    for i in range(6):
        im=Image.open(preview/f'slide-{i+1:02}.png').convert('RGB');im.thumbnail((792,446))
        sheet.paste(im,(12+(i%2)*808,12+(i//2)*462))
    sheet.save(preview/'contact-sheet.jpg',quality=92)
    print('Created',pdf)

if __name__=='__main__':main()
