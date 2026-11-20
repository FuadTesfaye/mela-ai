"""Build As-Sunnah's six-slide pitch using editable native DrawingML shapes.

Python standard library only. The base archive retains the original deck's
Office theme/layouts. No network, package installation or credentials required.
"""
from pathlib import Path
from xml.sax.saxutils import escape as esc
import zipfile
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
P='http://schemas.openxmlformats.org/presentationml/2006/main'
A='http://schemas.openxmlformats.org/drawingml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
REL='http://schemas.openxmlformats.org/package/2006/relationships'
CT='http://schemas.openxmlformats.org/package/2006/content-types'
NAVY='103C4B'; INK='17394E'; TEAL='087E8B'; MUTE='526E78'
PAPER='F5F7F3'; WHITE='FFFFFF'; GOLD='E9B96D'; LIGHT='D1E5E4'; LINE='D6E2DF'
URL='https://mela-ai-wheat.vercel.app/savanna/pages/homepage-v1-self-paced.html'
slides=[]
def emu(x): return str(round(x*914400))
def xml(s): return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s

def shape(s,x,y,w,h,fill,kind='rect',stroke=None):
    s['ops'].append(('shape',x,y,w,h,fill,kind,stroke))
    i=len(s['shapes'])+2
    ln=f'<a:ln w="12700"><a:solidFill><a:srgbClr val="{stroke}"/></a:solidFill></a:ln>' if stroke else '<a:ln><a:noFill/></a:ln>'
    s['shapes'].append(f'<p:sp><p:nvSpPr><p:cNvPr id="{i}" name="Shape {i}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{emu(x)}" y="{emu(y)}"/><a:ext cx="{emu(w)}" cy="{emu(h)}"/></a:xfrm><a:prstGeom prst="{kind}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>{ln}</p:spPr></p:sp>')

def text(s,value,x,y,w,h,size=20,fill=INK,bold=False,font=None,align='l',link=None):
    s['ops'].append(('text',value,x,y,w,h,size,fill,bold,font,align,link))
    i=len(s['shapes'])+2
    font=font or ('Montserrat' if bold else 'Noto Sans')
    paras=[]
    for line in value.split('\n'):
        hyper=''
        if link:
            rid='rId'+str(len(s['rels'])+1);s['rels'].append((rid,'hyperlink',link,True))
            hyper=f'<a:hlinkClick r:id="{rid}"/>'
        paras.append(f'<a:p><a:pPr algn="{align}"><a:lnSpc><a:spcPct val="112000"/></a:lnSpc><a:spcAft><a:spcPts val="400"/></a:spcAft></a:pPr><a:r><a:rPr lang="en-US" sz="{round(size*100)}" b="{int(bold)}"><a:solidFill><a:srgbClr val="{fill}"/></a:solidFill><a:latin typeface="{font}"/><a:ea typeface="Droid Sans Ethiopic"/><a:cs typeface="Droid Sans Ethiopic"/>{hyper}</a:rPr><a:t>{esc(line)}</a:t></a:r></a:p>')
    s['shapes'].append(f'<p:sp><p:nvSpPr><p:cNvPr id="{i}" name="{esc(value[:50], {chr(34): "&quot;"})}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{emu(x)}" y="{emu(y)}"/><a:ext cx="{emu(w)}" cy="{emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0" tIns="0" bIns="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>{"".join(paras)}</p:txBody></p:sp>')

def picture(s,name,x,y,w,h,description):
    s['ops'].append(('picture',name,x,y,w,h,description))
    i=len(s['shapes'])+2;rid='rId'+str(len(s['rels'])+1)
    s['rels'].append((rid,'image','../media/'+name,False))
    s['shapes'].append(f'<p:pic><p:nvPicPr><p:cNvPr id="{i}" name="Product screenshot" descr="{esc(description)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="{emu(x)}" y="{emu(y)}"/><a:ext cx="{emu(w)}" cy="{emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>')

