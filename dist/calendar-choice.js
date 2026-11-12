export const CHOICE_KEY='schichtkompass-calendar-choice';
export function suggestedCalendar(nav={}){
 const ua=nav.userAgent||'';
 if(/iPhone|iPad|iPod/.test(ua)||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1))return 'iphone';
 if(/Android/i.test(ua))return 'google';
 return '';
}
export function initialCalendar(saved,nav){return ['iphone','google','timetree-ios','timetree-android'].includes(saved)?saved:suggestedCalendar(nav)}
export function calendarLinks(feed,base){
 const u=new URL(feed);
 const services=u.searchParams.getAll('dienst'),groups=u.searchParams.getAll('gruppe');
 if(u.origin!=='https://schichtkompass-calendar.andi201andi201.chatgpt.site'||!/^\/feed\/[a-f0-9]{64}\/[a-f0-9]{64}\.ics$/.test(u.pathname)||u.hash||[...u.searchParams.keys()].some(key=>!['dienst','gruppe'].includes(key))||services.length+groups.length>1||(groups.length&&!/^(frueh|spaet|nacht|sonstiges)$/.test(groups[0]))||(services.length&&!/^(legacy|[a-f0-9]{32})$/.test(services[0])))throw Error('Ungültiger Kalender-Link');
 return {apple:feed.replace('https:','webcal:'),google:'https://calendar.google.com/calendar/render?cid='+encodeURIComponent(feed.replace('https:','webcal:')),setup:base.split('#')[0]+'#google-abo='+encodeURIComponent(feed)};
}
export function showGoogleSetup(){
 if(!location.hash.startsWith('#google-abo=')){document.getElementById('google-setup').hidden=true;document.querySelector('.app-shell').hidden=false;return;}
 const box=document.getElementById('google-setup');
 try{
  const feed=decodeURIComponent(location.hash.slice(12)),links=calendarLinks(feed,location.href);
  document.querySelector('.app-shell').hidden=true;box.hidden=false;
  document.getElementById('google-setup-open').href=links.google;
  document.getElementById('google-setup-feed').value=feed;
  document.getElementById('google-setup-mobile').hidden=!suggestedCalendar(navigator);
  document.getElementById('google-setup-copy').onclick=async()=>{try{await navigator.clipboard.writeText(feed);document.getElementById('google-setup-status').textContent='Kalender-Link kopiert.'}catch{document.getElementById('google-setup-feed').select();document.getElementById('google-setup-status').textContent='Link markieren und kopieren.'}};
 }catch{box.hidden=false;document.getElementById('google-setup-status').textContent='Dieser Einrichtungslink ist ungültig.'}
}
