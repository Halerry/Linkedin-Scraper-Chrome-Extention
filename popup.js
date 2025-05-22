
document.getElementById("extract").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractProfileInfo
  });
});

document.getElementById("downloadPdf").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: saveProfileAsPDF
  });
});

/* ---------------------  Injected FUNCTIONS ---------------------- */
function extractProfileInfo() {
  // helpers inside injected context
  const waitForSelector = async (selector, maxRetries = 15) => {
    for (let i = 0; i < maxRetries; i++) {
      const el = document.querySelector(selector);
      if (el) return el;
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  };
  const firstLine = (txt = "") => txt?.split("\n")[0].trim() || "";
  const cleanDate = (raw = "") => {
    let txt = (raw||"").split("·")[0];
    txt = txt.replace(/^(De|Du|d’|d')\s+/i, "").replace(/\s+à\s+/i, " - ");
    return firstLine(txt);
  };
  const clickIfExists = async sel => {
    const b = document.querySelector(sel);
    if(b){ b.click(); await new Promise(r=>setTimeout(r,500)); }
  };

  (async () => {
    /* NAME */
    let name = "";
    const heading = await waitForSelector(".text-heading-xlarge");
    if(heading) name = heading.innerText.trim();
    if(!name){
      const img = await waitForSelector(".pv-top-card-profile-picture__image, .pv-top-card-profile-picture__image--show, .profile-photo-edit__preview");
      if(img) name = (img.getAttribute("alt")||img.getAttribute("title")||"").trim();
    }
    if(!name){
      const meta = document.querySelector('meta[property="og:title"]')?.content;
      if(meta) name = meta.split(" | ")[0].trim();
    }
    if(!name){
      const t = document.title;
      name = t.includes("|")? t.split("|")[0].trim() : t.trim();
    }

    /* PHOTO */
    let photo = document.querySelector(".pv-top-card-profile-picture__image, .pv-top-card-profile-picture__image--show, .profile-photo-edit__preview")?.src || "";
    if(!photo){
      photo = document.querySelector('meta[property="og:image"]')?.content || "";
    }

    /* EXPERIENCE */
    const experienceEls = document.querySelectorAll("#experience ~ div ul > li");
    const experience = Array.from(experienceEls).map(el => ({
      title: firstLine(el.querySelector("span[aria-hidden='true']")?.innerText),
      company: firstLine(el.querySelector(".t-14.t-normal")?.innerText),
      date: cleanDate(el.querySelector(".t-14.t-normal.t-black--light")?.innerText),
    })).filter(e=>e.title && e.date);

    /* EDUCATION */
    const educationEls = document.querySelectorAll("#education ~ div ul > li");
    const education = Array.from(educationEls).map(el => ({
      school: firstLine(el.querySelector("span[aria-hidden='true']")?.innerText),
      degree: firstLine(el.querySelector(".t-14.t-normal")?.innerText),
      date: cleanDate(el.querySelector(".t-14.t-normal.t-black--light")?.innerText),
    })).filter(e=>e.school && e.date);

    /* SKILLS */
    await clickIfExists('button[aria-label*="Afficher plus"][aria-label*="compétence"], button[aria-label*="Show all"][aria-label*="skill"]');
    const skillSpans = document.querySelectorAll(          'a[href*="SKILL_NAVIGATION"] span[aria-hidden="true"],'+
      'span.pv-skill-category-entity__name-text,'+
      'span.pvs-entity__skill-name');
    const tmpSkills = Array.from(skillSpans).map(sp=>firstLine(sp.innerText)).filter(Boolean);
    const skills = tmpSkills.filter((v,i,a)=>a.indexOf(v)===i);

    const data = { name, photo, experience, education, skills };

    // open preview tab
    chrome.runtime.sendMessage({type:"openPreview", payload:data});
  })();
}

function saveProfileAsPDF() {
  const waitForSelector = async (selector, maxRetries = 15) => {
    for (let i = 0; i < maxRetries; i++) {
      const el = document.querySelector(selector);
      if(el) return el;
      await new Promise(r=>setTimeout(r,250));
    }
    return null;
  };

  (async () => {
    window.scrollTo({top:0, behavior:"instant"});

    const moreBtn = await waitForSelector(
      'button[aria-label*="Plus d’actions"], ' +
      'button[aria-label*="Plus d\'actions"], ' +
      'button[aria-label*="Plus"]:not([aria-label*="compétence"]), ' +
      'button[aria-label*="More actions"], ' +
      'button.artdeco-dropdown__trigger[aria-expanded]'
    );
    if(!moreBtn){ alert('Bouton "Plus / More actions" introuvable'); return;}
    moreBtn.click();

    const pdfItem = await waitForSelector(          'div[role="button"][aria-label*="format PDF"],' +          'div[role="button"][aria-label*="Save as PDF"],' +          'button[aria-label*="Save as PDF"]'        );
    if(!pdfItem){ alert('Option "Enregistrer au format PDF" introuvable'); return;}
    pdfItem.click();
  })();
}

/* ---------------------- BACKGROUND relay ----------------------- */
// Listen to message from injected script and open preview tab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if(msg.type === "openPreview") {
    const payload = msg.payload;
    chrome.tabs.create({url: chrome.runtime.getURL("preview.html")}, tab => {
      const listener = (tabId, info) => {
        if(tabId === tab.id && info.status === 'complete'){
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.sendMessage(tabId, {type:'showPreview', data: payload});
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }
});