def base(label,dark=False):
    n=len(slides)+1
    s={'shapes':[],'ops':[],'rels':[('rId1','slideLayout','../slideLayouts/slideLayout7.xml',False),('rId2','notesSlide',f'../notesSlides/notesSlide{n}.xml',False)],'bg':NAVY if dark else PAPER,'notes':''}
    slides.append(s)
    text(s,'AS-SUNNAH  /  MELA AI',.62,.30,6,.3,11,GOLD if dark else TEAL,True)
    text(s,label.upper(),8.15,.30,4.55,.3,10,LIGHT if dark else MUTE,align='r')
    shape(s,.62,7.02,12.08,.012,'355B66' if dark else LINE)
    text(s,'ALX DIGITAL BRIDGE  ·  ACCESSIBILITY HACKATHON  ·  21 NOV 2026',.62,7.14,11,.22,8.5,LIGHT if dark else MUTE)
    text(s,f'{n:02d} / 06',12.05,7.12,.7,.25,9,LIGHT if dark else MUTE,align='r')
    return s

def title(s,kicker,headline,sub=None):
    text(s,kicker.upper(),.65,.95,12,.35,12,TEAL,True)
    text(s,headline,.65,1.43,12,1.05,34,INK,True)
    if sub:text(s,sub,.67,2.43,12,.62,18,MUTE)

def label(s,t,x,y,w=3.5,dark=False):
    text(s,t,x,y,w,.35,11,GOLD if dark else TEAL,True)

# 1 — Clear promise, identity and team.
s=base('Track 3 · Multilingual Assistant and Live Help',True)
text(s,'Ask once.\nKeep learning.',.72,1.10,8.4,2.15,53,WHITE,True)
text(s,'MELA AI',.76,3.53,7.8,.68,32,GOLD,True)
text(s,'Your web Jarvis for voice navigation,\ncourse explanations and human help—\nbuilt around how you learn.',.78,4.33,7.7,1.35,20,WHITE)
for d,c in [(3.6,'194A58'),(2.9,'225B67'),(2.16,TEAL)]:
    shape(s,10.55-d/2,2.95-d/2,d,d,c,'ellipse')
for j,h in enumerate([.32,.65,1.08,.76,.40]):
    shape(s,9.86+j*.27,2.95-h/2,.12,h,WHITE,'roundRect')
text(s,'YOUR VOICE. YOUR WAY.',8.52,5.03,4.0,.6,13,LIGHT,True,align='ctr')
shape(s,.74,5.98,11.86,.014,'3A6370')
for x,n,role in zip([.76,3.83,6.90,9.97],['Fuad Tesfaye','Salim Siraj','Sifen Fisaha','Yusra Mohhamed'],['Team Lead','Frontend','Backend','Animation & Gestures']):
    text(s,n,x,6.18,2.65,.35,16,WHITE,True)
    text(s,role,x,6.61,2.6,.25,10,LIGHT)
s['notes']='0:00–0:40 | We are As-Sunnah: Fuad Tesfaye, Salim Siraj, Sifen Fisaha and Yusra Mohhamed. We built MELA AI for Track 3: Multilingual Assistant and Live Help. A course can be online and still be out of reach. MELA brings understandable explanations, accessible ways to learn and a route to a person into the lesson itself. Our ambition is simple: make the next step possible. Fuad is Team Lead, Salim handles Frontend, Sifen handles Backend, and Yusra handles Animation & Gestures.'

# 2 — A specific learner moment, with the intended before/after outcome.
s=base('The problem and who it is for')
title(s,'The learner moment','One unclear sentence can stop a lesson.','An Amharic-speaking learner opens an English course. What happens next?')
for x,k,h,b,c in [(.68,'WITHOUT IN-CONTEXT HELP','The video moves on.\nThe question remains.','Translate elsewhere. Search for help.\nTry to find the way back.',NAVY),(6.91,'WITH MELA','Ask about this lesson.\nFind the next step.','Read or hear an explanation, check the\nsource, or request a person.',TEAL)]:
    shape(s,x,3.17,5.75,2.73,c,'roundRect')
    text(s,k,x+.27,3.43,5.18,.32,11,GOLD if c==NAVY else WHITE,True)
    text(s,h,x+.27,3.96,5.18,1.05,25,WHITE,True)
    text(s,b,x+.27,5.15,5.18,.72,16,LIGHT if c==NAVY else WHITE)
