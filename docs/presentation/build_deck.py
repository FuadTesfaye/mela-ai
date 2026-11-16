"""Build the editable MELA project overview. Requires python-pptx==1.0.2."""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

OUT = Path(__file__).resolve().parent
prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333333), Inches(7.5)
prs.core_properties.title = 'MELA AI — Accessible learning, right where you are'
prs.core_properties.subject = 'Adaptive Accessibility Companion · Track 3'
prs.core_properties.author = 'MELA AI project'
prs.core_properties.keywords = 'MELA, accessibility, learning, multilingual, MVP'
NAVY='103C4B'; TEAL='087E8B'; INK='17394E'; MUTED='55717B'; PAPER='F6F8F5'; WHITE='FFFFFF'; PALE='E8F3F3'; BORDER='DCE6E6'; GOLD='E9B96D'

def color(value): return RGBColor.from_string(value)
def box(slide,x,y,w,h,fill,line=None,radius=False):
    s=slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    s.shadow.inherit=False
    for effect in s._element.xpath("./p:style/a:effectRef"):
        effect.set("idx", "0")
    s.fill.solid(); s.fill.fore_color.rgb=color(fill)
    if line: s.line.color.rgb=color(line)
    else: s.line.fill.background()
    if radius: s.adjustments[0]=0.12
    return s

def text(slide, value, x,y,w,h, size=22, fill=INK, bold=False, font=None):
    s=slide.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h))
    tf=s.text_frame; tf.clear(); tf.word_wrap=True
    tf.margin_left=tf.margin_right=0; tf.margin_top=tf.margin_bottom=0
    for i,line in enumerate(value.split('\n')):
        p=tf.paragraphs[0] if i==0 else tf.add_paragraph()
        p.text=line; p.font.name=font or ('Montserrat' if bold else 'Noto Sans')
        p.font.size=Pt(size); p.font.bold=bold; p.font.color.rgb=color(fill)
        p.space_after=Pt(8)
    return s

def base(section, number, dark=False):
    s=prs.slides.add_slide(prs.slide_layouts[6])
    bg=s.background.fill; bg.solid();bg.fore_color.rgb=color(NAVY if dark else PAPER)
    fg=WHITE if dark else TEAL
    text(s,'MELA AI',.65,.35,3,.3,12,fg,True)
    text(s,section.upper(),8.2,.35,4.45,.3,11,'C2DBDF' if dark else MUTED)
    box(s,.65,7.03,12.03,.012,'355A66' if dark else BORDER)
    text(s,'ADAPTIVE ACCESSIBILITY COMPANION',.65,7.13,10,.2,9,'C2DBDF' if dark else MUTED)
    text(s,f'{number:02d}',12.15,7.1,.5,.25,10,'C2DBDF' if dark else MUTED)
    return s

def heading(s,kicker,title,subtitle=None):
    text(s,kicker.upper(),.7,1.0,11,.35,13,TEAL,True)
    text(s,title,.7,1.52,12,1.25,36,INK,True)
    if subtitle: text(s,subtitle,.72,2.85,11.8,.65,19,MUTED)

def notes(s,value): s.notes_slide.notes_text_frame.text=value

def card(s,x,y,w,num,title,body):
    box(s,x,y,w,2.4,WHITE,BORDER,True)
    text(s,num,x+.25,y+.2,w-.5,.35,13,TEAL,True)
    text(s,title,x+.25,y+.76,w-.5,.6,23,INK,True)
    text(s,body,x+.25,y+1.35,w-.5,.95,17,MUTED)

# 1 · Opening
s=base('Project overview · Track 3',1,True)
text(s,'MELA',.8,1.5,9,1.4,86,WHITE,True)
text(s,'AI',5.5,1.62,2.6,1.4,82,GOLD,True)
text(s,'Accessible learning,\nright where you are.',.85,3.18,11.5,1.5,37,WHITE,True)
text(s,'A multilingual companion inside the lesson.',.88,5.05,11.6,.7,24,'C2DBDF')
box(s,.88,6.15,6.7,.45,'234F5D',None,True)
text(s,'ENGLISH + AMHARIC   /   TEXT + VOICE   /   HUMAN HELP',1.05,6.24,6.4,.25,11,WHITE)
notes(s,'MELA AI is our Adaptive Accessibility Companion for Track 3: Multilingual Assistant & Live Help. Introduce it as an implemented MVP, not a certified accessibility product. The learner-facing module runs independently of the Next.js tutor and API application.')

