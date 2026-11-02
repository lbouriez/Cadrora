import { useEffect, useRef, useState } from 'react';
import { Photo } from './Photo';
import { siteCopy } from './siteCopy';
import type { Direction, Lang, MockPage } from './data';

const photos=['demo-hero.webp','service-family.webp','service-brand.webp','service-portrait.webp','service-couples.webp'];
type Scene='gallery'|'private'|'admin'|'search'|'session'|'privacy'|'guide'|'real'|null;
export function Prototype({direction,language,view}:{direction:Direction;language:Lang;view:MockPage}) {
  const t=siteCopy[language];
  const [menu,setMenu]=useState(false);
  const [dark,setDark]=useState(direction==='b');
  const [notice,setNotice]=useState(new URLSearchParams(location.search).get('notice')==='1');
  const [scene,setScene]=useState<Scene>(null);
  const [consent,setConsent]=useState(false);
  const [sample,setSample]=useState(false);
  const [photo,setPhoto]=useState<number|null>(null);
  const [session,setSession]=useState(0);
  const dialog=useRef<HTMLDialogElement>(null);
  const menuButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(scene)dialog.current?.showModal();else dialog.current?.close();},[scene]);
  useEffect(()=>{const closeMenu=(event:KeyboardEvent)=>{if(event.key==='Escape'&&menu){setMenu(false);menuButton.current?.focus();}};window.addEventListener('keydown',closeMenu);return()=>window.removeEventListener('keydown',closeMenu);},[menu]);
  const url=(page:MockPage,hash='')=>`/?prototype=${direction}&page=${page}&lang=${language}${hash}`;
  const navUrls=[url('home'),url('services'),url('home','#portfolio'),url('demos'),url('about'),url('contact')];
  const open=(value:Scene)=>{setScene(value);setPhoto(null);setConsent(false);setSample(false);};
  const hero=<section className="m-hero" id="hero">
    {direction==='b'?<Photo src="/assets/demo-hero.webp" alt={t.sample} className="m-hero-backdrop"/>:null}
    <div className="m-hero-copy"><p className="m-eyebrow">{direction==='b'?t.browB:t.eyebrow}</p>
      <h1>{direction==='b'?t.titleB:direction==='c'?t.titleC:t.title}</h1>
      <p className="m-lead">{direction==='b'?t.leadB:direction==='c'?t.leadC:t.lead}</p>
      <div className="m-actions"><a className="m-button m-primary" href={url('home','#demos')}>{t.cta}<span aria-hidden="true">↗</span></a><a className="m-button m-secondary" href={url('home','#installation')}>{t.secondary}</a></div>
      <p className="m-setup-hint">{t.setupHint}</p>
      <div className="m-proofline">{t.proof.map(label=><span key={label}><i aria-hidden="true">✓</i>{label}</span>)}</div>
    </div>
    {direction!=='b'?<div className="m-product"><div className="m-product-chrome"><span aria-hidden="true">● ● ●</span><span>cadrora / {t.gallery}</span><span aria-hidden="true">↗</span></div><div className="m-product-photo"><Photo src="/assets/demo-hero.webp" alt={t.sample}/><div><small>{t.collection}</small><h2>{t.gallery}</h2><button onClick={()=>open('gallery')}>{t.demoActions[1]} <span aria-hidden="true">→</span></button></div></div><div className="m-product-film">{photos.slice(1,4).map((src,i)=><Photo src={'/assets/'+src} alt={t.serviceNames[i]??t.sample} key={src}/>)}</div><p className="m-product-caption">{t.caption}<span>{t.sampleOnly}</span></p></div>:<div className="m-editorial-caption"><span>01 / CADRORA</span><span>{t.sample}</span></div>}
  </section>;
  const demos=<section className="m-section m-demos" id="demos"><div className="m-section-heading"><div><p className="m-eyebrow">{t.demoEyebrow}</p><h2>{t.demoTitle}</h2></div><p>{t.demoLead}</p></div><div className="m-demo-grid">{t.demoNames.map((name,i)=><article className={`m-demo-card m-demo-${i}`} key={name}>{i===0?<Photo src="/assets/amelia.webp" alt={t.sample} className="m-demo-image"/>:<span className="m-demo-symbol" aria-hidden="true">{['','▧','⌑','≡'][i]}</span>}<div className="m-demo-body"><small>{t.demoLabels[i]}</small><h3>{name}</h3><p>{t.demoDescriptions[i]}</p><button className={i===0?'m-button m-primary':'m-demo-link'} onClick={()=>open((['search','gallery','private','admin'] as const)[i]??'gallery')}>{t.demoActions[i]} <span aria-hidden="true">↗</span></button></div></article>)}</div></section>;
  const workflow=<section className="m-section m-workflow"><p className="m-eyebrow">{t.workflowEyebrow}</p><h2>{t.workflowTitle}</h2><div>{t.workflowTitles.map((title,i)=><article key={title}><span>0{i+1}</span><h3>{title}</h3><p>{t.workflowBody[i]}</p></article>)}</div></section>;
  const proof=<section className="m-section m-real"><div className="m-real-identity"><Photo src="/assets/atelier-giulia-logo.png" alt="Atelier Giulia" contain/><span>ATELIER GIULIA</span></div><div><p className="m-eyebrow">{t.realEyebrow}</p><h2>{t.realTitle}</h2><p>{t.realBody}</p><button className="m-text-link" onClick={()=>open('real')}>{t.realAction} ↗</button></div></section>;
  const services=<section className="m-section m-services" id="portfolio"><div className="m-section-heading"><div><p className="m-eyebrow">{t.servicesEyebrow}</p>{view==='services'?<h1>{t.servicesTitle}</h1>:<h2>{t.servicesTitle}</h2>}</div><p>{t.servicesLead}</p></div><div className="m-service-grid">{t.serviceNames.map((name,i)=><article key={name}><button className="m-service-photo" aria-label={`${t.serviceAction} : ${name}`} onClick={()=>{setSession(i);open('session');}}><Photo src={'/assets/'+(photos[i]??photos[0])} alt={name}/><span aria-hidden="true">↗</span></button><p className="m-eyebrow">0{i+1} / {t.sampleOnly}</p><h3>{name}</h3><p>{t.serviceBody[i]}</p><button className="m-text-link" onClick={()=>{setSession(i);open('session');}}>{t.serviceAction} →</button></article>)}</div>{view!=='services'?<a className="m-button m-secondary" href={url('services')}>{t.servicesAll} ↗</a>:null}</section>;
  const installation=<section className="m-section m-install" id="installation"><div><p className="m-eyebrow">{t.installEyebrow}</p><h2>{t.installTitle}</h2><p>{t.installLead}</p><button className="m-button m-primary" onClick={()=>open('guide')}>{t.guide} ↗</button><p className="m-cost">{t.cost}</p></div><ol>{t.steps.map((step,i)=><li key={step}><span>0{i+1}</span><div><h3>{step}</h3><p>{t.stepsBody[i]}</p></div></li>)}</ol></section>;
  const faq=<section className="m-section m-faq"><h2>{t.faqTitle}</h2><div>{t.questions.map((q,i)=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{t.answers[i]}</p></details>)}</div></section>;
  const about=<section className="m-section m-about"><div><p className="m-eyebrow">{t.aboutEyebrow}</p><h1>{t.aboutTitle}</h1><p className="m-lead">{t.aboutBody}</p><a className="m-button m-primary" href={url('contact')}>{t.contactAction} ↗</a><p className="m-note">{t.aboutNote}</p></div><Photo src="/assets/service-brand.webp" alt={t.aboutNote}/></section>;
  const contact=<section className="m-section m-contact"><p className="m-eyebrow">{t.nav[5]} / {t.sampleOnly}</p><h1>{t.contactTitle}</h1><p className="m-lead">{t.contactLead}</p><div className="m-contact-layout"><div className="m-contact-list"><p className="m-example-note">{t.contactNote}</p>{t.contactLabels.map((label,i)=><div key={label}><small>{label}</small><strong>{t.contactValues[i]}</strong></div>)}</div><ol>{t.contactSteps.map((step,i)=><li key={step}><span>0{i+1}</span><div><h3>{step}</h3><p>{t.contactStepBody[i]}</p></div></li>)}</ol></div></section>;
  return <div className={`mock direction-${direction}${dark?' m-dark':''}`}>
    <a className="m-skip" href="#mock-main">{t.skip}</a>
    <div className="m-proposal"><span>{t.prototype} / {direction.toUpperCase()}</span><span>{t.prototypeNote}</span><a href="/#directions" target="_top">{t.back} ↗</a></div>
    <header className="m-header"><a className="m-brand" href={url('home')}><Photo src="/assets/cadrora-logo.png" alt="" contain/><span>CADRORA</span></a><nav className={menu?'is-open':''} aria-label={t.menu}>{t.nav.map((label,i)=><a key={label} href={navUrls[i]}>{label}</a>)}</nav><div className="m-controls"><button aria-label={t.theme} onClick={()=>setDark(!dark)}>{dark?'☀':'☾'}</button><a aria-label={t.language} href={`/?prototype=${direction}&page=${view}&lang=${language==='fr'?'en':'fr'}`}>{language==='fr'?'EN':'FR'}</a><button ref={menuButton} className="m-menu" aria-label={t.menu} aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?'×':'☰'}</button></div></header>
    <main id="mock-main">
      {view==='home'?<>{hero}{demos}{workflow}{proof}{services}{installation}{faq}</>:view==='demos'?demos:view==='installation'?<>{installation}{faq}</>:view==='about'?about:view==='contact'?contact:services}
    </main>
    <footer className="m-footer"><div><a className="m-brand" href={url('home')}><Photo src="/assets/cadrora-logo.png" alt="" contain/><span>CADRORA</span></a><p>{t.footer}</p><small>{t.footerDemo}</small></div><div><a href={url('home','#demos')}>{t.cta}</a><button onClick={()=>open('guide')}>{t.guide}</button><button onClick={()=>open('privacy')}>{t.privacy}</button><button onClick={()=>setNotice(true)}>{t.privacyChoices}</button></div></footer>
    {notice?<aside className="m-privacy" aria-label={t.noticeTitle}><div><strong>{t.noticeTitle}</strong><p>{t.noticeBody}</p><button className="m-text-link" onClick={()=>open('privacy')}>{t.learn}</button></div><button className="m-button m-secondary" onClick={()=>setNotice(false)}>{t.necessary}</button></aside>:null}
    <dialog ref={dialog} className="m-dialog" onCancel={()=>setScene(null)} onClose={()=>setScene(null)} aria-label={t.prototypeNote}><button className="m-dialog-close" aria-label={t.close} onClick={()=>setScene(null)}>×</button><p className="m-eyebrow">{t.prototypeNote}</p>
      {scene==='session'?<><h2>{t.serviceNames[session]}</h2><p>{session===0?t.sessionDescription:t.serviceBody[session]}</p>{session===0?<><p><strong>{t.sessionDuration}</strong></p><p><strong>{t.sessionPrice}</strong></p></>:null}<p className="m-example-note">{t.sessionNote}</p><h3>{t.included}</h3><ul>{t.inclusions.map(v=><li key={v}>{v}</li>)}</ul><a className="m-button m-primary" href={url('contact')}>{t.contactAction} ↗</a></>:null}
      {scene==='gallery'?<><h2>{t.gallery}</h2><p>{t.sample}</p>{photo!==null?<><Photo src={'/assets/'+photos[photo]} alt={t.sample} className="m-open-photo"/><div className="m-actions"><button className="m-button m-secondary" aria-label={t.photoPrevious} onClick={()=>setPhoto((photo+photos.length-1)%photos.length)}>←</button><span>{photo+1} / {photos.length}</span><button className="m-button m-secondary" aria-label={t.photoNext} onClick={()=>setPhoto((photo+1)%photos.length)}>→</button></div></>:<div className="m-sample-grid">{photos.map((src,i)=><button key={src} aria-label={`${t.galleryView} ${i+1}`} onClick={()=>setPhoto(i)}><Photo src={'/assets/'+src} alt={t.sample}/></button>)}</div>}</>:null}
      {scene==='private'?<><h2>{t.privateTitle}</h2><p>{t.demoNotice}</p><label className="m-password">{t.privateLabel}<input type="password" value="cadrora-demo" readOnly/></label><button className="m-button m-primary" onClick={()=>open('gallery')}>{t.privateButton} →</button></>:null}
      {scene==='admin'?<><h2>{t.adminTitle}</h2><p className="m-example-note">{t.readonly}</p><table><thead><tr>{t.adminColumns.map(v=><th key={v}>{v}</th>)}</tr></thead><tbody>{t.adminRows.map(row=><tr key={row[0]}>{row.map(v=><td key={v}>{v}</td>)}</tr>)}</tbody></table><p>{t.demoNotice}</p></>:null}
      {scene==='search'?<><h2>{t.searchTitle}</h2><p>{t.searchCopy}</p><label className="m-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{t.consent}</label><button className="m-sample-choice" disabled={!consent} onClick={()=>setSample(true)}><Photo src="/assets/amelia.webp" alt={t.sample}/><span>{t.useSample} →</span></button>{sample?<p className="m-example-note" role="status">{t.sampleResult}</p>:null}</>:null}
      {scene==='privacy'?<><h2>{t.privacy}</h2><p>{t.privacyDialog}</p></>:null}
      {scene==='guide'?<><h2>{t.guide}</h2><p>{t.guideDialog}</p><a className="m-button m-primary" href="https://github.com/lbouriez/Cadrora/blob/main/docs/deployment.md" target="_blank" rel="noreferrer">{t.openGuide} ↗</a></>:null}
      {scene==='real'?<><h2>Atelier Giulia</h2><p>{t.brandProof}</p><a className="m-button m-primary" href="https://ateliergiulia.com/" target="_blank" rel="noreferrer">{t.openReal} ↗</a></>:null}
    </dialog>
  </div>;
}