text(s,'LANGUAGE  ·  NAVIGATION  ·  TIMELY SUPPORT',.72,6.13,11.9,.36,12,TEAL,True)
text(s,'For persons with disabilities, refugees, women and low-literacy learners.',.72,6.57,11.9,.4,16,INK)
s['notes']='0:40–1:25 | Imagine an Amharic-speaking learner watching an English lesson. A phrase is unclear, the video continues, and the help is somewhere else. If navigating is already difficult, that extra step matters. This is an illustrative scenario, not a documented research participant. We designed for persons with disabilities, refugees, women and low-literacy learners, recognising that needs differ. We focus on three barriers we can address within the learning flow: language, access and timely support. We have not supplied a completed learner study or impact statistics.'
s['notes'] += '\n\nSLIDE INTERPRETATION: Both panels are an illustrative learner journey, not a measured before-and-after study. The second panel describes the intended product experience. Start with the learner’s unanswered question and explain how MELA reduces the number of steps between confusion and useful help.'

# 3 — The actual product gets the space; short benefits support it.
s=base('What our solution does')
text(s,'BUILT: YOUR WEB JARVIS',.68,1.02,4.28,.35,12,TEAL,True)
text(s,'Ask. Understand.\nKeep going.',.68,1.55,4.30,1.28,30,INK,True)
for y,n,t,b in [(3.10,'01','Talk to the web','Use the mic to navigate,\nread and act.'),(4.22,'02','Understand the lesson','Cited answers, captions\nand visual explanations.'),(5.34,'03','Reach a person','Ask a tutor. Choose\nwhat you share.')]:
    text(s,n,.70,y,.47,.35,13,TEAL,True)
    text(s,t,1.25,y,3.75,.40,19,INK,True)
    text(s,b,1.25,y+.44,3.75,.67,16,MUTE)
shape(s,5.18,.99,7.52,5.65,WHITE,'roundRect',LINE)
picture(s,'course-panel.png',5.25,1.055,7.38,5.56,'Actual MELA course-learning interface: captions, illustrative teacher, source-linked explanation, replay and resume controls. Controlled caption fixture; illustrative gestures are not sign-language translation.')
text(s,'ACTUAL COURSE UI  ·  controlled caption fixture  ·  illustrative gestures, not sign-language translation',5.25,6.74,7.4,.20,8.5,MUTE)
s['notes']='1:25–2:20 | We have built our Jarvis for the web. Open a website, turn on the microphone and ask MELA to navigate, read, explain or help complete a task. The learner stays in control, with confirmation before sensitive actions. Alongside voice interaction, course-aware answers link back to the lesson, captions and illustrative gestures support understanding, and human help remains available. The team confirmed the built status of the web voice assistant in this conversation; this deck edit is not an independent functional test. The screenshot shows the course-learning panel, not a screenshot of cross-site voice control. It contains synthetic caption content from a controlled fixture. Gestures are illustrative, not validated Ethiopian Sign Language. Speech and new media generation depend on browser support, consent and configured services.'

# 4 — Three integration choices, described in audience language first.
s=base('How it plugs in, and what works live')
title(s,'Bring MELA to your platform','Fits the platform you already use.','Savanna today. The same building blocks for colleges and job platforms.')
for x,k,t,b in [(.68,'EMBED','Add a panel','Use a script tag, Web Component\nor iframe on an existing page.'),(4.85,'API','Your own interface','Connect your system through\nREST APIs and webhooks.'),(9.02,'OPTIONAL SDK','Use components','Use ready-made components\nand the React adapter.')]:
    shape(s,x,3.29,3.63,2.04,WHITE,'roundRect',LINE)
    text(s,k,x+.22,3.52,3.18,.30,11,TEAL,True)
    text(s,t,x+.22,4.00,3.18,.65,20,INK,True)
    text(s,b,x+.22,4.66,3.18,.62,14,MUTE)