# 2 · Problem
s=base('The problem',2)
heading(s,'Why MELA','Learning should not stop at a barrier.','Learners need help they can understand, access and use in the moment.')
card(s,.7,3.85,3.82,'01','Language','Clear explanations in a language you understand.')
card(s,4.76,3.85,3.82,'02','Access','Flexible ways to read, listen and interact.')
card(s,8.82,3.85,3.82,'03','Context','Help that understands the lesson you are viewing.')
notes(s,'Frame these as the design problems the team is addressing, not findings from a completed user study. We have not supplied user-survey statistics. Do not claim all learners face the same barriers.')

# 3 · Solution and core journey
s=base('The solution',3)
heading(s,'One companion','The lesson stays open. Help stays close.','MELA uses the active lesson and available learning sources to support the next step.')
for x,n,title,body in [(0.7,'1','Ask','Type or speak a question.'),(4.76,'2','Understand','Read or listen to a source-backed answer.'),(8.82,'3','Continue','Request a tutor when you need more help.')]:
    card(s,x,3.85,3.82,n,title,body)
notes(s,'Main demo task: open a Savanna lesson, ask a lesson question in English or Amharic, inspect its source citation, optionally listen, and request human help. Microphone and browser voices depend on browser/language support. Cloud sharing and tutor information sharing have separate consent controls. Page context reads the approved current page, never other browser tabs.')

# 4 · Real course view
s=base('Inside the MVP',4)
text(s,'EXPLAIN THE MOMENT',.7,.99,11,.4,13,TEAL,True)
text(s,'Watch. Read. Understand.',.7,1.48,12,.8,36,INK,True)
box(s,.7,2.55,7.15,4.12,WHITE,BORDER,True)
pic=s.shapes.add_picture(str(OUT/'assets/course-panel.png'),Inches(1.71),Inches(2.66),height=Inches(3.87))
pic._element.xpath('.//p:cNvPr')[0].set('descr','MELA course panel with a two-handed illustrative 3D teacher, source captions, a concept diagram and replay/resume controls.')
text(s,'Captions follow the video.',8.3,2.85,4.1,.8,24,INK,True)
text(s,'Two-handed 3D illustrations\nmake concepts more visible.',8.3,3.85,4.1,1.1,21,MUTED)
text(s,'Pause, explore a diagram,\nthen resume the lesson.',8.3,5.15,4.1,1.0,21,MUTED)
notes(s,'Screenshot: actual implemented course panel, with synthetic caption text used in a controlled browser fixture. The selected public demo video is https://www.youtube.com/watch?v=9hE5-98ZeCg. Its locally prepared English source track has 53 cues. The procedural character has two articulated hands, seven illustrative poses and eight authored concept segments. Gesture keywords and timing follow individual transcript cues, rest during gaps, and follow pause/seek/speed. Explain pauses the source; local demonstration replay does not advance the source. The illustrations are NOT validated ASL or Ethiopian Sign Language translation. Reviewed interpreter tracks have a separate upload/review flow and take priority when provided. No validated signer recording has been supplied.')

# 5 · Accessibility
s=base('Accessible by design',5)
heading(s,'Choice, not assumptions','Different ways to learn. One clear experience.')
text(s,'Read comfortably',.8,3.2,7.1,.55,25,INK,True)
text(s,'Reading mode opens text descriptions\nand makes answers easier to read.',.8,3.93,7.1,1.0,22,MUTED)
text(s,'Stay in control',.8,5.25,7.1,.55,25,INK,True)
text(s,'Keyboard access, visible focus, reduced motion\nand optional voice support.',.8,5.94,7.1,.7,20,MUTED)
box(s,9.25,2.8,2.9,3.96,WHITE,BORDER,True)
pic=s.shapes.add_picture(str(OUT/'assets/reading-mode.png'),Inches(9.93),Inches(2.94),height=Inches(3.67))
pic._element.xpath('.//p:cNvPr')[0].set('descr','MELA mobile Reading mode with an expanded diagram text description, source link, optional Listen control and question composer.')
notes(s,'The screenshot shows the real mobile chat with a controlled synthetic diagram answer. Reading mode is a user-selected local preference, not a disability flag. It enlarges text and expands diagram equivalents; it does not auto-start speech. The labelled chat log uses polite additions and aria-busy while answers are assembled. Websites cannot reliably infer blindness or detect TalkBack through a standard browser API; no such detection is claimed. Browser accessibility tests pass, but physical-device TalkBack/NVDA and fluent co-designer review remain pending.')