text(s,'YOUR PLATFORM STAYS YOURS',.71,5.64,3.5,.35,12,TEAL,True)
text(s,'Keep your layout. Connect approved course content. Choose the support you need.',.71,6.03,11.9,.44,17,INK)
text(s,'TRY THE HOSTED MVP  →  mela-ai-wheat.vercel.app',.71,6.63,11.9,.3,13,TEAL,True,link=URL)
s['notes']='2:20–3:10 | The SDK is one option. A platform can embed MELA with a script tag or Web Component, use an iframe, integrate its own interface through the REST API described by OpenAPI, or choose our SDK and optional React adapter. Webhooks connect supported events to host workflows. Hosts connect approved course sources and configure the API origins, permissions and security policy. Shadow DOM isolates component styles; mounting preserves existing host content. These options bring the same support experience to Savanna, TVET colleges and job platforms without requiring a platform redesign. They are integration choices, not a claim of prebuilt connectors to every LMS. Retest the organisers’ deployment findings: database health and a tutor reply, correct default Savanna content, and a working live model or a visible source-only fallback. This deck edit did not independently verify those services. Hosted demo: '+URL+'. The supplied Savanna UI is a hosted static capture, not an authenticated production account integration.'
s['notes'] += '\n\nSUBMISSION POSITIONING: This is an MVP pitch. Describe the component, retrieval and handover workflows as product capabilities, and state current deployment limitations candidly when demonstrating them. The organisers’ three live checks remain in the presenter guide and must be verified before the demo; moving this checklist out of the projected slide is not evidence that the checks passed.'

# 5 — Accessibility choices beside the offline learning journey.
s=base('Accessibility and Ethiopia')
title(s,'Built around learner choice','Access that travels with the learner.','English + አማርኛ  ·  read, listen, ask and learn at your pace.')
text(s,'Keyboard + readable text',.72,3.26,5.1,.50,23,INK,True)
text(s,'Visible focus, reading mode\nand reduced motion.',.74,3.94,5.05,.76,18,MUTE)
text(s,'Captions + visual support',.72,4.97,5.1,.50,23,INK,True)
text(s,'Replay an explanation.\nChoose how you follow the lesson.',.74,5.64,5.05,.76,18,MUTE)
for y,n,t,b in [(3.23,'1','Install as a PWA','Keep a supported site on your home screen.'),(4.33,'2','Download your course','Save available lessons and resources.'),(5.43,'3','Learn with a localised agent','Ask about saved lessons in your context.')]:
    shape(s,6.28,y,6.36,.93,WHITE,'roundRect',LINE)
    shape(s,6.48,y+.22,.42,.42,TEAL,'ellipse')
    text(s,n,6.48,y+.255,.42,.26,12,WHITE,True,align='ctr')
    text(s,t,7.10,y+.12,5.30,.35,17,INK,True)
    text(s,b,7.10,y+.54,5.30,.30,13,MUTE)
shape(s,.70,6.60,11.96,.28,'E2EEEA','roundRect')
text(s,'TEST COVERAGE: keyboard + automated checks. NEXT: co-design and real-device screen-reader review.',.81,6.645,11.72,.20,9,MUTE)
s['notes']='3:10–4:05 | MELA is designed to be close at hand: install a supported learning site as a progressive web app, download the available course pack and continue learning with a localised agent around saved course knowledge and language resources. Explain localised as adapted to the learner’s language and context; do not claim a bundled on-device neural model unless the team can demonstrate it. The PWA/download/local-agent description reflects the product scope supplied by the team in this conversation and was not independently tested during this deck update. A PWA installation does not turn every arbitrary website into an offline app. Download only resources made available by the platform and permitted by their rights; embedded streaming services are not automatically downloadable. First-time downloads need connectivity, storage and compatible browsers; live tutors, sync and fresh online content need a connection. Keyboard controls, reading mode, captions and reduced motion provide alternative ways to learn. Prepared Amharic materials need fluent review, and speech support varies by browser. The repository contains automated accessibility coverage; co-designer feedback and physical-device screen-reader evidence remain to be gathered. SMS and Telegram adapters provide further access routes when configured.'

# 6 — A focused month and a concrete partner ask.
s=base('What is next',True)
text(s,'Help us reach the next learner.',.70,1.03,11.95,.92,37,WHITE,True)
text(s,'Next month: more access needs. More languages.',.73,2.13,11.8,.58,24,LIGHT)
shape(s,.78,3.28,11.48,.014,'3A6974')
for x,k,t,b in [(.74,'WEEK 1','Co-design for access','Vision, hearing, motor and\ncognitive needs; device testing.'),(4.89,'WEEK 2','Expand languages','Review Amharic; build\nAfaan Oromo + Tigrinya packs.'),(9.04,'WEEKS 3–4','Widen offline reach','More downloadable courses\nand localised-agent access.')]:
    shape(s,x+.04,3.22,.14,.14,GOLD,'ellipse')
    text(s,k,x,3.59,3.60,.30,11,GOLD,True)
    text(s,t,x,4.09,3.62,.63,21,WHITE,True)
    text(s,b,x,4.91,3.62,.83,16,LIGHT)
shape(s,.74,6.00,.08,.62,GOLD)
text(s,'PARTNER ON A LEARNER PILOT',1.00,6.02,11.3,.32,12,GOLD,True)
text(s,'Course platforms · accessibility co-designers · language reviewers · hosting support',1.00,6.48,11.45,.40,15,WHITE)
s['notes']='4:05–5:00 | Our next step is broader reach. Building on the web Jarvis that the team has built, we will address more accessibility needs and more languages. Week one is co-design with people with vision, hearing, motor and cognitive access needs, including real-device screen-reader and keyboard sessions. Week two expands language access through fluent Amharic review, Afaan Oromo and Tigrinya packs. Weeks three and four broaden downloadable course resources and access to the localised learning agent. We will use feedback to improve comprehension, focus order, alternative input and readable explanations. Source-backed practice quizzes and reviewed sign-language materials are additional opportunities, subject to learner feedback and expert review. Our partners can help with public course resources, accessibility co-design, language review and sustainable hosting. Close: The assistant is built. Now we want more learners to be able to use it.'

# Optional detail for the judges' three-minute Q&A; it is not another slide.
slides[0]['notes'] += '\n\nPRESENTER CUE: Introduce each person once. State the one-sentence promise, then move directly to the learner example.'
slides[1]['notes'] += '\n\nJUDGES / DETAIL: The entry audience is learners using an online course who need help with language, navigation, comprehension or reaching a person. Do not equate low literacy with a disability. Success measures for a pilot: completing a lesson task, reaching a relevant source, completing the keyboard flow, and receiving a tutor reply. Baseline and follow-up measurements still need to be collected.'
slides[2]['notes'] += '\n\nDEMO CUE: Use one permissioned voice task on the hosted page, show the question text and result, then demonstrate the source link. For a consequential action, preview the action and ask for confirmation. Show a lesson answer in English and the equivalent question in Amharic. Explain that the pictured panel is the learning experience. Tutor escalation should include the sharing preview and an actual reply when the live backend has been verified.'
slides[3]['notes'] += '\n\nJUDGES / INTEGRATION: Choose an embed for a small change to an existing page; an iframe when the host prefers separation; the REST API when the platform wants its own interface; and the optional SDK/React adapter for ready-made components and lifecycle control. OpenAPI describes the endpoints and webhooks notify supported events; neither is a universal turnkey LMS connector. The host chooses the approved course content. Index public or authorised course materials, set origins and configure support services. No platform migration is required by these integration patterns. Health monitoring and alerts are part of operational readiness.'
slides[4]['notes'] += '\n\nJUDGES / OFFLINE: Explain the three steps: install the supported site as a PWA, download its available course pack while online, then demonstrate which saved lessons and localised-agent functions work without connectivity. A home-screen icon alone does not prove offline learning. Show the actual saved-resource boundary. Downloads, refreshes, storage capacity and resource permissions are platform-dependent; live support and fresh cloud responses remain online. Do not claim all third-party videos are downloadable or that localised necessarily means a local neural model. For accessibility, discuss keyboard focus, readable text, caption choice, reduced motion and the next co-design/device validation sessions.'
slides[5]['notes'] += '\n\nJUDGES / NEXT MONTH: Prioritise accessibility barriers with co-designers rather than treating all disabilities as a single need. Validate translation quality and lesson comprehension with fluent speakers before expanding language packs. Ask partner platforms for permissioned course resources and an agreed pilot cohort. Ask accessibility partners for co-design sessions and device testing; ask language partners for Amharic, Afaan Oromo and Tigrinya review. Track the pilot outcomes described on slide two. The roadmap builds reach around the existing web assistant.'