# 6 · Architecture
s=base('How it works',6)
heading(s,'Small installation. Shared engine.','One component. Many learning platforms.','A host site adds a script and a Web Component. The backend runs separately.')
items=[(.7,'Any website','Savanna / any LMS'),(3.78,'MELA component','UI + lesson context'),(6.86,'Next.js API','Retrieval + optional AI'),(9.94,'Learning sources','Course + database')]
for x,title,desc in items:
    box(s,x,4.0,2.7,1.65,WHITE,BORDER,True)
    text(s,title,x+.2,4.28,2.32,.6,18,INK,True)
    text(s,desc,x+.2,4.98,2.32,.58,15,MUTED)
for x in [3.47,6.55,9.63]: text(s,'→',x,4.48,.3,.4,23,TEAL,True)
text(s,'Web Component   ·   JavaScript SDK   ·   React adapter   ·   iframe',.74,6.2,12,.4,18,TEAL)
notes(s,'Architecture reference: README.md and packages/sdk/README.md. Frontend: independent TypeScript Web Component with Shadow DOM. Server: Next.js/TypeScript and Node.js; PostgreSQL persists tickets and preferences. Retrieval selects evidence before optional generative explanation. No-match answers offer help rather than fabricating a course answer. Explicit sharing consent applies to external AI. All four embedding paths are implemented; host origins and CSP need configuration. Offline search supports cached learning material, not offline YouTube playback or a bundled local neural model.')

# 7 · Evidence
s=base('What is working',7)
heading(s,'Evidence from the build','A working MVP, with measurable checks.','Local verification recorded 16 November 2026.')
for x,big,label in [(.8,'123','automated checks passed'),(5.05,'34','production browser tests')]:
    text(s,big,x,3.65,4,1.3,68,TEAL,True)
    text(s,label,x,5.12,4.3,.8,20,MUTED)
box(s,9.35,3.68,3.15,2.37,NAVY,None,True)
text(s,'~100 KB',9.6,4.02,2.7,.7,29,WHITE,True)
text(s,'initial browser SDK\n3D loads on demand',9.6,4.96,2.7,.9,17,'C2DBDF')
notes(s,'Source: BUILD_STATUS.md, commit 4550943. Counts: 49 unit, 28 widget/DOM, 10 API, 2 real PostgreSQL and 34 production Chromium tests, totalling 123. These are local checks, not accessibility certification or production traffic. Initial SDK is 99,980 uncompressed bytes; optional 3D runtime is 145,027 gzip bytes. A measured renderer frame uses 16 draw calls, down from 111 (about 86% fewer), with 16,384 triangles. This is reduced submission work, not an 86% speed-up claim. A live YouTube session verified both moving hands, matching captions and zero page errors. Actual assistive-technology, language and user-comprehension testing remain required.')

# 8 · Closing / next steps
s=base('The next step',8,True)
text(s,'Ready for a\nlearner pilot.',.85,1.5,11.8,1.8,51,WHITE,True)
text(s,'Test with learners. Refine the languages.\nValidate accessibility on real devices.',.9,3.78,11.5,1.2,28,'C2DBDF')
text(s,'One lesson. One question. A clearer next step.',.9,5.35,11.6,.55,23,WHITE)
link=text(s,'github.com/FuadTesfaye/mela-ai',.9,6.25,11,.4,17,GOLD)
link.text_frame.paragraphs[0].runs[0].font.color.rgb=color(GOLD)
notes(s,'Next work: run a co-designer learner task unaided; verify Android TalkBack/NVDA, English/Amharic quality and low-end-device performance; validate any actual sign-language recordings with fluent signers; configure production HTTPS, credentials, retention and external channels before a release. Gemini video transcription has timed out in local checks; the demo can instead use its prepared source caption cache. No production deployment, sign-language accuracy or completed participant study is claimed. Demo locally at /demo/sdk.html or /savanna/pages/programming-for-beginners.html. Invite the audience to try the core lesson-question-answer-help flow.')

prs.save(OUT/'MELA-AI-Project-Overview.pptx')
print('Created',OUT/'MELA-AI-Project-Overview.pptx')