GROUP='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>'
def rels(items):
    return xml(f'<Relationships xmlns="{REL}">'+''.join(f'<Relationship Id="{i}" Type="{R}/{t}" Target="{esc(v)}"'+(' TargetMode="External"' if external else '')+'/>' for i,t,v,external in items)+'</Relationships>')

def build():
    with zipfile.ZipFile(OUT/'assets/deck-base.zip') as source:
        files={n:source.read(n) for n in source.namelist()}
    files['_rels/.rels']=rels([('rId1','officeDocument','ppt/presentation.xml',False)])
    ids=''.join(f'<p:sldId id="{256+i}" r:id="rId{i+3}"/>' for i in range(6))
    files['ppt/presentation.xml']=xml(f'<p:presentation xmlns:a="{A}" xmlns:p="{P}" xmlns:r="{R}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst><p:sldIdLst>{ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>')
    files['ppt/_rels/presentation.xml.rels']=rels([('rId1','slideMaster','slideMasters/slideMaster1.xml',False),('rId2','notesMaster','notesMasters/notesMaster1.xml',False)]+[(f'rId{i+3}','slide',f'slides/slide{i+1}.xml',False) for i in range(6)])
    for i,s in enumerate(slides,1):
        files[f'ppt/slides/slide{i}.xml']=xml(f'<p:sld xmlns:a="{A}" xmlns:p="{P}" xmlns:r="{R}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="{s["bg"]}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>{GROUP}{"".join(s["shapes"])}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>')
        files[f'ppt/slides/_rels/slide{i}.xml.rels']=rels(s['rels'])
        files[f'ppt/notesSlides/notesSlide{i}.xml']=xml(f'<p:notes xmlns:a="{A}" xmlns:p="{P}" xmlns:r="{R}"><p:cSld><p:spTree>{GROUP}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Speaker notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="3"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>{esc(s["notes"])}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>')
        files[f'ppt/notesSlides/_rels/notesSlide{i}.xml.rels']=rels([('rId1','notesMaster','../notesMasters/notesMaster1.xml',False),('rId2','slide',f'../slides/slide{i}.xml',False)])
    files['ppt/media/course-panel.png']=(OUT/'assets/course-panel.png').read_bytes()
    types={'ppt/presentation.xml':'presentation','ppt/slideMasters/slideMaster1.xml':'slideMaster','ppt/notesMasters/notesMaster1.xml':'notesMaster'}
    overrides=[]
    for n in files:
        if not n.endswith('.xml'):continue
        if n in types:typ='application/vnd.openxmlformats-officedocument.presentationml.'+types[n]+'+xml'
        elif n.startswith('ppt/slides/'):typ='application/vnd.openxmlformats-officedocument.presentationml.slide+xml'
        elif n.startswith('ppt/notesSlides/'):typ='application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml'
        elif n.startswith('ppt/slideLayouts/'):typ='application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml'
        elif n.startswith('ppt/theme/'):typ='application/vnd.openxmlformats-officedocument.theme+xml'
        else:continue
        overrides.append(f'<Override PartName="/{n}" ContentType="{typ}"/>')
    files['[Content_Types].xml']=xml(f'<Types xmlns="{CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>{"".join(overrides)}</Types>')
    for n,b in files.items():
        if n.endswith(('.xml','.rels')):ET.fromstring(b)
    target=OUT/'MELA-AI-Project-Overview.pptx'
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
        for n,b in files.items():z.writestr(n,b)
    print(f'Created {target} ({len(slides)} slides; editable text, vectors and notes)')

if __name__=='__main__':build()
